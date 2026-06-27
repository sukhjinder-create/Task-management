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
import { recordHuddleCallTrace } from "../callTrace";

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
const liveKitTokenPrefetches = new Map();
const LIVEKIT_TOKEN_PREFETCH_TTL_MS = 2 * 60 * 1000;

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

const POLICY_RESOLUTION_LADDER = ["h180", "h360", "h540", "h720"];

// Default per-resolution publish bitrate budgets (bps), tuned for the camera.
// The server policy chooses the ceiling; these map it to an encoder budget.
const POLICY_BITRATE_BY_RESOLUTION = Object.freeze({
  h180: 200_000,
  h360: 500_000,
  h540: 900_000,
  h720: 1_400_000,
});

const VALID_DEGRADATION_PREFERENCES = new Set([
  "maintain-framerate",
  "maintain-resolution",
  "balanced",
]);

const VALID_VIDEO_CODECS = new Set(["vp8", "vp9", "h264", "av1"]);

// Build LiveKit RoomOptions. When the backend supplies a server-authoritative
// media policy (computed from this session's quality telemetry + platform), we
// apply it verbatim: publish ceiling, simulcast ladder, dynacast, degradation
// preference and codec all come from the server so a single, telemetry-aware
// decision drives every client. When no policy is present (older backend, or
// the field is missing) we fall back to the previous static behaviour so the
// client never hard-depends on the policy being there.
function createLiveKitRoomOptions(sdk = {}, mediaPolicy = null) {
  const mobile = isMobileMediaDevice();
  const videoPresets =
    (mobile ? sdk.VideoPresets43 : sdk.VideoPresets) ||
    sdk.VideoPresets ||
    {};

  const policyPublish =
    mediaPolicy && typeof mediaPolicy === "object" ? mediaPolicy.publish || {} : {};
  const ceiling = POLICY_RESOLUTION_LADDER.includes(policyPublish.maxResolution)
    ? policyPublish.maxResolution
    : "h540";
  const ceilingIndex = POLICY_RESOLUTION_LADDER.indexOf(ceiling);

  // Simulcast ladder: the policy ceiling plus up to two lower fallback layers.
  const ladderLabels = mediaPolicy
    ? POLICY_RESOLUTION_LADDER.slice(Math.max(0, ceilingIndex - 2), ceilingIndex + 1)
    : ["h180", "h360", "h540"];
  const layers = ladderLabels
    .map((label) => videoPresets[label])
    .filter(Boolean);

  const ceilingPreset = videoPresets[ceiling] || videoPresets.h540;
  const maxFramerate = Number(policyPublish.maxFramerate) > 0
    ? Number(policyPublish.maxFramerate)
    : 30;

  const balancedResolution = mobile
    ? {
        // Keep portrait capture on mobile; height tracks the policy ceiling.
        width: Math.round((ceilingPreset?.resolution?.height || 540) * (3 / 4)),
        height: ceilingPreset?.resolution?.height || 540,
        frameRate: maxFramerate,
        aspectRatio: 3 / 4,
      }
    : {
        ...(ceilingPreset?.resolution || { width: 960, height: 540 }),
        frameRate: maxFramerate,
      };

  const maxBitrate = mediaPolicy
    ? POLICY_BITRATE_BY_RESOLUTION[ceiling] || (mobile ? 750_000 : 900_000)
    : mobile
      ? 750_000
      : 900_000;

  const degradationPreference = VALID_DEGRADATION_PREFERENCES.has(
    policyPublish.degradationPreference
  )
    ? policyPublish.degradationPreference
    : undefined;

  const videoCodec = VALID_VIDEO_CODECS.has(policyPublish.videoCodec)
    ? policyPublish.videoCodec
    : undefined;

  const adaptiveStream =
    mediaPolicy?.subscribe?.adaptiveStream === false ? false : true;
  const dynacast = policyPublish.dynacast === false ? false : true;

  return {
    adaptiveStream,
    dynacast,
    videoCaptureDefaults: {
      resolution: balancedResolution,
      facingMode: "user",
    },
    publishDefaults: {
      simulcast: policyPublish.simulcast === false ? false : true,
      ...(videoCodec ? { videoCodec } : {}),
      videoEncoding: {
        maxBitrate,
        maxFramerate,
        ...(degradationPreference ? { degradationPreference } : {}),
      },
      videoSimulcastLayers: layers,
      screenShareEncoding: {
        maxBitrate: 1_500_000,
        maxFramerate: 15,
      },
    },
  };
}

function isMobileMediaDevice() {
  if (typeof navigator === "undefined") return false;
  const mobileUserAgent =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const coarseTouch =
    navigator.maxTouchPoints > 0 &&
    (typeof window === "undefined" ||
      window.matchMedia?.("(pointer: coarse)")?.matches === true ||
      window.innerWidth < 1024);
  return mobileUserAgent || coarseTouch;
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

function liveKitTokenPrefetchKey(params = {}) {
  return [
    safeString(params.workspaceId),
    safeString(params.sessionId || params.huddleId),
    safeString(params.deviceId),
  ].join(":");
}

export function prefetchLiveKitToken(params = {}) {
  const key = liveKitTokenPrefetchKey(params);
  if (!safeString(params.workspaceId) || !safeString(params.sessionId || params.huddleId)) {
    return Promise.resolve(null);
  }
  const existing = liveKitTokenPrefetches.get(key);
  if (existing && Date.now() - existing.createdAt < LIVEKIT_TOKEN_PREFETCH_TTL_MS) {
    return existing.promise;
  }
  const promise = fetchLiveKitToken(params).catch(() => null);
  liveKitTokenPrefetches.set(key, { createdAt: Date.now(), promise });
  return promise;
}

async function consumePrefetchedLiveKitToken(params = {}) {
  const key = liveKitTokenPrefetchKey(params);
  const existing = liveKitTokenPrefetches.get(key);
  if (!existing || Date.now() - existing.createdAt >= LIVEKIT_TOKEN_PREFETCH_TTL_MS) {
    liveKitTokenPrefetches.delete(key);
    return null;
  }
  liveKitTokenPrefetches.delete(key);
  return existing.promise;
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

  const tokenRequest = await timedLiveKitRequest(async () => (
    (await consumePrefetchedLiveKitToken(params)) ||
    fetchLiveKitToken(params)
  ));
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
    const mediaPolicy = tokenDescriptor?.liveKit?.mediaPolicy || null;
    const roomOptions = createLiveKitRoomOptions(prepared.sdk, mediaPolicy);
    const liveKitRoom = new prepared.sdk.Room(roomOptions);
    const connectStartedAt = metricNow();
    void recordHuddleCallTrace({
      step: "room_connect_started",
      channelId: params.channelId,
      huddleId: params.huddleId,
      sessionId: params.sessionId || params.huddleId,
      status: "attempted",
      metadata: { source: "web_livekit_connection" },
    });
    await liveKitRoom.connect(liveKitUrl, token);
    const connectLatencyMs = elapsedMs(connectStartedAt);
    void recordHuddleCallTrace({
      step: "room_connect_success",
      channelId: params.channelId,
      huddleId: params.huddleId,
      sessionId: params.sessionId || params.huddleId,
      status: "success",
      metadata: {
        source: "web_livekit_connection",
        connectLatencyMs,
        roomName: tokenDescriptor.liveKit.roomName,
      },
    });
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
          mediaPolicy: mediaPolicy
            ? {
                version: mediaPolicy.version,
                source: mediaPolicy.source,
                rating: mediaPolicy.rating,
                degradationLevel: mediaPolicy.degradationLevel,
                maxResolution: mediaPolicy.publish?.maxResolution || null,
                degradationPreference:
                  roomOptions.publishDefaults?.videoEncoding?.degradationPreference || null,
                videoCodec: roomOptions.publishDefaults?.videoCodec || null,
                reasons: mediaPolicy.reasons || [],
              }
            : { source: "client_default" },
        },
      },
    };
  } catch (error) {
    void recordHuddleCallTrace({
      step: "room_connect_failed",
      channelId: params.channelId,
      huddleId: params.huddleId,
      sessionId: params.sessionId || params.huddleId,
      status: "failure",
      reason: LIVEKIT_CONNECTION_REASONS.CONNECTION_FAILED,
      metadata: {
        source: "web_livekit_connection",
        error: error?.message || String(error),
      },
    });
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
