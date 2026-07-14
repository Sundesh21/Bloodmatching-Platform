import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import requestRoutes from "./routes/requests.js";
import donorRoutes from "./routes/donors.js";
import inventoryRoutes from "./routes/inventory.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";

await connectDB();

const app = express();
const server = http.createServer(app);

// In dev, Vite may bind to a different port than 5173 if it's already taken,
// so accept any localhost/127.0.0.1 origin instead of a single hardcoded one.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
// Any Vercel deployment of this project — production, git-branch, and preview
// URLs all match, so new deploys don't need re-whitelisting each time.
const VERCEL_ORIGIN = /^https:\/\/bloodmatching-platform[a-z0-9-]*\.vercel\.app$/;
// Extra exact origins (e.g. a custom domain): comma-separated in CLIENT_ORIGIN.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const corsOrigin = (origin, callback) => {
  if (
    !origin ||
    LOCALHOST_ORIGIN.test(origin) ||
    VERCEL_ORIGIN.test(origin) ||
    allowedOrigins.includes(origin)
  ) {
    return callback(null, true);
  }
  callback(new Error("Not allowed by CORS"));
};

const io = new Server(server, {
  cors: { origin: corsOrigin },
});
app.set("io", io);

// Each logged-in socket joins a private room `user:<id>`
// so the server can push matches directly to that person.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // allow anonymous sockets for the public feed
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
  } catch {
    /* invalid token -> treat as anonymous */
  }
  next();
});

io.on("connection", (socket) => {
  if (socket.userId) socket.join(`user:${socket.userId}`);
});

app.use(helmet()); // sets security headers (XSS, clickjacking, MIME-sniffing, etc.)
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" })); // cap body size so a giant payload can't OOM us
app.use(mongoSanitize()); // strip $ and . operators from input -> blocks NoSQL query injection

// Global brute-force / flood guard. Auth endpoints get a stricter one below.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
// Tight limit on credential endpoints: 10 tries per 15 min per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again." },
});
app.use("/api", globalLimiter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
// Strict limiter only on the unauthenticated credential endpoints — NOT the whole
// router, since /auth/me runs on every page load and would trip a tight limit.
for (const p of ["login", "register", "forgot-password", "verify-otp", "reset-password"]) {
  app.use(`/api/auth/${p}`, authLimiter);
}
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`API + socket server on http://localhost:${PORT}`));
