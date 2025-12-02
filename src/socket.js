// src/socket.js
import { io } from "socket.io-client";

let socket = null;

export function initSocket(token) {
  if (!token) return;

  // disconnect any existing socket
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("http://localhost:3000", {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Optional convenience helpers for future chat/presence usage.
 * You don't *have* to use them – you can still call getSocket().emit(...) directly.
 */

export function joinChatChannel(channelId) {
  const s = getSocket();
  if (!s || !channelId) return;
  s.emit("chat:join", channelId);
}

export function leaveChatChannel(channelId) {
  const s = getSocket();
  if (!s || !channelId) return;
  s.emit("chat:leave", channelId);
}

export function sendChatMessage({ channelId, text, tempId }) {
  const s = getSocket();
  if (!s || !channelId || !text) return;
  s.emit("chat:message", { channelId, text, tempId });
}

export function setPresenceStatus(status) {
  const s = getSocket();
  if (!s || !status) return;
  s.emit("presence:set", status);
}
