import { io } from "socket.io-client";

let socket = null;

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

/**
 * Create / re-create socket with JWT token from global window.__AUTH_TOKEN__
 *
 * Note: server authenticates by JWT token only. Workspace is taken from the token
 * payload server-side (we also set window.__WORKSPACE_ID__ for frontend convenience).
 */
function createSocket() {
  if (!window.__AUTH_TOKEN__) return null;

  // keep previous socket closed
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }

  socket = io(BACKEND_URL, {
    auth: { token: window.__AUTH_TOKEN__ },
    transports: ["websocket"],
    withCredentials: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 700,
  });

  return socket;
}

/* -------------------------------------------------
   Initialize socket manually (first login load)
------------------------------------------------- */
export function initSocket(token) {
  if (token) {
    window.__AUTH_TOKEN__ = token;
    // If token included workspace in stored auth, window.__WORKSPACE_ID__ may already be set.
  }

  // close previous
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }

  return createSocket();
}

/* -------------------------------------------------
   When token changes after login → re-auth socket
   (listening event is already used in app)
------------------------------------------------- */
window.addEventListener("auth:updated", () => {
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
  }
  createSocket();
});

/* -------------------------------------------------
   When user logs out → destroy socket
------------------------------------------------- */
window.addEventListener("auth:logout", () => {
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
  }
  socket = null;
  window.__AUTH_TOKEN__ = null;
  window.__WORKSPACE_ID__ = null;
});

export function getSocket() {
  return socket;
}

/* -------------------------------------------------
   CHAT ACTIONS
------------------------------------------------- */

export function joinChatChannel(channelId) {
  socket?.emit("chat:join", channelId);
}

export function leaveChatChannel(channelId) {
  socket?.emit("chat:leave", channelId);
}

export function sendChatMessage(payload) {
  socket?.emit("chat:message", payload);
}

export function sendTyping(channelId) {
  socket?.emit("chat:typing", { channelId });
}

export function sendReadReceipt(channelId, at) {
  socket?.emit("chat:read", { channelId, at: at || new Date().toISOString() });
}

export function sendReaction(payload) {
  socket?.emit("chat:reaction", payload);
}

/* -------------------------------------------------
   HUDDLE
------------------------------------------------- */

export function startHuddle(channelId, huddleId) {
  socket?.emit("huddle:start", { channelId, huddleId });
}

export function endHuddle(channelId, huddleId) {
  socket?.emit("huddle:end", { channelId, huddleId });
}

export function joinHuddle(channelId, huddleId) {
  socket?.emit("huddle:join", { channelId, huddleId });
}

export function leaveHuddle(channelId, huddleId) {
  socket?.emit("huddle:leave", { channelId, huddleId });
}

export function sendHuddleSignal(channelId, targetUserId, data) {
  socket?.emit("huddle:signal", { channelId, targetUserId, data });
}

/* -------------------------------------------------
   PRESENCE
------------------------------------------------- */
export function sendPresenceStatus(status) {
  socket?.emit("presence:set", status);
}
