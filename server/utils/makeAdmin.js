// Promote an existing user to platform admin, or create a fresh admin.
// Admins are never self-serve via signup — this script is the only way in.
//
//   Promote an existing account:  npm run make-admin -- you@example.com
//   Create a brand-new admin:     npm run make-admin -- admin@example.com "Your Name" yourpassword
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const [email, name, password] = process.argv.slice(2);

if (!email) {
  console.error('Usage: npm run make-admin -- <email> ["Full Name" <password>]');
  process.exit(1);
}

await connectDB();

let user = await User.findOne({ email: email.toLowerCase() });

if (user) {
  user.role = "admin";
  user.status = "active";
  await user.save();
  console.log(`✓ ${user.email} is now an admin.`);
} else {
  if (!name || !password) {
    console.error(
      `No user with email ${email}. To create one, pass a name and password:\n` +
        `  npm run make-admin -- ${email} "Full Name" yourpassword`
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  user = await User.create({
    name,
    email,
    password,
    role: "admin",
    status: "active",
    city: "n/a", // required by the schema but unused for admins
  });
  console.log(`✓ Created admin ${user.email}. Log in with the password you provided.`);
}

await mongoose.disconnect();
process.exit(0);
