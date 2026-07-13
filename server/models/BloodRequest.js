import mongoose from "mongoose";
import { BLOOD_GROUPS } from "./User.js";

const bloodRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patientName: { type: String, required: true, trim: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    unitsNeeded: { type: Number, required: true, min: 1, max: 20 },
    city: { type: String, required: true, trim: true, lowercase: true },
    urgency: {
      type: String,
      enum: ["critical", "urgent", "standard"],
      default: "standard",
    },
    note: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["open", "matched", "fulfilled", "cancelled"],
      default: "open",
    },
    // Donors who accepted this request
    acceptedDonors: [
      {
        donor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        acceptedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

bloodRequestSchema.index({ status: 1, city: 1, bloodGroup: 1 });

export default mongoose.model("BloodRequest", bloodRequestSchema);
