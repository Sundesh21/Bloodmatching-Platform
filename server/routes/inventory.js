import { Router } from "express";
import Inventory from "../models/Inventory.js";
import { protect, requireRole, requireVerifiedHospital } from "../middleware/auth.js";

const router = Router();

// GET /api/inventory — public view of blood available across hospitals
// Optional filters: ?bloodGroup=O-&city=pokhara
router.get("/", protect, async (req, res) => {
  const { bloodGroup, city } = req.query;
  const filter = {};
  if (bloodGroup) filter.bloodGroup = bloodGroup;

  let items = await Inventory.find(filter)
    .populate("hospital", "hospitalName name city phone status")
    .sort({ bloodGroup: 1 });

  // Only show stock from verified hospitals — never fake/pending ones.
  items = items.filter((i) => i.hospital?.status === "active");

  if (city) {
    items = items.filter((i) => i.hospital?.city === city.toLowerCase());
  }
  res.json({ inventory: items });
});

// GET /api/inventory/summary — total units per blood group across all hospitals
router.get("/summary", protect, async (req, res) => {
  const summary = await Inventory.aggregate([
    // Join the owning hospital so we can drop unverified ones.
    { $lookup: { from: "users", localField: "hospital", foreignField: "_id", as: "hospital" } },
    { $unwind: "$hospital" },
    { $match: { "hospital.status": "active" } },
    { $group: { _id: "$bloodGroup", totalUnits: { $sum: "$unitsAvailable" } } },
    { $sort: { _id: 1 } },
  ]);
  res.json({ summary });
});

// PUT /api/inventory — hospital sets stock for one blood group
router.put("/", protect, requireVerifiedHospital, async (req, res) => {
  const { bloodGroup, unitsAvailable } = req.body;
  if (!bloodGroup || unitsAvailable == null || unitsAvailable < 0) {
    return res.status(400).json({ message: "Provide a blood group and a unit count of 0 or more" });
  }
  const item = await Inventory.findOneAndUpdate(
    { hospital: req.user._id, bloodGroup },
    { unitsAvailable },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Live-update every open dashboard
  req.app.get("io").emit("inventory:update", {
    hospitalId: req.user._id,
    hospitalName: req.user.hospitalName || req.user.name,
    bloodGroup,
    unitsAvailable: item.unitsAvailable,
  });

  res.json({ item });
});

// GET /api/inventory/mine — hospital's own stock
router.get("/mine", protect, requireRole("hospital"), async (req, res) => {
  const items = await Inventory.find({ hospital: req.user._id }).sort({ bloodGroup: 1 });
  res.json({ inventory: items });
});

export default router;
