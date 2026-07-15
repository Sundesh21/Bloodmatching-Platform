import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bl_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Days a donor must still wait before donating again (90-day whole-blood gap).
// 0 = eligible now. Mirrors server/utils/eligibility.js.
export const DONATION_INTERVAL_DAYS = 90;
export function daysUntilEligible(lastDonation, now = Date.now()) {
  if (!lastDonation) return 0;
  const elapsed = (now - new Date(lastDonation).getTime()) / 86400000;
  return Math.max(0, Math.ceil(DONATION_INTERVAL_DAYS - elapsed));
}

// Uploads a file straight from the browser to Cloudinary using an unsigned
// upload preset, so no API secret is ever exposed to the client. Returns the
// hosted file's secure_url (e.g. the hospital's scanned verification form).
export async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset || cloudName === "your-cloud-name") {
    throw new Error("Cloudinary isn't configured yet — ask the site admin to set it up.");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
}

export default api;
