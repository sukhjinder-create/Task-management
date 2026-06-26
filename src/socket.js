import { io } from "socket.io-client";
import { resolveLiveKitCanaryConfig } from "./huddle/media/LiveKitCanary";
import { createWebHuddleClientCapabilities } from "./huddle/media/clientCapabilities";
import {
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PROVIDER_MESH,
} from "./huddle/media/mediaState";

let socket = null;

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

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
    } catch {
      // Best-effort socket cleanup during reconnect.
    }
    socket = null;
  }

  socket = io(BACKEND_URL, {
    auth: { token: window.__AUTH_TOKEN__ },
    transports: ["websocket", "polling"],
    withCredentials: true,
    timeout: 10000,
    reconnectionAttempts: 15,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });

  // When superadmin changes this workspace's plan, re-fetch plan features
  socket.on("workspace:plan_updated", (data) => {
    window.dispatchEvent(new CustomEvent("plan:updated", { detail: data }));
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
    } catch {
      // Best-effort socket cleanup during re-auth.
    }
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
    } catch {
      // Best-effort socket cleanup during auth refresh.
    }
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
    } catch {
      // Best-effort socket cleanup during logout.
    }
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

/**
 * Send a chat message via socket with optional ack callback.
 * The server calls ack({ ok: true, tempId }) once the message is persisted.
 * Returns true if the socket is connected and the emit was attempted.
 */
export function sendChatMessage(payload, ack) {
  if (!socket?.connected) return false;
  if (typeof ack === "function") {
    socket.emit("chat:message", payload, ack);
  } else {
    socket.emit("chat:message", payload);
  }
  return true;
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

function createHuddleMediaSocketPayload(options = {}) {
  const requestedProvider = options.provider || options.providerType || null;
  const explicitLiveKitRequest =
    String(requestedProvider || "").trim().toLowerCase() ===
    HUDDLE_MEDIA_PROVIDER_LIVEKIT;
  const canary = resolveLiveKitCanaryConfig({
    requestedProvider,
    workspaceId: options.workspaceId || window.__WORKSPACE_ID__ || null,
  });
  const provider = explicitLiveKitRequest || canary.providerCanActivate
    ? HUDDLE_MEDIA_PROVIDER_LIVEKIT
    : HUDDLE_MEDIA_PROVIDER_MESH;

  if (provider !== HUDDLE_MEDIA_PROVIDER_LIVEKIT) return {};

  const clientCapabilities = createWebHuddleClientCapabilities({ provider });
  return {
    provider,
    platform: clientCapabilities.platform,
    clientCapabilities,
  };
}

export function startHuddle(channelId, huddleId, options = {}) {
  socket?.emit("huddle:start", {
    channelId,
    huddleId,
    ...createHuddleMediaSocketPayload(options),
  });
}

export function endHuddle(channelId, huddleId) {
  socket?.emit("huddle:end", { channelId, huddleId });
}

export function joinHuddle(channelId, huddleId, options = {}) {
  socket?.emit("huddle:join", {
    channelId,
    huddleId,
    ...createHuddleMediaSocketPayload(options),
  });
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
