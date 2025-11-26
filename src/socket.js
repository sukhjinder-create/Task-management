// src/socket.js
import { io } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket = null;

/**
 * Initialize a singleton Socket.IO client.
 * Call this once after login with a valid JWT token.
 */
export function initSocket(token) {
  if (socket) return socket;

  socket = io(API_BASE_URL, {
    auth: { token },
    autoConnect: true,
  });

  return socket;
}

/**
 * Get existing socket instance (may be null if not initialized yet).
 */
export function getSocket() {
  return socket;
}
