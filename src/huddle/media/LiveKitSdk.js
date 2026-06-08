export const LIVEKIT_SDK_PACKAGE = "livekit-client";

export const LIVEKIT_SDK_STATUSES = Object.freeze({
  DISABLED: "disabled",
  NOT_LOADED: "not_loaded",
  LOADING: "loading",
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
});

let liveKitSdkPromise = null;
let liveKitSdkModule = null;
let liveKitSdkError = null;

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeError(error) {
  if (!error) return null;
  return {
    name: safeString(error.name) || "Error",
    message: safeString(error.message) || "LiveKit SDK load failed",
  };
}

function sdkExportStatus(sdk) {
  return {
    hasRoom: typeof sdk?.Room === "function",
    hasRoomEvent: Boolean(sdk?.RoomEvent),
    hasTrack: Boolean(sdk?.Track),
    hasLocalParticipant: Boolean(sdk?.LocalParticipant),
    hasRemoteParticipant: Boolean(sdk?.RemoteParticipant),
  };
}

export function createLiveKitSdkDiagnostics({
  status = LIVEKIT_SDK_STATUSES.NOT_LOADED,
  attempted = false,
  sdk = liveKitSdkModule,
  error = liveKitSdkError,
} = {}) {
  return {
    packageName: LIVEKIT_SDK_PACKAGE,
    status,
    attempted: Boolean(attempted),
    available: status === LIVEKIT_SDK_STATUSES.AVAILABLE && Boolean(sdk),
    exports: sdkExportStatus(sdk),
    error: sanitizeError(error),
  };
}

export function getCachedLiveKitSdkDiagnostics() {
  if (liveKitSdkModule) {
    return createLiveKitSdkDiagnostics({
      status: LIVEKIT_SDK_STATUSES.AVAILABLE,
      attempted: true,
      sdk: liveKitSdkModule,
    });
  }
  if (liveKitSdkError) {
    return createLiveKitSdkDiagnostics({
      status: LIVEKIT_SDK_STATUSES.UNAVAILABLE,
      attempted: true,
      error: liveKitSdkError,
    });
  }
  return createLiveKitSdkDiagnostics();
}

export async function loadLiveKitSdk({ enabled = false } = {}) {
  if (!enabled) {
    return {
      ok: false,
      sdk: null,
      diagnostics: createLiveKitSdkDiagnostics({
        status: LIVEKIT_SDK_STATUSES.DISABLED,
        attempted: false,
      }),
    };
  }

  if (liveKitSdkModule) {
    return {
      ok: true,
      sdk: liveKitSdkModule,
      diagnostics: createLiveKitSdkDiagnostics({
        status: LIVEKIT_SDK_STATUSES.AVAILABLE,
        attempted: true,
        sdk: liveKitSdkModule,
      }),
    };
  }

  if (!liveKitSdkPromise) {
    liveKitSdkPromise = import("livekit-client")
      .then((sdk) => {
        liveKitSdkModule = sdk;
        liveKitSdkError = null;
        liveKitSdkPromise = null;
        return sdk;
      })
      .catch((error) => {
        liveKitSdkError = error;
        liveKitSdkPromise = null;
        return null;
      });
  }

  const sdk = await liveKitSdkPromise;
  if (!sdk) {
    return {
      ok: false,
      sdk: null,
      diagnostics: createLiveKitSdkDiagnostics({
        status: LIVEKIT_SDK_STATUSES.UNAVAILABLE,
        attempted: true,
        error: liveKitSdkError,
      }),
    };
  }

  return {
    ok: true,
    sdk,
    diagnostics: createLiveKitSdkDiagnostics({
      status: LIVEKIT_SDK_STATUSES.AVAILABLE,
      attempted: true,
      sdk,
    }),
  };
}

export function resetLiveKitSdkCacheForTests() {
  liveKitSdkPromise = null;
  liveKitSdkModule = null;
  liveKitSdkError = null;
}
