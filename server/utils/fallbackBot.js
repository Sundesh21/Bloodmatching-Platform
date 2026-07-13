// Deterministic fallback used when no ANTHROPIC_API_KEY is configured.
// Answers only from the compatibility table and live DB context passed in —
// it never invents stock numbers or medical advice.
import { COMPATIBLE_DONORS, recipientsFor } from "./compatibility.js";
import { BLOOD_GROUPS } from "../models/User.js";

function findBloodGroup(text) {
  // Match longest first so "AB+" isn't read as "B+"
  const ordered = ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"];
  const upper = text.toUpperCase().replace(/\s+/g, " ");
  return ordered.find(
    (bg) => upper.includes(bg) || upper.includes(bg.replace("+", " POSITIVE").replace("-", " NEGATIVE"))
  );
}

export function fallbackReply(userText, ctx) {
  const text = userText.toLowerCase();
  const bg = findBloodGroup(userText);

  // Stock / availability questions — answered from live DB context only
  if (/(stock|unit|available|availability|inventory|hospital)/.test(text)) {
    if (bg) {
      const total = ctx.summary.find((s) => s._id === bg)?.totalUnits ?? 0;
      return `Hospitals on RaktaSetu currently report ${total} unit${total === 1 ? "" : "s"} of ${bg} in total. See the "Hospital stock" page for the per-hospital breakdown — it updates live.`;
    }
    const lines = BLOOD_GROUPS.map((g) => {
      const t = ctx.summary.find((s) => s._id === g)?.totalUnits ?? 0;
      return `${g}: ${t}`;
    }).join(", ");
    return `Current units across all registered hospitals — ${lines}. The "Hospital stock" page shows which hospital holds what.`;
  }

  // Compatibility questions
  if (/(compatib|donate to|receive|who can|match)/.test(text) && bg) {
    const donors = COMPATIBLE_DONORS[bg].join(", ");
    const recipients = recipientsFor(bg).join(", ");
    return `${bg} patients can receive red cells from: ${donors}. ${bg} donors can give to: ${recipients}. This is the standard ABO/Rh red-cell table; the hospital always runs its own cross-match before any transfusion.`;
  }

  // How to request
  if (/(request|need blood|how.*(get|find) blood)/.test(text)) {
    return `To request blood: use "Request blood" in the menu, enter the patient's name, blood group, units, and city. Every available, compatible donor in that city is notified instantly, and you'll get a live alert when someone accepts.`;
  }

  // Eligibility / medical — always defer. Must run BEFORE the generic
  // donate branch, since these questions usually contain "donate" too.
  if (/(eligib|can i donate|medic|health|safe|pregnan|tattoo|medication|weight|age)/.test(text)) {
    return `Eligibility depends on your health, medications, and local blood-bank rules, so I can't decide that for you — the screening staff at the donation center will. General criteria are usually a minimum age, minimum weight, and a gap of about 8–12 weeks between whole-blood donations, but confirm with your local blood bank.`;
  }

  // How to donate
  if (/(donate|donor|volunteer|give blood)/.test(text)) {
    return `As a donor, matching requests in your city appear on your dashboard the moment they're posted. Click "I can donate" to share your contact with the requester. Use the availability toggle if you need a break. Whether you're medically eligible to donate on a given day is decided by the blood bank staff, not this app.`;
  }

  return `I can help with: blood group compatibility (e.g. "who can donate to A+?"), current hospital stock (e.g. "how many O- units are available?"), and how to request or donate on RaktaSetu. What would you like to know?`;
}
