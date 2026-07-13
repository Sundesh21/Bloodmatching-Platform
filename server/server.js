import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
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

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`API + socket server on http://localhost:${PORT}`));
