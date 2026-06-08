import { useMemo, useState } from "react";
import { joinHuddle as emitJoinHuddle } from "../../socket";
import { useMeshMediaProvider } from "./MeshMediaProvider";
import { assertMediaProviderContract } from "./MediaProvider";
import {
  createLiveKitCanaryDiagnostics,
  resolveLiveKitCanaryConfig,
  resolveWorkspaceId,
} from "./LiveKitCanary";
import {
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PROVIDER_MESH,
} from "./mediaState";
import {
  createLiveKitProviderReadinessDiagnostics,
  useLiveKitMediaProvider,
} from "./LiveKitMediaProvider";

export const WEB_MEDIA_PROVIDER_SELECTION_REASONS = Object.freeze({
  DEFAULT_MESH: "default_mesh",
  REQUESTED_MESH: "requested_mesh",
  LIVEKIT_MODELED_NOT_ENABLED: "livekit_modeled_not_enabled",
  LIVEKIT_CANARY_DISABLED: "livekit_canary_disabled",
  LIVEKIT_WORKSPACE_NOT_ENABLED: "livekit_workspace_not_enabled",
  LIVEKIT_RUNTIME_NOT_READY: "livekit_runtime_not_ready",
  LIVEKIT_CANARY_READY: "livekit_canary_ready",
  UNSUPPORTED_PROVIDER: "unsupported_provider",
});

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isEnabled(value) {
  return safeString(value).toLowerCase() === "true";
}

export function selectWebHuddleMediaProvider({
  requestedProvider = null,
  env = import.meta.env,
  workspaceId = null,
} = {}) {
  const canary = resolveLiveKitCanaryConfig({
    env,
    requestedProvider,
    workspaceId,
  });
  const requested = safeString(canary.requestedProvider).toLowerCase();
  const supported =
    !requested ||
    requested === HUDDLE_MEDIA_PROVIDER_MESH ||
    requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT;
  let reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.DEFAULT_MESH;

  if (!requested) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.DEFAULT_MESH;
  } else if (requested === HUDDLE_MEDIA_PROVIDER_MESH) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.REQUESTED_MESH;
  } else if (requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT && !canary.canaryEnabled) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_CANARY_DISABLED;
  } else if (requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT && !canary.workspaceAllowed) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_WORKSPACE_NOT_ENABLED;
  } else if (requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT && canary.providerCanActivate) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_CANARY_READY;
  } else if (requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_RUNTIME_NOT_READY;
  } else if (requested) {
    reason = WEB_MEDIA_PROVIDER_SELECTION_REASONS.UNSUPPORTED_PROVIDER;
  }
  const livekitReadiness = createLiveKitProviderReadinessDiagnostics({ canary });
  const activeProvider = canary.providerCanActivate
    ? HUDDLE_MEDIA_PROVIDER_LIVEKIT
    : HUDDLE_MEDIA_PROVIDER_MESH;

  return {
    requestedProvider: supported ? requested : requested || null,
    providerType: activeProvider,
    activeProvider,
    reason,
    mesh: {
      modeled: true,
      enabled: true,
      active: activeProvider === HUDDLE_MEDIA_PROVIDER_MESH,
    },
    livekit: {
      ...livekitReadiness,
      canary: createLiveKitCanaryDiagnostics(canary),
      flagPresent:
        isEnabled(env?.VITE_HUDDLE_LIVEKIT_ENABLED) ||
        isEnabled(env?.VITE_HUDDLE_LIVEKIT_CANARY_ENABLED),
      workspaceAllowed: canary.workspaceAllowed,
      canaryEligible: canary.canaryEligible,
      active: activeProvider === HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    },
    canFallbackToMesh: requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    fallbackProvider:
      requested === HUDDLE_MEDIA_PROVIDER_LIVEKIT
        ? HUDDLE_MEDIA_PROVIDER_MESH
        : null,
    canary,
    roomState: "disabled",
    connectionState: "idle",
  };
}

export function useHuddleMediaService({
  currentUser,
  provider = null,
  workspaceId = null,
} = {}) {
  const resolvedWorkspaceId = resolveWorkspaceId({ currentUser, workspaceId });
  const selection = selectWebHuddleMediaProvider({
    requestedProvider: provider,
    workspaceId: resolvedWorkspaceId,
  });
  const meshProvider = useMeshMediaProvider({ currentUser });
  const liveKitProvider = useLiveKitMediaProvider({
    currentUser,
    workspaceId: resolvedWorkspaceId,
    canary: selection.canary,
  });
  const fallbackScopeKey = `${selection.providerType}:${selection.canary?.requestedProvider || ""}:${selection.canary?.workspaceId || ""}`;
  const [liveKitFallback, setLiveKitFallback] = useState({
    active: false,
    diagnostics: null,
    scopeKey: null,
  });
  const liveKitFallbackActive =
    liveKitFallback.active && liveKitFallback.scopeKey === fallbackScopeKey;
  const liveKitFallbackDiagnostics = liveKitFallbackActive
    ? liveKitFallback.diagnostics
    : null;

  if (selection.reason === WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_CANARY_DISABLED) {
    console.warn("[huddle:media] LiveKit provider requested but canary is disabled; using mesh provider");
  } else if (selection.reason === WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_WORKSPACE_NOT_ENABLED) {
    console.warn("[huddle:media] LiveKit provider requested but workspace is not canary-enabled; using mesh provider");
  } else if (selection.reason === WEB_MEDIA_PROVIDER_SELECTION_REASONS.LIVEKIT_RUNTIME_NOT_READY) {
    console.warn("[huddle:media] LiveKit provider canary is modeled but runtime is not ready; using mesh provider");
  } else if (selection.reason === WEB_MEDIA_PROVIDER_SELECTION_REASONS.UNSUPPORTED_PROVIDER) {
    console.warn(`[huddle:media] Unsupported provider "${provider}", using mesh provider`);
  }

  const liveKitCanaryProvider = useMemo(() => {
    const startCall = async (params = {}) => {
      const result = await liveKitProvider.startCall(params);
      if (result?.ok) {
        const channelId = safeString(params.channelId);
        const huddleId = safeString(params.huddleId);
        if (channelId && huddleId) {
          emitJoinHuddle(channelId, huddleId, { provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT });
        }
        return result;
      }

      if (!selection.canFallbackToMesh) return result;

      const channelId = safeString(params.channelId);
      const huddleId = safeString(params.huddleId);
      if (channelId) meshProvider.setChannelId(channelId);
      if (huddleId) meshProvider.setHuddleId(huddleId);

      const fallbackDiagnostics = {
        active: true,
        fallbackProvider: HUDDLE_MEDIA_PROVIDER_MESH,
        liveKitReason: result?.reason || "livekit_canary_start_failed",
        liveKitDiagnostics: result?.diagnostics || null,
        observedAt: new Date().toISOString(),
      };
      setLiveKitFallback({
        active: true,
        diagnostics: fallbackDiagnostics,
        scopeKey: fallbackScopeKey,
      });

      const fallbackResult = await meshProvider.startCall(params);
      return {
        ...fallbackResult,
        liveKitFallback: fallbackDiagnostics,
      };
    };

    const leaveCall = () => {
      const liveKitLeave = liveKitProvider.leaveCall();
      if (!liveKitFallbackActive) {
        setLiveKitFallback({ active: false, diagnostics: null, scopeKey: fallbackScopeKey });
        return liveKitLeave;
      }
      const meshLeave = meshProvider.leaveCall();
      setLiveKitFallback({ active: false, diagnostics: null, scopeKey: fallbackScopeKey });
      return meshLeave;
    };

    const setChannelId = (id) => {
      liveKitProvider.setChannelId(id);
      meshProvider.setChannelId(id);
    };

    const setHuddleId = (id) => {
      liveKitProvider.setHuddleId(id);
      meshProvider.setHuddleId(id);
    };

    return {
      ...liveKitProvider,
      diagnostics: {
        ...liveKitProvider.diagnostics,
        metadata: {
          ...(liveKitProvider.diagnostics?.metadata || {}),
          canaryFallback: liveKitFallbackDiagnostics,
          fallbackProvider: HUDDLE_MEDIA_PROVIDER_MESH,
        },
      },
      startCall,
      leaveCall,
      setChannelId,
      setHuddleId,
    };
  }, [
    liveKitFallbackActive,
    liveKitFallbackDiagnostics,
    liveKitProvider,
    meshProvider,
    selection.canFallbackToMesh,
    fallbackScopeKey,
  ]);

  const meshFallbackProvider = useMemo(() => ({
    ...meshProvider,
    diagnostics: {
      ...meshProvider.diagnostics,
      metadata: {
        ...(meshProvider.diagnostics?.metadata || {}),
        canaryFallback: liveKitFallbackDiagnostics,
        fallbackProvider: HUDDLE_MEDIA_PROVIDER_MESH,
      },
    },
  }), [liveKitFallbackDiagnostics, meshProvider]);

  if (selection.providerType === HUDDLE_MEDIA_PROVIDER_LIVEKIT) {
    if (liveKitFallbackActive) {
      return assertMediaProviderContract(meshFallbackProvider, HUDDLE_MEDIA_PROVIDER_MESH);
    }
    return assertMediaProviderContract(liveKitCanaryProvider, HUDDLE_MEDIA_PROVIDER_LIVEKIT);
  }

  return assertMediaProviderContract(meshProvider, HUDDLE_MEDIA_PROVIDER_MESH);
}
