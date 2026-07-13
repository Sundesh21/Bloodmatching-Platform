import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["donor", "requester", "hospital", "admin"],
      required: true,
    },
    // Trust gate. Donors/requesters are "active" immediately; hospitals
    // start "pending" and an admin must approve them before they can
    // post stock or appear publicly.
    status: {
      type: String,
      enum: ["active", "pending", "rejected"],
      default: "active",
    },
    // Required for donors and requesters; hospitals track stock instead,
    // and admins have no blood group.
    bloodGroup: {
      type: String,
      enum: BLOOD_GROUPS,
      required: function () {
        return this.role === "donor" || this.role === "requester";
      },
    },
    phone: { type: String, trim: true },
    city: { type: String, required: true, trim: true, lowercase: true },
    // Optional coordinates for distance ranking. Registration doesn't collect
    // these yet, so donor matching falls back to city until it does.
    // ponytail: plain lat/lng + in-memory Haversine; add a 2dsphere index only
    // if the donor pool outgrows an in-memory scan.
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    // Donor-specific
    isAvailable: { type: Boolean, default: true },
    lastDonation: { type: Date, default: null },
    // Hospital-specific
    hospitalName: { type: String, trim: true },
    licenseNo: { type: String, trim: true }, // registration/license no. for admin review
    documentUrl: { type: String, trim: true }, // scanned registration/license, hosted on Cloudinary
    // Password-reset OTP (hashed, short-lived). Hidden by default.
    resetOtpHash: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12); // OWASP-recommended cost factor
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model("User", userSchema);
