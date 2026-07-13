// Weighted donor ranking. One sort replaces the 5→10→20km→city→…→province
// ladder: distance and locality feed a continuous score, so the nearest
// eligible donor floats to the top on its own — no re-querying per radius.
//
// Weights are ordered by the spec's priority (city > distance > available >
// eligible > verified > recent > acceptance). Hand-tuned constants.
// ponytail: flat weights, promote to config only if product wants to tune live.
const W = {
  sameCity: 100,
  proximity: 80, // only contributes when both sides have coordinates
  available: 50,
  eligible: 40,
  verified: 25,
  recentlyActive: 15,
  acceptance: 10,
};

const DONATION_INTERVAL_DAYS = 90; // whole-blood eligibility gap
const DAY = 86_400_000;

// Great-circle distance in km. Standard Haversine.
export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Score one donor against a request. `ref` is the search reference:
// { city, lat?, lng? }. `now` is injectable for testability.
export function scoreDonor(donor, ref, acceptCount = 0, now = Date.now()) {
  let score = 0;

  if (ref.city && donor.city === ref.city.toLowerCase()) score += W.sameCity;

  if (ref.lat != null && ref.lng != null && donor.location?.lat != null) {
    const km = haversineKm(ref, donor.location);
    // 1 at the doorstep, 0 by 50km. ponytail: linear is plenty; swap for a
    // decay curve only if ranking feels off in the field.
    score += W.proximity * Math.max(0, 1 - km / 50);
  }

  if (donor.isAvailable) score += W.available;

  const sinceDonation = donor.lastDonation
    ? (now - new Date(donor.lastDonation).getTime()) / DAY
    : Infinity;
  if (sinceDonation >= DONATION_INTERVAL_DAYS) score += W.eligible;

  if (donor.status === "active") score += W.verified;

  const idleDays = (now - new Date(donor.updatedAt).getTime()) / DAY;
  score += W.recentlyActive * Math.max(0, 1 - idleDays / 180);

  // No "offered vs accepted" is tracked, so raw accept count is the only
  // reliability signal. Saturates at 5. ponytail: real accept-rate needs an
  // offered-count on the donor; add when that data exists.
  score += W.acceptance * (Math.min(acceptCount, 5) / 5);

  return score;
}

// Rank a candidate pool (already filtered to compatible blood groups).
// `acceptByDonor` maps donorId -> accept count.
export function rankDonors(donors, ref, acceptByDonor = {}, now = Date.now()) {
  return donors
    .map((d) => ({
      donor: d,
      score: scoreDonor(d, ref, acceptByDonor[String(d._id)] || 0, now),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ donor, score }) => ({ ...toPlain(donor), matchScore: Math.round(score) }));
}

function toPlain(d) {
  return typeof d.toObject === "function" ? d.toObject() : d;
}

// --- self-check: node donorMatch.js ---
if (process.argv[1] && process.argv[1].endsWith("donorMatch.js")) {
  const assert = (c, m) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  const NOW = Date.UTC(2026, 0, 1);
  const old = new Date(NOW - 200 * DAY); // eligible + stale

  // Kathmandu ~ Patan is a few km; Pokhara is ~140km away.
  const ktm = { lat: 27.7172, lng: 85.324 };
  const near = { location: { lat: 27.6733, lng: 85.325 }, city: "lalitpur", isAvailable: true, lastDonation: old, status: "active", updatedAt: new Date(NOW) };
  const far = { location: { lat: 28.2096, lng: 83.9856 }, city: "pokhara", isAvailable: true, lastDonation: old, status: "active", updatedAt: new Date(NOW) };
  const ref = { city: "kathmandu", ...ktm };

  assert(scoreDonor(near, ref, 0, NOW) > scoreDonor(far, ref, 0, NOW), "closer donor should outrank farther");

  // Availability and eligibility each move the needle.
  const base = { city: "x", updatedAt: new Date(NOW), status: "active" };
  assert(scoreDonor({ ...base, isAvailable: true }, {}, 0, NOW) > scoreDonor({ ...base, isAvailable: false }, {}, 0, NOW), "available should outrank unavailable");
  const recent = new Date(NOW - 10 * DAY); // too soon to donate again
  assert(scoreDonor({ ...base, lastDonation: old }, {}, 0, NOW) > scoreDonor({ ...base, lastDonation: recent }, {}, 0, NOW), "eligible should outrank recently-donated");

  // City match dominates when no coords.
  assert(scoreDonor({ ...base, city: "kathmandu" }, { city: "Kathmandu" }, 0, NOW) > scoreDonor({ ...base, city: "pokhara" }, { city: "Kathmandu" }, 0, NOW), "same-city should outrank other-city");

  assert(Math.round(haversineKm(ktm, ktm)) === 0, "distance to self is 0");

  console.log("donorMatch self-check passed");
}
