import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5001";

let socket = null;

// (Re)connect with the current auth token so the server can
// join this user to their private room for live matches.
export function connectSocket() {
  if (socket) socket.disconnect();
  socket = io(URL, {
    auth: { token: localStorage.getItem("bl_token") || undefined },
  });
  return socket;
}

export function getSocket() {
  return socket || connectSocket();
}

// Subscribe to live connection status (true = online, false = offline).
// Fires immediately with the current state, then on every change.
// Returns an unsubscribe function.
export function onConnectionChange(cb) {
  const s = getSocket();
  cb(s.connected);
  const online = () => cb(true);
  const offline = () => cb(false);
  s.on("connect", online);
  s.on("disconnect", offline);
  s.io.on("reconnect", online);
  return () => {
    s.off("connect", online);
    s.off("disconnect", offline);
    s.io.off("reconnect", online);
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
