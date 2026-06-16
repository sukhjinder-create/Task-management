import {
  HUDDLE_MEDIA_CONNECTION_STATES,
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PROVIDER_MESH,
} from "./mediaState";
import api from "../../api";
import { createWebHuddleClientCapabilities } from "./clientCapabilities";
import {
  LIVEKIT_SDK_STATUSES,
  createLiveKitSdkDiagnostics,
  loadLiveKitSdk,
} from "./LiveKitSdk";
import { elapsedMs, metricNow } from "./providerDiagnostics";

export const LIVEKIT_CONNECTION_REASONS = Object.freeze({
  CANARY_DISABLED: "livekit_canary_disabled",
  WORKSPACE_NOT_ENABLED: "livekit_workspace_not_enabled",
  RUNTIME_NOT_READY: "livekit_runtime_not_ready",
  SDK_UNAVAILABLE: "livekit_sdk_unavailable",
  ROOM_ENDPOINT_FAILED: "livekit_room_endpoint_failed",
  TOKEN_ENDPOINT_FAILED: "livekit_token_endpoint_failed",
  CONNECTION_FAILED: "livekit_connection_failed",
  CONNECTION_NOT_IMPLEMENTED: "livekit_connection_not_implemented",
});

const LIVEKIT_DISABLED_ROOM_STATE = "disabled";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

const LIVEKIT_ORIGIN_CACHE_KEY = "huddle.livekit.preconnectOrigin";

export function liveKitHttpsOrigin(url) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol === "wss:" ? "https:" : parsed.protocol;
    if (protocol !== "https:") return null;
    return `${protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function preconnectLiveKit(url) {
  if (typeof document === "undefined") return false;
  const origin = liveKitHttpsOrigin(url);
  if (!origin) return false;
  const existing = document.querySelector(`link[data-livekit-preconnect="${origin}"]`);
  if (existing) return false;
  const dnsPrefetch = document.createElement("link");
  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = origin;
  dnsPrefetch.setAttribute("data-livekit-preconnect", origin);
  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = origin;
  preconnect.crossOrigin = "anonymous";
  preconnect.setAttribute("data-livekit-preconnect", origin);
  document.head?.appendChild(dnsPrefetch);
  document.head?.appendChild(preconnect);
  return true;
}

export function rememberLiveKitOrigin(url) {
  const origin = liveKitHttpsOrigin(url);
  if (!origin || typeof window === "undefined") return false;
  try {
    window.localStorage?.setItem(LIVEKIT_ORIGIN_CACHE_KEY, origin);
    return true;
  } catch {
    return false;
  }
}

export function preconnectCachedLiveKitOrigin() {
  if (typeof window === "undefined") return false;
  try {
    const cachedOrigin = window.localStorage?.getItem(LIVEKIT_ORIGIN_CACHE_KEY);
    return cachedOrigin ? preconnectLiveKit(cachedOrigin) : false;
  } catch {
    return false;
  }
}

function createLiveKitRoomOptions(sdk = {}) {
  const videoPresets = sdk.VideoPresets || {};
  const mobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const portrait =
    mobile &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(orientation: portrait)")?.matches !== false;
  const layers = mobile
    ? [videoPresets.h180, videoPresets.h360, videoPresets.h540].filter(Boolean)
    : [videoPresets.h180, videoPresets.h360, videoPresets.h720].filter(Boolean);
  const balancedResolution = mobile
    ? {
        width: portrait ? 720 : 1280,
        height: portrait ? 1280 : 720,
        frameRate: 24,
        aspectRatio: portrait ? 9 / 16 : 16 / 9,
      }
    : {
        ...(videoPresets.h720?.resolution || {
          width: 1280,
          height: 720,
        }),
        frameRate: 30,
      };

  return {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: balancedResolution,
      facingMode: "user",
    },
    publishDefaults: {
      simulcast: true,
      videoEncoding: {
        maxBitrate: mobile ? 1_400_000 : 2_200_000,
        maxFramerate: mobile ? 24 : 30,
      },
      videoSimulcastLayers: layers,
      screenShareEncoding: {
        maxBitrate: 1_500_000,
        maxFramerate: 15,
      },
    },
  };
}

function createDisabledRoomDiagnostic({
  workspaceId = null,
  sessionId = null,
  providerRoomId = null,
} = {}) {
  const roomId =
    safeString(providerRoomId) ||
    `livekit:workspace:${safeString(workspaceId) || "unknown"}:huddle:${safeString(sessionId) || "unmapped"}`;

  return {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    providerRoomId: roomId,
    workspaceId: safeString(workspaceId) || null,
    sessionId: safeString(sessionId) || null,
    roomState: LIVEKIT_DISABLED_ROOM_STATE,
    canConnect: false,
    canJoinRooms: false,
  };
}

function connectionReason(canary = {}) {
  if (!canary.canaryEnabled) return LIVEKIT_CONNECTION_REASONS.CANARY_DISABLED;
  if (!canary.workspaceAllowed) return LIVEKIT_CONNECTION_REASONS.WORKSPACE_NOT_ENABLED;
  if (!canary.runtimeConnectionsEnabled) return LIVEKIT_CONNECTION_REASONS.RUNTIME_NOT_READY;
  return null;
}

function sanitizeFailure(error, fallbackMessage) {
  const response = error?.response;
  return {
    status: response?.status || null,
    reason: response?.data?.reason || fallbackMessage,
    message: response?.data?.error || error?.message || fallbackMessage,
  };
}

export function createLiveKitConnectionPlan({
  canary = {},
  workspaceId = null,
  sessionId = null,
  providerRoomId = null,
  sdkDiagnostics = createLiveKitSdkDiagnostics(),
} = {}) {
  const reason = connectionReason(canary);
  const room = createDisabledRoomDiagnostic({
    workspaceId,
    sessionId,
    providerRoomId,
  });

  return {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    activeProvider: HUDDLE_MEDIA_PROVIDER_MESH,
    fallbackProvider: HUDDLE_MEDIA_PROVIDER_MESH,
    canary,
    room,
    connectionState: HUDDLE_MEDIA_CONNECTION_STATES.idle,
    roomState: LIVEKIT_DISABLED_ROOM_STATE,
    canConnect: Boolean(canary.runtimeConnectionsEnabled),
    canJoinRooms: Boolean(canary.runtimeConnectionsEnabled),
    canPublish: Boolean(canary.runtimeConnectionsEnabled),
    canSubscribe: Boolean(canary.runtimeConnectionsEnabled),
    runtimeConnectionsEnabled: Boolean(canary.runtimeConnectionsEnabled),
    sdkDiagnostics,
    reason,
    diagnostics: {
      provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
      modeled: true,
      active: false,
      fallbackProvider: HUDDLE_MEDIA_PROVIDER_MESH,
      sdk: sdkDiagnostics,
      room: {
        providerRoomId: room.providerRoomId,
        state: room.roomState,
        canConnect: Boolean(canary.runtimeConnectionsEnabled),
        canJoinRooms: Boolean(canary.runtimeConnectionsEnabled),
      },
      failure: {
        reason,
        fallbackToMesh: true,
      },
    },
  };
}

export async function prepareLiveKitConnection({
  canary = {},
  workspaceId = null,
  sessionId = null,
  providerRoomId = null,
} = {}) {
  const sdkStartedAt = metricNow();
  const sdkResult = await loadLiveKitSdk({
    enabled: Boolean(
      canary.sdkLoadEnabled &&
      canary.canaryEligible &&
      canary.runtimeConnectionsEnabled
    ),
  });
  const sdkLoadLatencyMs = elapsedMs(sdkStartedAt);
  const plan = createLiveKitConnectionPlan({
    canary,
    workspaceId,
    sessionId,
    providerRoomId,
    sdkDiagnostics: sdkResult.diagnostics,
  });

  return {
    ok: false,
    reason:
      sdkResult.diagnostics.status === LIVEKIT_SDK_STATUSES.UNAVAILABLE
        ? LIVEKIT_CONNECTION_REASONS.SDK_UNAVAILABLE
        : plan.reason,
    sdk: sdkResult.sdk,
    plan,
    diagnostics: {
      ...plan.diagnostics,
      timings: {
        sdkLoadLatencyMs,
      },
    },
  };
}

async function fetchLiveKitRoomDescriptor({
  channelId,
  huddleId,
  sessionId,
  workspaceId,
  deviceId,
} = {}) {
  const clientCapabilities = createWebHuddleClientCapabilities({
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  });
  const { data } = await api.post("/huddle/media/livekit/room", {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    channelId,
    huddleId,
    sessionId,
    workspaceId,
    deviceId,
    platform: clientCapabilities.platform,
    clientCapabilities,
  });
  return data;
}

async function fetchLiveKitToken({
  channelId,
  huddleId,
  sessionId,
  workspaceId,
  deviceId,
  providerRoomId,
} = {}) {
  const clientCapabilities = createWebHuddleClientCapabilities({
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  });
  const { data } = await api.post("/huddle/media/livekit/token", {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    channelId,
    huddleId,
    sessionId,
    workspaceId,
    deviceId,
    providerRoomId,
    platform: clientCapabilities.platform,
    clientCapabilities,
  });
  return data;
}

async function timedLiveKitRequest(request) {
  const startedAt = metricNow();
  try {
    return {
      ok: true,
      value: await request(),
      latencyMs: elapsedMs(startedAt),
    };
  } catch (error) {
    return {
      ok: false,
      error,
      latencyMs: elapsedMs(startedAt),
    };
  }
}

export async function connectLiveKitRoom(params = {}) {
  const totalStartedAt = metricNow();
  const prepared = await prepareLiveKitConnection(params);
  const prepareLatencyMs = elapsedMs(totalStartedAt);
  const sdkLoadLatencyMs = prepared.diagnostics?.timings?.sdkLoadLatencyMs ?? null;
  if (!params?.canary?.runtimeConnectionsEnabled || !params?.canary?.providerCanActivate) {
    return {
      ok: false,
      reason: prepared.reason || LIVEKIT_CONNECTION_REASONS.RUNTIME_NOT_READY,
      connection: null,
      plan: prepared.plan,
      diagnostics: {
        ...prepared.diagnostics,
        timings: {
          prepareLatencyMs,
          sdkLoadLatencyMs,
          totalJoinLatencyMs: elapsedMs(totalStartedAt),
        },
      },
    };
  }

  if (!prepared.sdk) {
    return {
      ok: false,
      reason: LIVEKIT_CONNECTION_REASONS.SDK_UNAVAILABLE,
      connection: null,
      plan: prepared.plan,
      diagnostics: {
        ...prepared.diagnostics,
        timings: {
          prepareLatencyMs,
          sdkLoadLatencyMs,
          totalJoinLatencyMs: elapsedMs(totalStartedAt),
        },
      },
    };
  }

  const tokenRequest = await timedLiveKitRequest(() => fetchLiveKitToken(params));
  const roomEndpointLatencyMs = null;
  const tokenEndpointLatencyMs = tokenRequest.latencyMs;
  const tokenEndpointBackendTimings =
    tokenRequest.value?.diagnostics?.timings || null;

  if (!tokenRequest.ok) {
    return {
      ok: false,
      reason: LIVEKIT_CONNECTION_REASONS.TOKEN_ENDPOINT_FAILED,
      connection: null,
      plan: prepared.plan,
      diagnostics: {
        ...prepared.diagnostics,
        timings: {
          prepareLatencyMs,
          sdkLoadLatencyMs,
          roomEndpointLatencyMs,
          tokenEndpointLatencyMs,
          tokenEndpointBackendTimings,
          totalJoinLatencyMs: elapsedMs(totalStartedAt),
        },
        room: prepared.diagnostics.room,
        tokenFailure: sanitizeFailure(
          tokenRequest.error,
          LIVEKIT_CONNECTION_REASONS.TOKEN_ENDPOINT_FAILED
        ),
      },
    };
  }
  const tokenDescriptor = tokenRequest.value;
  const roomDescriptor = {
    diagnostics: {
      providerRoomId: tokenDescriptor?.liveKit?.roomName || prepared.diagnostics.room?.providerRoomId,
      canConnect: true,
      canJoinRooms: true,
      source: "token_endpoint",
    },
  };

  const liveKitUrl = tokenDescriptor?.liveKit?.url;
  const token = tokenDescriptor?.liveKit?.token;
  rememberLiveKitOrigin(liveKitUrl);
  const preconnectStartedAt = metricNow();
  const preconnectInserted = preconnectLiveKit(liveKitUrl);
  const preconnectLatencyMs = elapsedMs(preconnectStartedAt);
  if (!liveKitUrl || !token) {
    return {
      ok: false,
      reason: LIVEKIT_CONNECTION_REASONS.TOKEN_ENDPOINT_FAILED,
      connection: null,
      plan: prepared.plan,
      diagnostics: {
        ...prepared.diagnostics,
        timings: {
          prepareLatencyMs,
          sdkLoadLatencyMs,
          roomEndpointLatencyMs,
          tokenEndpointLatencyMs,
          tokenEndpointBackendTimings,
          preconnectLatencyMs,
          preconnectInserted,
          totalJoinLatencyMs: elapsedMs(totalStartedAt),
        },
        room: roomDescriptor?.diagnostics || prepared.diagnostics.room,
        token: tokenDescriptor?.diagnostics || null,
        tokenFailure: {
          reason: "livekit_token_payload_incomplete",
        },
      },
    };
  }

  try {
    const roomOptions = createLiveKitRoomOptions(prepared.sdk);
    const liveKitRoom = new prepared.sdk.Room(roomOptions);
    const connectStartedAt = metricNow();
    await liveKitRoom.connect(liveKitUrl, token);
    const connectLatencyMs = elapsedMs(connectStartedAt);
    return {
      ok: true,
      reason: "livekit_connected",
      connection: {
        room: liveKitRoom,
        roomName: tokenDescriptor.liveKit.roomName,
        identity: tokenDescriptor.liveKit.identity,
        url: liveKitUrl,
      },
      plan: {
        ...prepared.plan,
        activeProvider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
        connectionState: HUDDLE_MEDIA_CONNECTION_STATES.joined,
        canConnect: true,
        canJoinRooms: true,
        reason: "livekit_connected",
      },
      diagnostics: {
        ...prepared.diagnostics,
        active: true,
        timings: {
          prepareLatencyMs,
          sdkLoadLatencyMs,
          roomEndpointLatencyMs,
          tokenEndpointLatencyMs,
          tokenEndpointBackendTimings,
          preconnectLatencyMs,
          preconnectInserted,
          connectLatencyMs,
          totalJoinLatencyMs: elapsedMs(totalStartedAt),
        },
        room: roomDescriptor?.diagnostics || prepared.diagnostics.room,
        token: {
          ok: true,
          expiresAt: tokenDescriptor.liveKit.expiresAt,
          identity: tokenDescriptor.liveKit.identity,
        },
        connection: {
          state: liveKitRoom.state || HUDDLE_MEDIA_CONNECTION_STATES.joined,
          roomName: tokenDescriptor.liveKit.roomName,
          adaptiveStream: roomOptions.adaptiveStream,
          dynacast: roomOptions.dynacast,
          videoCaptureResolution: roomOptions.videoCaptureDefaults?.resolution || null,
          simulcastLayerCount: roomOptions.publishDefaults?.videoSimulcastLayers?.length || 0,
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: LIVEKIT_CONNECTION_REASONS.CONNECTION_FAILED,
      connection: null,
      plan: prepared.plan,
      diagnostics: {
        ...prepared.diagnostics,
        timings: {
          prepareLatencyMs,
          sdkLoadLatencyMs,
          roomEndpointLatencyMs,
          tokenEndpointLatencyMs,
          tokenEndpointBackendTimings,
          preconnectLatencyMs,
          preconnectInserted,
          connectLatencyMs: elapsedMs(totalStartedAt),
          totalJoinLatencyMs: elapsedMs(totalStartedAt),
        },
        room: roomDescriptor?.diagnostics || prepared.diagnostics.room,
        token: {
          ok: true,
          expiresAt: tokenDescriptor.liveKit.expiresAt,
          identity: tokenDescriptor.liveKit.identity,
        },
        connectionFailure: sanitizeFailure(error, LIVEKIT_CONNECTION_REASONS.CONNECTION_FAILED),
      },
    };
  }
}

export function createLiveKitDisconnectedResult(params = {}) {
  const preparedPlan = createLiveKitConnectionPlan(params);
  return {
    ok: false,
    reason: LIVEKIT_CONNECTION_REASONS.RUNTIME_NOT_READY,
    connection: null,
    plan: preparedPlan,
    diagnostics: preparedPlan.diagnostics,
  };
}

export function disconnectLiveKitRoom() {
  return {
    ok: true,
    reason: "livekit_disconnect_noop",
  };
}
