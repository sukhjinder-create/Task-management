import {
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PROVIDER_MESH,
} from "./mediaState";

export const HUDDLE_PROVIDER_DIAGNOSTICS_VERSION = 1;

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function boundedArray(value, limit = 40) {
  return safeArray(value).slice(-limit);
}

export function metricNow() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function elapsedMs(start, end = metricNow()) {
  const startedAt = safeNumber(start);
  const endedAt = safeNumber(end);
  if (startedAt == null || endedAt == null) return null;
  return Math.max(0, Math.round(endedAt - startedAt));
}

export function createProviderMetricsSnapshot({
  provider,
  connectionState = "idle",
  participantCount = 0,
  deviceCount = 0,
  trackCount = 0,
  timings = {},
  transitions = [],
  failures = [],
  resources = {},
  bandwidth = {},
  metadata = {},
  observedAt = new Date().toISOString(),
} = {}) {
  const boundedFailures = boundedArray(failures, 50);
  const boundedTransitions = boundedArray(transitions, 50);

  return {
    version: HUDDLE_PROVIDER_DIAGNOSTICS_VERSION,
    provider,
    normalized: true,
    observedAt,
    connectionState,
    counts: {
      participantCount: safeNumber(participantCount, 0),
      deviceCount: safeNumber(deviceCount, 0),
      trackCount: safeNumber(trackCount, 0),
    },
    latency: {
      joinMs: safeNumber(timings.joinMs),
      publishMs: safeNumber(timings.publishMs),
      subscribeMs: safeNumber(timings.subscribeMs),
      screenShareMs: safeNumber(timings.screenShareMs),
      reconnectMs: safeNumber(timings.reconnectMs),
      roomDurationMs: safeNumber(timings.roomDurationMs),
      roomEndpointMs: safeNumber(timings.roomEndpointMs),
      tokenEndpointMs: safeNumber(timings.tokenEndpointMs),
      sdkLoadMs: safeNumber(timings.sdkLoadMs),
    },
    failures: {
      count: boundedFailures.length,
      trackFailureCount: boundedFailures.filter((failure) =>
        String(failure?.type || failure?.reason || "").toLowerCase().includes("track")
      ).length,
      items: boundedFailures,
    },
    transitions: boundedTransitions,
    resources: {
      cpuPercent: safeNumber(resources.cpuPercent),
      memoryMb: safeNumber(resources.memoryMb),
      heapUsedMb: safeNumber(resources.heapUsedMb),
      heapTotalMb: safeNumber(resources.heapTotalMb),
    },
    bandwidth: {
      bytesSent: safeNumber(bandwidth.bytesSent),
      bytesReceived: safeNumber(bandwidth.bytesReceived),
      bitrateKbps: safeNumber(bandwidth.bitrateKbps),
    },
    collaboration: {
      activeSpeakerEventCount: safeNumber(metadata.activeSpeakerEventCount, 0),
      networkQualityEventCount: safeNumber(metadata.networkQualityEventCount, 0),
      screenShareEventCount: safeNumber(metadata.screenShareEventCount, 0),
      screenShareActive: Boolean(metadata.screenShareActive),
    },
    metadata,
  };
}

export function createMeshScaleProjection(participantCount, tracksPerParticipant = 2) {
  const participants = Math.max(0, Number(participantCount) || 0);
  const tracks = Math.max(0, Number(tracksPerParticipant) || 0);
  const peerConnectionsPerClient = Math.max(0, participants - 1);
  const totalPeerEdges = participants > 1 ? (participants * (participants - 1)) / 2 : 0;

  return {
    provider: HUDDLE_MEDIA_PROVIDER_MESH,
    participantCount: participants,
    tracksPerParticipant: tracks,
    peerConnectionsPerClient,
    totalPeerEdges,
    totalPeerConnectionDirections: totalPeerEdges * 2,
    upstreamTrackCopiesPerPublisher: peerConnectionsPerClient * tracks,
    totalUpstreamTrackCopies: participants * peerConnectionsPerClient * tracks,
    serverMediaRouting: false,
    expectedScalingClass: "O(n^2)",
  };
}

export function createLiveKitScaleProjection(participantCount, tracksPerParticipant = 2) {
  const participants = Math.max(0, Number(participantCount) || 0);
  const tracks = Math.max(0, Number(tracksPerParticipant) || 0);

  return {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    participantCount: participants,
    tracksPerParticipant: tracks,
    peerConnectionsPerClient: participants > 0 ? 1 : 0,
    totalPeerEdges: participants,
    totalPeerConnectionDirections: participants,
    upstreamTrackCopiesPerPublisher: tracks,
    totalUpstreamTrackCopies: participants * tracks,
    serverMediaRouting: true,
    expectedScalingClass: "O(n)",
  };
}

export function createProviderComparison({
  participantCount = 0,
  tracksPerParticipant = 2,
  meshMetrics = null,
  liveKitMetrics = null,
} = {}) {
  const meshProjection = createMeshScaleProjection(participantCount, tracksPerParticipant);
  const liveKitProjection = createLiveKitScaleProjection(participantCount, tracksPerParticipant);
  const meshCopies = Math.max(1, meshProjection.totalUpstreamTrackCopies);
  const liveKitCopies = Math.max(1, liveKitProjection.totalUpstreamTrackCopies);

  return {
    version: HUDDLE_PROVIDER_DIAGNOSTICS_VERSION,
    participantCount,
    tracksPerParticipant,
    mesh: {
      projection: meshProjection,
      metrics: meshMetrics,
    },
    livekit: {
      projection: liveKitProjection,
      metrics: liveKitMetrics,
    },
    deltas: {
      upstreamTrackCopyReduction:
        meshProjection.totalUpstreamTrackCopies - liveKitProjection.totalUpstreamTrackCopies,
      upstreamTrackCopyRatio: Number((meshCopies / liveKitCopies).toFixed(2)),
      expectedScalingAdvantage:
        meshProjection.expectedScalingClass !== liveKitProjection.expectedScalingClass,
    },
  };
}

export function scoreLiveKitReadiness({
  scaleResults = [],
  failureResults = [],
  resilienceResults = [],
  maxJoinLatencyMs = 5000,
  maxPublishLatencyMs = 5000,
  maxSubscribeLatencyMs = 7000,
} = {}) {
  const scales = safeArray(scaleResults);
  const failures = safeArray(failureResults);
  const resilience = safeArray(resilienceResults);
  const allScalePassed = scales.length > 0 && scales.every((result) => result.ok);
  const allFailuresSafe = failures.every((result) => result.ok);
  const allResiliencePassed = resilience.every((result) => result.ok);
  const worstJoin = Math.max(0, ...scales.map((result) => safeNumber(result.metrics?.latency?.joinMs, 0)));
  const worstPublish = Math.max(0, ...scales.map((result) => safeNumber(result.metrics?.latency?.publishMs, 0)));
  const worstSubscribe = Math.max(0, ...scales.map((result) => safeNumber(result.metrics?.latency?.subscribeMs, 0)));

  let score = 0;
  if (allScalePassed) score += 30;
  if (allFailuresSafe) score += 25;
  if (allResiliencePassed) score += 20;
  if (worstJoin > 0 && worstJoin <= maxJoinLatencyMs) score += 10;
  if (worstPublish > 0 && worstPublish <= maxPublishLatencyMs) score += 10;
  if (worstSubscribe > 0 && worstSubscribe <= maxSubscribeLatencyMs) score += 5;

  return {
    score,
    maxScore: 100,
    verdict:
      score >= 85 && allScalePassed && allFailuresSafe && allResiliencePassed
        ? "production_canary_ready"
        : score >= 70 && allScalePassed && allFailuresSafe
          ? "limited_canary_after_minor_fixes"
          : "not_ready",
    blockers: [
      !allScalePassed ? "scale_certification_not_fully_passing" : null,
      !allFailuresSafe ? "failure_fallback_not_fully_safe" : null,
      !allResiliencePassed ? "resilience_certification_not_fully_passing" : null,
      worstJoin > maxJoinLatencyMs ? "join_latency_above_threshold" : null,
      worstPublish > maxPublishLatencyMs ? "publish_latency_above_threshold" : null,
      worstSubscribe > maxSubscribeLatencyMs ? "subscribe_latency_above_threshold" : null,
    ].filter(Boolean),
    worstLatency: {
      joinMs: worstJoin || null,
      publishMs: worstPublish || null,
      subscribeMs: worstSubscribe || null,
    },
  };
}
