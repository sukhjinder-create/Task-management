import {
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PROVIDER_MESH,
} from "./mediaState";

export const WEB_MESH_PROVIDER_VERSION = "web-mesh-1";
export const WEB_LIVEKIT_PROVIDER_VERSION = "web-livekit-canary-1";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function createWebHuddleClientCapabilities({
  provider = HUDDLE_MEDIA_PROVIDER_MESH,
  platform = "web",
} = {}) {
  const normalizedProvider =
    safeString(provider).toLowerCase() === HUDDLE_MEDIA_PROVIDER_LIVEKIT
      ? HUDDLE_MEDIA_PROVIDER_LIVEKIT
      : HUDDLE_MEDIA_PROVIDER_MESH;
  const supportsLiveKit = normalizedProvider === HUDDLE_MEDIA_PROVIDER_LIVEKIT;

  return {
    clientType: "web",
    platform: safeString(platform) || "web",
    supportedProviders: supportsLiveKit
      ? [HUDDLE_MEDIA_PROVIDER_MESH, HUDDLE_MEDIA_PROVIDER_LIVEKIT]
      : [HUDDLE_MEDIA_PROVIDER_MESH],
    providerVersions: {
      mesh: WEB_MESH_PROVIDER_VERSION,
      ...(supportsLiveKit ? { livekit: WEB_LIVEKIT_PROVIDER_VERSION } : {}),
    },
  };
}
