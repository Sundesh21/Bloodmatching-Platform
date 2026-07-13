import { Router } from "express";
import User from "../models/User.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = Router();

// Everything here is admin-only.
router.use(protect, requireRole("admin"));

function hospitalView(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    hospitalName: u.hospitalName,
    licenseNo: u.licenseNo,
    documentUrl: u.documentUrl,
    city: u.city,
    phone: u.phone,
    status: u.status,
    createdAt: u.createdAt,
  };
}

// GET /api/admin/hospitals?status=pending — hospitals to review (default: pending)
router.get("/hospitals", async (req, res) => {
  const status = req.query.status || "pending";
  const filter = { role: "hospital" };
  if (status !== "all") filter.status = status;
  const hospitals = await User.find(filter).sort({ createdAt: -1 });
  res.json({ hospitals: hospitals.map(hospitalView) });
});

// PATCH /api/admin/hospitals/:id  { status: "active" | "rejected" }
router.patch("/hospitals/:id", async (req, res) => {
  const { status } = req.body;
  if (!["active", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Status must be active or rejected" });
  }
  const hospital = await User.findOne({ _id: req.params.id, role: "hospital" });
  if (!hospital) return res.status(404).json({ message: "Hospital not found" });

  hospital.status = status;
  await hospital.save();

  // Tell the hospital live if they're currently connected.
  req.app
    .get("io")
    .to(`user:${hospital._id}`)
    .emit("account:status", { status });

  res.json({ hospital: hospitalView(hospital) });
});

export default router;
