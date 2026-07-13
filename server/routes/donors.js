import { Router } from "express";
import User from "../models/User.js";
import BloodRequest from "../models/BloodRequest.js";
import { protect, blockUnverifiedHospital } from "../middleware/auth.js";
import { COMPATIBLE_DONORS } from "../utils/compatibility.js";
import { rankDonors } from "../utils/donorMatch.js";

const router = Router();

// GET /api/donors?bloodGroup=A+&city=pokhara&lat=27.7&lng=85.3
// Hard filter: compatible blood groups only. Everything else (city, distance,
// availability, eligibility, verification, recency, accepts) is weighted into
// a score so the best match sorts to the top — no per-radius re-querying.
router.get("/", protect, blockUnverifiedHospital, async (req, res) => {
  const { bloodGroup, city, lat, lng } = req.query;

  const filter = { role: "donor" };
  if (bloodGroup) {
    filter.bloodGroup = { $in: COMPATIBLE_DONORS[bloodGroup] || [bloodGroup] };
  }

  const donors = await User.find(filter)
    .select("name bloodGroup city phone lastDonation isAvailable status location updatedAt")
    .limit(500);

  // One aggregation for accept counts across just this candidate pool.
  const ids = donors.map((d) => d._id);
  const accepts = await BloodRequest.aggregate([
    { $unwind: "$acceptedDonors" },
    { $match: { "acceptedDonors.donor": { $in: ids } } },
    { $group: { _id: "$acceptedDonors.donor", n: { $sum: 1 } } },
  ]);
  const acceptByDonor = Object.fromEntries(accepts.map((a) => [String(a._id), a.n]));

  const ref = { city, lat: lat != null ? Number(lat) : undefined, lng: lng != null ? Number(lng) : undefined };
  res.json({ donors: rankDonors(donors, ref, acceptByDonor).slice(0, 200) });
});

export default router;
