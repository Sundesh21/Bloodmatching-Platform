// Whole-blood donors must wait 90 days between donations. Single source of
// truth for the gap so the matcher, the accept guard, and the UI agree.
export const DONATION_INTERVAL_DAYS = 90;
const DAY = 86_400_000;

// Days a donor still has to wait before they may donate again. 0 = eligible now.
export function daysUntilEligible(lastDonation, now = Date.now()) {
  if (!lastDonation) return 0;
  const elapsed = (now - new Date(lastDonation).getTime()) / DAY;
  return Math.max(0, Math.ceil(DONATION_INTERVAL_DAYS - elapsed));
}
