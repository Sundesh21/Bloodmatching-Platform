import mongoose from "mongoose";
import { BLOOD_GROUPS } from "./User.js";

const inventorySchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    unitsAvailable: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

// One row per hospital + blood group
inventorySchema.index({ hospital: 1, bloodGroup: 1 }, { unique: true });

export default mongoose.model("Inventory", inventorySchema);
