import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Not logged in" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired, log in again" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Only ${roles.join(" or ")} accounts can do this` });
    }
    next();
  };
}

function hospitalStatusMessage(status) {
  return status === "rejected"
    ? "Your hospital account was not approved. Contact the administrator."
    : "Your hospital account is awaiting admin verification.";
}

// A hospital that an admin has approved. Blocks pending/rejected hospitals
// from posting stock even though their role is "hospital".
export function requireVerifiedHospital(req, res, next) {
  if (req.user.role !== "hospital") {
    return res.status(403).json({ message: "Only hospital accounts can do this" });
  }
  if (req.user.status !== "active") {
    return res.status(403).json({ message: hospitalStatusMessage(req.user.status) });
  }
  next();
}

// Gate for anything donor/requester-facing (posting requests, browsing donors,
// accepting/updating requests) — a hospital account must be admin-verified
// before it can touch these at all, not just before posting stock. Other
// roles pass straight through untouched.
export function blockUnverifiedHospital(req, res, next) {
  if (req.user.role === "hospital" && req.user.status !== "active") {
    return res.status(403).json({ message: hospitalStatusMessage(req.user.status) });
  }
  next();
}
