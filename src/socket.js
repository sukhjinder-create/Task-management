// src/socket.js
import { io } from "socket.io-client";

let socket = null;

export function initSocket(token) {
  if (!token) return null;

  // Disconnect any existing socket
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("http://localhost:3000", {
    auth: { token },
    withCredentials: true,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

// ─────────────────────────────
// Chat channel helpers
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

// Typing indicator
export function sendTyping(channelId) {
  const s = getSocket();
  if (!s) return;
  if (!channelId) return;
  s.emit("chat:typing", { channelId });
}

// Read receipts
export function sendReadReceipt(channelId, at) {
  const s = getSocket();
  if (!s) return;
  if (!channelId) return;
  s.emit("chat:read", {
    channelId,
    at: at || new Date().toISOString(),
  });
}

// 🔥 Reactions
export function sendReaction(payload) {
  const s = getSocket();
  if (!s) return;
  s.emit("chat:reaction", payload);
}

// Huddles (signaling only – no audio implementation yet)
export function startHuddle(channelId, huddleId) {
  const s = getSocket();
  if (!s) return;
  if (!channelId || !huddleId) return;
  s.emit("huddle:start", { channelId, huddleId });
}

export function endHuddle(channelId, huddleId) {
  const s = getSocket();
  if (!s) return;
  if (!channelId || !huddleId) return;
  s.emit("huddle:end", { channelId, huddleId });
}

// ─────────────────────────────
// Presence helpers (for attendance)
// ─────────────────────────────

/**
 * status: "available" | "aws" | "lunch" | "offline" | "online" etc.
 */
export function sendPresenceStatus(status) {
  const s = getSocket();
  if (!s) return;
  s.emit("presence:set", status);
}
