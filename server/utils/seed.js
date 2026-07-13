// Seeds two demo hospitals with stock and a few donors.
// Run with: npm run seed   (from the server/ folder, after setting up .env)
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User, { BLOOD_GROUPS } from "../models/User.js";
import Inventory from "../models/Inventory.js";

await connectDB();

const hospitals = [
  { name: "City General", email: "citygeneral@demo.com", hospitalName: "City General Hospital", city: "pokhara" },
  { name: "Lakeside Medical", email: "lakeside@demo.com", hospitalName: "Lakeside Medical Center", city: "pokhara" },
];

const donors = [
  { name: "Aarav Sharma", email: "aarav@demo.com", bloodGroup: "O-", city: "pokhara", phone: "980-000-0001" },
  { name: "Sita Gurung", email: "sita@demo.com", bloodGroup: "A+", city: "pokhara", phone: "980-000-0002" },
  { name: "Bikash Thapa", email: "bikash@demo.com", bloodGroup: "B+", city: "pokhara", phone: "980-000-0003" },
];

for (const h of hospitals) {
  let user = await User.findOne({ email: h.email });
  if (!user) {
    // Demo hospitals are pre-verified so their stock shows immediately.
    user = await User.create({ ...h, password: "password123", role: "hospital", status: "active" });
    console.log(`Created hospital ${h.hospitalName} (${h.email} / password123)`);
  }
  for (const bg of BLOOD_GROUPS) {
    await Inventory.findOneAndUpdate(
      { hospital: user._id, bloodGroup: bg },
      { unitsAvailable: Math.floor(Math.random() * 12) },
      { upsert: true }
    );
  }
}

for (const d of donors) {
  const exists = await User.findOne({ email: d.email });
  if (!exists) {
    await User.create({ ...d, password: "password123", role: "donor" });
    console.log(`Created donor ${d.name} (${d.email} / password123)`);
  }
}

console.log("Seed complete.");
await mongoose.connection.close();
