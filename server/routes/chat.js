import { Router } from "express";
import { protect } from "../middleware/auth.js";
import Inventory from "../models/Inventory.js";
import BloodRequest from "../models/BloodRequest.js";
import User from "../models/User.js";
import { fallbackReply } from "../utils/fallbackBot.js";

const router = Router();

// Live platform data injected into every answer so the bot never
// invents stock numbers or donor counts.
async function gatherContext(user) {
  const [summary, openRequests, donorCounts] = await Promise.all([
    Inventory.aggregate([
      { $group: { _id: "$bloodGroup", totalUnits: { $sum: "$unitsAvailable" } } },
      { $sort: { _id: 1 } },
    ]),
    BloodRequest.countDocuments({ status: "open" }),
    User.aggregate([
      { $match: { role: "donor", isAvailable: true, city: user.city } },
      { $group: { _id: "$bloodGroup", count: { $sum: 1 } } },
    ]),
  ]);
  return { summary, openRequests, donorCounts };
}

// POST /api/chat  { messages: [{ role: "user"|"assistant", content: "..." }] }
router.post("/", protect, async (req, res) => {
  try {
    const messages = (req.body.messages || [])
      .filter((m) => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-12); // keep the request small
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return res.status(400).json({ message: "Send at least one user message" });

    const ctx = await gatherContext(req.user);

    // No API key configured -> deterministic built-in assistant
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ reply: fallbackReply(lastUser.content, ctx), source: "builtin" });
    }

    const system = `You are the help assistant inside RaktaSetu, a blood donation platform.
The person you are talking to is a ${req.user.role} named ${req.user.name} in ${req.user.city}.

LIVE PLATFORM DATA (the only source you may use for numbers):
- Total units per blood group across registered hospitals: ${JSON.stringify(ctx.summary)}
- Open blood requests right now: ${ctx.openRequests}
- Available donors in ${req.user.city} by group: ${JSON.stringify(ctx.donorCounts)}

RULES:
- Answer questions about blood group compatibility using the standard ABO/Rh red-cell table.
- For stock or donor numbers, use ONLY the live data above. If it doesn't contain the answer, say so and point to the "Hospital stock" or "Find donors" page.
- How the app works: requesters create a request; compatible available donors in the same city get a real-time notification; donors click "I can donate" to share contact details; hospitals manage stock on the "My stock" page.
- Never decide whether someone is medically eligible to donate or receive blood, never give dosing/transfusion instructions — direct those questions to the blood bank or a clinician.
- Keep answers short (2-4 sentences) and concrete.`;

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
        max_tokens: 500,
        system,
        messages,
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("Anthropic API error:", apiRes.status, errBody);
      // Degrade gracefully instead of breaking the widget
      return res.json({ reply: fallbackReply(lastUser.content, ctx), source: "builtin" });
    }

    const data = await apiRes.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    res.json({ reply: reply || "Sorry, I couldn't produce an answer. Try rephrasing?", source: "claude" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;
