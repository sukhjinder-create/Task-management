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
