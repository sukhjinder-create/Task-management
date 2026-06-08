import {
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PROVIDER_MESH,
} from "./mediaState";

export const LIVEKIT_CANARY_FLAGS = Object.freeze({
  ENABLED: "VITE_HUDDLE_LIVEKIT_CANARY_ENABLED",
  WORKSPACES: "VITE_HUDDLE_LIVEKIT_CANARY_WORKSPACES",
  PROVIDER: "VITE_HUDDLE_MEDIA_PROVIDER",
  SDK_LOAD: "VITE_HUDDLE_LIVEKIT_CANARY_SDK_LOAD_ENABLED",
  CONNECTIVITY: "VITE_HUDDLE_LIVEKIT_CANARY_CONNECTIVITY_ENABLED",
});

export const LIVEKIT_CANARY_REASONS = Object.freeze({
  DEFAULT_MESH: "default_mesh",
  REQUESTED_MESH: "requested_mesh",
  CANARY_DISABLED: "livekit_canary_disabled",
  WORKSPACE_NOT_ENABLED: "livekit_workspace_not_enabled",
  PROVIDER_NOT_REQUESTED: "livekit_provider_not_requested",
  RUNTIME_NOT_READY: "livekit_runtime_not_ready",
  CANARY_READY: "livekit_canary_ready",
  UNSUPPORTED_PROVIDER: "unsupported_provider",
});

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEnabled(value) {
  return safeString(value).toLowerCase() === "true";
}

function splitCsv(value) {
  return safeString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeWorkspaceId(value) {
  const workspaceId = safeString(value);
  return workspaceId || null;
}

export function resolveWorkspaceId({ currentUser = null, workspaceId = null } = {}) {
  return (
    normalizeWorkspaceId(workspaceId) ||
    normalizeWorkspaceId(currentUser?.workspaceId) ||
    normalizeWorkspaceId(currentUser?.workspace_id) ||
    normalizeWorkspaceId(globalThis?.window?.__WORKSPACE_ID__) ||
    null
  );
}

export function resolveLiveKitCanaryConfig({
  env = import.meta.env,
  requestedProvider = null,
  workspaceId = null,
} = {}) {
  const requested = safeString(
    requestedProvider || env?.[LIVEKIT_CANARY_FLAGS.PROVIDER]
  ).toLowerCase();
  const providerRequested = requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT;
  const requestedMesh = requested === HUDDLE_MEDIA_PROVIDER_MESH;
  const unsupportedProvider =
    Boolean(requested) && !providerRequested && !requestedMesh;
  const canaryEnabled = isEnabled(env?.[LIVEKIT_CANARY_FLAGS.ENABLED]);
  const sdkLoadEnabled = isEnabled(env?.[LIVEKIT_CANARY_FLAGS.SDK_LOAD]);
  const connectivityEnabled = isEnabled(env?.[LIVEKIT_CANARY_FLAGS.CONNECTIVITY]);
  const workspaceAllowlist = splitCsv(env?.[LIVEKIT_CANARY_FLAGS.WORKSPACES]);
  const allowAllWorkspaces = workspaceAllowlist.includes("*");
  const resolvedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const workspaceAllowed =
    canaryEnabled &&
    (allowAllWorkspaces ||
      (Boolean(resolvedWorkspaceId) &&
        workspaceAllowlist.includes(resolvedWorkspaceId)));

  let reason = LIVEKIT_CANARY_REASONS.DEFAULT_MESH;
  if (requestedMesh) {
    reason = LIVEKIT_CANARY_REASONS.REQUESTED_MESH;
  } else if (unsupportedProvider) {
    reason = LIVEKIT_CANARY_REASONS.UNSUPPORTED_PROVIDER;
  } else if (providerRequested && !canaryEnabled) {
    reason = LIVEKIT_CANARY_REASONS.CANARY_DISABLED;
  } else if (providerRequested && !workspaceAllowed) {
    reason = LIVEKIT_CANARY_REASONS.WORKSPACE_NOT_ENABLED;
  } else if (providerRequested && workspaceAllowed && !connectivityEnabled) {
    reason = LIVEKIT_CANARY_REASONS.RUNTIME_NOT_READY;
  } else if (providerRequested && workspaceAllowed) {
    reason = LIVEKIT_CANARY_REASONS.CANARY_READY;
  } else if (!providerRequested) {
    reason = LIVEKIT_CANARY_REASONS.PROVIDER_NOT_REQUESTED;
  }

  return {
    requestedProvider: requested || null,
    providerRequested,
    requestedMesh,
    unsupportedProvider,
    canaryEnabled,
    sdkLoadEnabled,
    workspaceId: resolvedWorkspaceId,
    workspaceAllowlist,
    workspaceAllowed,
    canaryEligible: providerRequested && canaryEnabled && workspaceAllowed,
    runtimeConnectionsEnabled: connectivityEnabled,
    providerCanActivate: providerRequested && canaryEnabled && workspaceAllowed && connectivityEnabled,
    active: false,
    fallbackProvider: HUDDLE_MEDIA_PROVIDER_MESH,
    reason,
  };
}

export function createLiveKitCanaryDiagnostics(config = resolveLiveKitCanaryConfig()) {
  return {
    modeled: true,
    enabled: config.canaryEnabled,
    active: false,
    workspaceScoped: true,
    workspaceId: config.workspaceId,
    workspaceAllowed: config.workspaceAllowed,
    workspaceAllowlistCount: config.workspaceAllowlist.length,
    providerRequested: config.providerRequested,
    canaryEligible: config.canaryEligible,
    sdkLoadEnabled: config.sdkLoadEnabled,
    runtimeConnectionsEnabled: config.runtimeConnectionsEnabled,
    providerCanActivate: config.providerCanActivate,
    fallbackProvider: config.fallbackProvider,
    reason: config.reason,
  };
}
