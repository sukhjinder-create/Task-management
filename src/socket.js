// src/socket.js
import { io } from "socket.io-client";

let socket = null;

// read backend URL from Vite env
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export function initSocket(token) {
  if (!token) return null;

  // Close previous socket before creating a new one
  if (socket) {
    try {
      socket.disconnect();
    } catch (err) {
      console.warn("Previous socket disconnect failed:", err);
    }
    socket = null;
  }

  // Create new connection
  socket = io(BACKEND_URL, {
    auth: { token },
    withCredentials: true,
    transports: ["websocket"],   // no polling loops
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

// ─────────────────────────────
// CHAT HELPERS
// ─────────────────────────────

export function joinChatChannel(channelId) {
  const s = getSocket();
  if (!s) return;
  s.emit("chat:join", channelId);
}

export function leaveChatChannel(channelId) {
  const s = getSocket();
  if (!s) return;
  s.emit("chat:leave", channelId);
}

export function sendChatMessage(payload) {
  const s = getSocket();
  if (!s) return;
  s.emit("chat:message", payload);
}

export function sendTyping(channelId) {
  const s = getSocket();
  if (!s || !channelId) return;
  s.emit("chat:typing", { channelId });
}

export function sendReadReceipt(channelId, at) {
  const s = getSocket();
  if (!s || !channelId) return;
  s.emit("chat:read", {
    channelId,
    at: at || new Date().toISOString(),
  });
}

// ─────────────────────────────
// REACTIONS
// ─────────────────────────────

export function sendReaction(payload) {
  const s = getSocket();
  if (!s) return;
  s.emit("chat:reaction", payload);
}

// ─────────────────────────────
// HUDDLES (DB-backed + Manual Join)
// ─────────────────────────────

// The user who starts a huddle
export function startHuddle(channelId, huddleId) {
  const s = getSocket();
  if (!s || !channelId || !huddleId) return;
  s.emit("huddle:start", { channelId, huddleId });
}

// The owner or system ends the huddle
export function endHuddle(channelId, huddleId) {
  const s = getSocket();
  if (!s || !channelId || !huddleId) return;
  s.emit("huddle:end", { channelId, huddleId });
}

// WebRTC signaling: to single target user
export function sendHuddleSignal(channelId, targetUserId, data) {
  const s = getSocket();
  if (!s || !channelId || !targetUserId || !data) return;
  s.emit("huddle:signal", { channelId, targetUserId, data });
}

// User joins the huddle manually
export function joinHuddle(channelId, huddleId) {
  const s = getSocket();
  if (!s) return;
  s.emit("huddle:join", { channelId, huddleId });
}

// User leaves the huddle
export function leaveHuddle(channelId, huddleId) {
  const s = getSocket();
  if (!s) return;
  s.emit("huddle:leave", { channelId, huddleId });
}

// ─────────────────────────────
// PRESENCE
// ─────────────────────────────

export function sendPresenceStatus(status) {
  const s = getSocket();
  if (!s) return;
  s.emit("presence:set", status);
}
