import { Router } from "express";
import BloodRequest from "../models/BloodRequest.js";
import User from "../models/User.js";
import { protect, requireRole, blockUnverifiedHospital } from "../middleware/auth.js";
import { COMPATIBLE_DONORS, recipientsFor } from "../utils/compatibility.js";
import { daysUntilEligible } from "../utils/eligibility.js";

const router = Router();

// POST /api/requests — create a request and match donors in real time
router.post("/", protect, requireRole("requester", "hospital"), blockUnverifiedHospital, async (req, res) => {
  try {
    const { patientName, bloodGroup, unitsNeeded, city, urgency, note } = req.body;
    if (!patientName || !bloodGroup || !unitsNeeded || !city) {
      return res.status(400).json({ message: "Fill in all required fields" });
    }

    const request = await BloodRequest.create({
      requester: req.user._id,
      patientName,
      bloodGroup,
      unitsNeeded,
      city: city.toLowerCase(),
      urgency,
      note,
    });

    // Find compatible, available donors in the same city
    const donorGroups = COMPATIBLE_DONORS[bloodGroup] || [bloodGroup];
    const donors = await User.find({
      role: "donor",
      isAvailable: true,
      city: city.toLowerCase(),
      bloodGroup: { $in: donorGroups },
    }).select("name bloodGroup city phone");

    const io = req.app.get("io");
    const populated = await request.populate("requester", "name phone");

    // Push the request to each matching donor's private room, live
    donors.forEach((d) => {
      io.to(`user:${d._id}`).emit("request:new", {
        request: populated,
        matchedBecause: `Your ${d.bloodGroup} blood is compatible with a ${bloodGroup} patient in ${city}`,
      });
    });
    // Broadcast to the public feed (dashboards)
    io.emit("feed:new-request", populated);

    res.status(201).json({ request: populated, matchedDonorCount: donors.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/requests — open requests, filterable
router.get("/", protect, blockUnverifiedHospital, async (req, res) => {
  const { city, bloodGroup, mine } = req.query;
  const filter = {};
  if (mine === "true") filter.requester = req.user._id;
  else filter.status = "open";
  if (city) filter.city = city.toLowerCase();
  if (bloodGroup) filter.bloodGroup = bloodGroup;

  const requests = await BloodRequest.find(filter)
    .populate("requester", "name phone location")
    .populate("acceptedDonors.donor", "name bloodGroup phone location")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ requests });
});

// GET /api/requests/for-me — open requests this donor can serve
router.get("/for-me", protect, requireRole("donor"), async (req, res) => {
  // Recipient groups this donor's blood works for
  const canServe = recipientsFor(req.user.bloodGroup);

  const requests = await BloodRequest.find({
    status: "open",
    city: req.user.city,
    bloodGroup: { $in: canServe },
    requester: { $ne: req.user._id }, // never show a user their own request to donate to
  })
    .populate("requester", "name phone location")
    .sort({ urgency: 1, createdAt: -1 });
  res.json({ requests });
});

// GET /api/requests/accepted-by-me — requests this donor accepted, so they keep
// the requester's contact + location (and Maps navigation) after it's matched.
router.get("/accepted-by-me", protect, requireRole("donor"), async (req, res) => {
  const requests = await BloodRequest.find({
    "acceptedDonors.donor": req.user._id,
    status: { $in: ["matched", "fulfilled"] },
  })
    .populate("requester", "name phone city location")
    .populate("acceptedDonors.donor", "name bloodGroup phone location")
    .sort({ createdAt: -1 });
  res.json({ requests });
});

// POST /api/requests/:id/accept — donor accepts, requester notified live
router.post("/:id/accept", protect, requireRole("donor"), async (req, res) => {
  const request = await BloodRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });
  if (request.status !== "open" && request.status !== "matched") {
    return res.status(400).json({ message: "This request is no longer active" });
  }
  if (request.requester.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: "You can't accept your own request" });
  }
  // Enforce the 90-day donation gap — a donor who recently gave can't accept.
  const waitDays = daysUntilEligible(req.user.lastDonation);
  if (waitDays > 0) {
    return res
      .status(403)
      .json({ message: `You donated recently — not eligible to donate for ${waitDays} more day${waitDays === 1 ? "" : "s"}.` });
  }
  const already = request.acceptedDonors.some(
    (a) => a.donor.toString() === req.user._id.toString()
  );
  if (already) return res.status(400).json({ message: "You already accepted this request" });

  request.acceptedDonors.push({ donor: req.user._id });
  request.status = "matched";
  await request.save();
  const populated = await request.populate([
    { path: "requester", select: "name phone city location" },
    { path: "acceptedDonors.donor", select: "name bloodGroup phone location" },
  ]);

  const io = req.app.get("io");
  io.to(`user:${request.requester._id || request.requester}`).emit("request:accepted", {
    request: populated,
    donor: { name: req.user.name, bloodGroup: req.user.bloodGroup, phone: req.user.phone, city: req.user.city },
  });
  // Confirm back to the donor with who to reach and where.
  io.to(`user:${req.user._id}`).emit("request:you-accepted", {
    requester: {
      name: populated.requester?.name,
      phone: populated.requester?.phone,
      city: populated.requester?.city,
    },
  });
  io.emit("feed:update", populated);

  res.json({ request: populated });
});

// PATCH /api/requests/:id/status — requester fulfils/cancels their request
router.patch("/:id/status", protect, blockUnverifiedHospital, async (req, res) => {
  const { status, donorIds } = req.body;
  if (!["fulfilled", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Status must be fulfilled or cancelled" });
  }
  const request = await BloodRequest.findOne({
    _id: req.params.id,
    requester: req.user._id,
  });
  if (!request) return res.status(404).json({ message: "Request not found" });

  request.status = status;
  await request.save();

  // Stamp lastDonation only on the donors the requester confirms actually gave
  // blood — never everyone who merely volunteered. Restrict to this request's
  // accepted donors so a caller can't stamp arbitrary users.
  const io = req.app.get("io");
  if (status === "fulfilled" && Array.isArray(donorIds) && donorIds.length) {
    const accepted = new Set(request.acceptedDonors.map((a) => a.donor.toString()));
    const confirmed = donorIds.filter((id) => accepted.has(String(id)));
    if (confirmed.length) {
      const when = new Date();
      await User.updateMany({ _id: { $in: confirmed } }, { lastDonation: when });
      // Push the new eligibility clock to each credited donor so their UI
      // flips to "not eligible" without a reload.
      confirmed.forEach((id) => io.to(`user:${id}`).emit("donor:donated", { lastDonation: when }));
    }
  }

  io.emit("feed:update", request);
  res.json({ request });
});

export default router;
