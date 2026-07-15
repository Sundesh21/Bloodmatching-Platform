import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { BLOOD_GROUPS } from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { sendMail } from "../utils/mailer.js";

const router = Router();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5; // brute-force guard on the 6-digit code

// Verifies a submitted OTP against the stored hash, counting failed tries so a
// 6-digit code can't be brute-forced within its 10-minute window. On too many
// wrong tries or expiry, the code is invalidated. Returns true only on a match.
async function checkOtp(user, otp) {
  if (!user || !user.resetOtpHash || !user.resetOtpExpires) return false;
  if (user.resetOtpExpires.getTime() < Date.now()) return false;
  if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) return false;
  const ok = await bcrypt.compare(String(otp || ""), user.resetOtpHash);
  if (!ok) {
    user.resetOtpAttempts += 1;
    await user.save();
  }
  return ok;
}

// Trust boundary: coords come from the client, so bound-check before storing.
function validCoords(loc) {
  return (
    loc &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng) &&
    Math.abs(loc.lat) <= 90 &&
    Math.abs(loc.lng) <= 180
  );
}

// Strong-password gate: min 8 chars with at least one letter and one number.
// Returns an error string, or null if the password passes.
function passwordError(pw) {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 72) return "Password must be at most 72 characters"; // bcrypt truncates past 72
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return "Password must include at least one letter and one number";
  }
  return null;
}

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    bloodGroup: u.bloodGroup,
    city: u.city,
    phone: u.phone,
    isAvailable: u.isAvailable,
    lastDonation: u.lastDonation,
    hospitalName: u.hospitalName,
    licenseNo: u.licenseNo,
  };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      bloodGroup,
      city,
      phone,
      hospitalName,
      licenseNo,
      documentUrl,
      location,
    } = req.body;

    if (!name || !email || !password || !role || !city) {
      return res.status(400).json({ message: "Fill in all required fields" });
    }
    if (!/^[A-Za-z\s]+$/.test(name.trim())) {
      return res
        .status(400)
        .json({ message: "Name can only contain letters and spaces" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    const pwErr = passwordError(password);
    if (pwErr) return res.status(400).json({ message: pwErr });
    if (phone && !/^\d{10}$/.test(phone)) {
      return res
        .status(400)
        .json({ message: "Phone number must be exactly 10 digits" });
    }
    // Admins are never self-serve — only public roles can sign up here.
    if (!["donor", "requester", "hospital"].includes(role)) {
      return res.status(400).json({ message: "Invalid account type" });
    }
    if (role !== "hospital" && !bloodGroup) {
      return res.status(400).json({ message: "Select your blood group" });
    }
    if (role === "hospital" && !licenseNo) {
      return res
        .status(400)
        .json({ message: "Hospitals must provide a registration / license number" });
    }
    if (role === "hospital" && !documentUrl) {
      return res
        .status(400)
        .json({ message: "Hospitals must upload a scanned verification document" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      // Hospitals must be approved by an admin before they can act.
      status: role === "hospital" ? "pending" : "active",
      bloodGroup: role === "hospital" ? undefined : bloodGroup,
      city,
      phone,
      location: validCoords(location) ? { lat: location.lat, lng: location.lng } : undefined,
      hospitalName: role === "hospital" ? hospitalName || name : undefined,
      licenseNo: role === "hospital" ? licenseNo : undefined,
      documentUrl: role === "hospital" ? documentUrl : undefined,
    });

    res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
      message:
        role === "hospital"
          ? "Your hospital account was created and is awaiting admin verification."
          : undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() }).select(
      "+password"
    );
    if (!user || !(await user.matchPassword(password || ""))) {
      return res.status(401).json({ message: "Wrong email or password" });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// POST /api/auth/forgot-password — email a one-time code if the account exists.
// Always responds the same way so it can't be used to probe which emails exist.
router.post("/forgot-password", async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ message: "Enter your email address" });
  const user = await User.findOne({ email }).select(
    "+resetOtpHash +resetOtpExpires +resetOtpAttempts"
  );
  if (user) {
    const otp = String(crypto.randomInt(100000, 1000000)); // secure 6-digit
    user.resetOtpHash = await bcrypt.hash(otp, 10);
    user.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    user.resetOtpAttempts = 0;
    await user.save();
    try {
      await sendMail({
        to: email,
        subject: "Your RaktaSetu password reset code",
        text: `Your one-time password is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
      });
    } catch (err) {
      // Don't leak send failures back to the caller; log for the operator.
      console.error("[forgot-password] mail send failed:", err.message);
    }
  }
  res.json({ message: "If that email is registered, a one-time password has been sent." });
});

// POST /api/auth/verify-otp — soft check so the UI can advance to the new-password
// step. The code is only cleared when the password is actually reset.
router.post("/verify-otp", async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  const user = await User.findOne({ email }).select(
    "+resetOtpHash +resetOtpExpires +resetOtpAttempts"
  );
  if (await checkOtp(user, req.body.otp)) return res.json({ ok: true });
  res.status(400).json({ message: "That code is wrong or expired. Try again." });
});

// POST /api/auth/reset-password — re-verify the OTP, then set the new password.
router.post("/reset-password", async (req, res) => {
  const email = (req.body.email || "").toLowerCase().trim();
  const { otp, newPassword } = req.body;
  const pwErr = passwordError(newPassword);
  if (pwErr) return res.status(400).json({ message: pwErr });
  const user = await User.findOne({ email }).select(
    "+resetOtpHash +resetOtpExpires +resetOtpAttempts"
  );
  if (!(await checkOtp(user, otp))) {
    return res.status(400).json({ message: "That code is wrong or expired. Try again." });
  }
  user.password = newPassword; // pre-save hook hashes it
  user.resetOtpHash = undefined;
  user.resetOtpExpires = undefined;
  user.resetOtpAttempts = 0;
  await user.save();
  res.json({ message: "Password updated. You can now log in." });
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PATCH /api/auth/availability  (donor toggles availability)
router.patch("/availability", protect, async (req, res) => {
  req.user.isAvailable = !!req.body.isAvailable;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
});

// PATCH /api/auth/role  (switch active mode between donor and requester)
// One account can both give and receive blood — no second profile needed.
router.patch("/role", protect, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["donor", "requester"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Only donor or requester accounts can switch modes" });
    }
    if (!["donor", "requester"].includes(role)) {
      return res.status(400).json({ message: "Mode must be donor or requester" });
    }
    if (!req.user.bloodGroup) {
      return res.status(400).json({ message: "Add your blood group before switching" });
    }
    req.user.role = role;
    await req.user.save();
    // Re-issue the token so its embedded role stays in sync.
    res.json({ token: signToken(req.user), user: publicUser(req.user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// PATCH /api/auth/profile  (edit own details)
router.patch("/profile", protect, async (req, res) => {
  try {
    const { name, phone, city, bloodGroup, hospitalName } = req.body;
    const u = req.user;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Name can't be empty" });
      if (!/^[A-Za-z\s]+$/.test(name.trim())) {
        return res
          .status(400)
          .json({ message: "Name can only contain letters and spaces" });
      }
      u.name = name.trim();
    }
    if (phone !== undefined) {
      const trimmed = phone.trim();
      if (trimmed && !/^\d{10}$/.test(trimmed)) {
        return res
          .status(400)
          .json({ message: "Phone number must be exactly 10 digits" });
      }
      u.phone = trimmed;
    }
    if (city !== undefined) {
      if (!city.trim()) return res.status(400).json({ message: "City can't be empty" });
      u.city = city.trim();
    }
    if (u.role !== "hospital" && bloodGroup !== undefined) {
      if (!BLOOD_GROUPS.includes(bloodGroup)) {
        return res.status(400).json({ message: "Invalid blood group" });
      }
      u.bloodGroup = bloodGroup;
    }
    if (u.role === "hospital" && hospitalName !== undefined) {
      if (!hospitalName.trim()) {
        return res.status(400).json({ message: "Hospital name can't be empty" });
      }
      u.hospitalName = hospitalName.trim();
    }

    await u.save();
    res.json({ user: publicUser(u) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;
