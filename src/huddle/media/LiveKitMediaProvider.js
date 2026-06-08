import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectLiveKitRoom,
  createLiveKitConnectionPlan,
  disconnectLiveKitRoom,
} from "./LiveKitConnection";
import { getCachedLiveKitSdkDiagnostics } from "./LiveKitSdk";
import {
  createHuddleMediaDeviceV2,
  createHuddleActiveSpeakerDiagnosticsV2,
  createHuddleMediaDiagnosticsV2,
  createHuddleMediaParticipantV2,
  createHuddleMediaTrackV2,
  createHuddleNetworkQualityDiagnosticsV2,
  createRemotePeerState,
  HUDDLE_MEDIA_CONNECTION_STATES,
  HUDDLE_MEDIA_NETWORK_QUALITY,
  HUDDLE_MEDIA_PROVIDER_LIVEKIT,
  HUDDLE_MEDIA_PUBLICATION_STATES,
  HUDDLE_MEDIA_SUBSCRIPTION_STATES,
  HUDDLE_MEDIA_TRACK_KINDS,
  HUDDLE_MEDIA_TRACK_SOURCES,
} from "./mediaState";
import {
  createProviderMetricsSnapshot,
  elapsedMs,
  metricNow,
} from "./providerDiagnostics";

export const LIVEKIT_MEDIA_PROVIDER_READINESS = Object.freeze({
  modeled: true,
  enabled: false,
  active: false,
  sdkAvailable: false,
  tokenReady: false,
  roomReady: false,
  participantReady: false,
  trackReady: false,
  canConnect: false,
  canJoinRooms: false,
  canSubscribeToTracks: false,
  fallbackProvider: "mesh",
  reason: "livekit_provider_disabled",
});

export const LIVEKIT_ROOM_STATES = Object.freeze({
  disabled: "disabled",
  idle: "idle",
  connecting: "connecting",
  connected: "connected",
  reconnecting: "reconnecting",
  disconnected: "disconnected",
  failed: "failed",
});

export const LIVEKIT_PROVIDER_IDENTITY_KINDS = Object.freeze({
  workspaceUser: "workspace_user",
  guest: "guest",
  aiAgent: "ai_agent",
  system: "system",
  unknown: "unknown",
});

export const LIVEKIT_MEDIA_PUBLICATION_REASONS = Object.freeze({
  MEDIA_PUBLISHED: "livekit_media_published",
  MEDIA_PUBLICATION_FAILED: "livekit_media_publication_failed",
  MICROPHONE_PUBLICATION_FAILED: "livekit_microphone_publication_failed",
  CAMERA_PUBLICATION_FAILED: "livekit_camera_publication_failed",
  MICROPHONE_TOGGLE_FAILED: "livekit_microphone_toggle_failed",
  CAMERA_TOGGLE_FAILED: "livekit_camera_toggle_failed",
  SCREEN_SHARE_PUBLISHED: "livekit_screen_share_published",
  SCREEN_SHARE_STOPPED: "livekit_screen_share_stopped",
  SCREEN_SHARE_PUBLICATION_FAILED: "livekit_screen_share_publication_failed",
  SCREEN_SHARE_STOP_FAILED: "livekit_screen_share_stop_failed",
});

const noop = () => {};

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeMetadata(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resolveLocalWorkspaceId({ currentUser = null, workspaceId = null } = {}) {
  return (
    safeString(workspaceId) ||
    safeString(currentUser?.workspaceId) ||
    safeString(currentUser?.workspace_id) ||
    safeString(globalThis?.window?.__WORKSPACE_ID__) ||
    null
  );
}

function remoteParticipantsFromRoom(room) {
  return Array.from(room?.remoteParticipants?.values?.() || []);
}

function mapValues(value) {
  if (!value) return [];
  if (typeof value.values === "function") return Array.from(value.values());
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
}

function publicationKey(publication = {}, index = 0) {
  return (
    safeString(publication.trackSid) ||
    safeString(publication.sid) ||
    safeString(publication.track?.sid) ||
    safeString(publication.track?.mediaStreamTrack?.id) ||
    safeString(publication.trackName) ||
    safeString(publication.name) ||
    `publication:${index}`
  );
}

function uniqueTrackPublications(participant = {}) {
  const publications = [
    ...mapValues(participant.trackPublications),
    ...mapValues(participant.audioTrackPublications),
    ...mapValues(participant.videoTrackPublications),
    ...mapValues(participant.tracks),
    ...mapValues(participant.audioTracks),
    ...mapValues(participant.videoTracks),
  ];

  return Array.from(
    new Map(publications.map((publication, index) => [
      publicationKey(publication, index),
      publication,
    ])).values()
  );
}

function mediaTrackFromPublication(publication = {}) {
  return (
    publication.track?.mediaStreamTrack ||
    publication.mediaStreamTrack ||
    publication.track ||
    null
  );
}

function mediaStreamTrackFromPublication(publication = {}) {
  const track = mediaTrackFromPublication(publication);
  if (typeof MediaStreamTrack !== "undefined" && track instanceof MediaStreamTrack) {
    return track;
  }
  return track?.mediaStreamTrack || null;
}

function streamIdFromPublication(publication = {}) {
  return (
    safeString(publication.track?.mediaStream?.id) ||
    safeString(publication.track?.mediaStreamID) ||
    safeString(publication.track?.mediaStreamId) ||
    null
  );
}

function mediaStreamFromPublications(publications = []) {
  if (typeof MediaStream === "undefined") return null;
  const mediaTracks = [];
  const seen = new Set();

  publications.forEach((publication) => {
    const track = mediaStreamTrackFromPublication(publication);
    const id = safeString(track?.id);
    if (!track || (id && seen.has(id))) return;
    if (id) seen.add(id);
    mediaTracks.push(track);
  });

  return mediaTracks.length ? new MediaStream(mediaTracks) : null;
}

function liveKitLocalStream(room) {
  return mediaStreamFromPublications(uniqueTrackPublications(room?.localParticipant));
}

function liveKitRemoteStream(participant = {}) {
  const subscribedPublications = uniqueTrackPublications(participant).filter((publication) => (
    publication.isSubscribed === true ||
    Boolean(publication.track) ||
    Boolean(mediaStreamTrackFromPublication(publication))
  ));
  return mediaStreamFromPublications(subscribedPublications);
}

function liveKitParticipantUsername(participant = {}) {
  const metadata = safeMetadata(participant.metadata);
  return (
    safeString(participant.name) ||
    safeString(metadata.username) ||
    safeString(metadata.name) ||
    safeString(participant.identity) ||
    ""
  );
}

function liveKitParticipantMuted(participant = {}) {
  if (typeof participant.isMicrophoneEnabled === "boolean") {
    return !participant.isMicrophoneEnabled;
  }
  const microphone = uniqueTrackPublications(participant).find(
    (publication) => trackSource(publication) === HUDDLE_MEDIA_TRACK_SOURCES.microphone
  );
  return microphone ? microphone.isMuted === true : false;
}

function liveKitParticipantCameraOff(participant = {}) {
  if (typeof participant.isCameraEnabled === "boolean") {
    return !participant.isCameraEnabled;
  }
  const camera = uniqueTrackPublications(participant).find(
    (publication) => trackSource(publication) === HUDDLE_MEDIA_TRACK_SOURCES.camera
  );
  return camera ? camera.isMuted === true || publicationEnabled(camera) === false : true;
}

function liveKitParticipantScreenSharing(participant = {}) {
  if (typeof participant.isScreenShareEnabled === "boolean") {
    return participant.isScreenShareEnabled;
  }
  return uniqueTrackPublications(participant).some(
    (publication) => (
      trackSource(publication) === HUDDLE_MEDIA_TRACK_SOURCES.screen &&
      publicationState(publication) === HUDDLE_MEDIA_PUBLICATION_STATES.published
    )
  );
}

export function createLiveKitRemotePeers(remoteParticipants = []) {
  return (remoteParticipants || []).map((participant) => createRemotePeerState({
    userId: participantIdentity(participant),
    username: liveKitParticipantUsername(participant),
    stream: liveKitRemoteStream(participant),
    isMuted: liveKitParticipantMuted(participant),
    isCameraOff: liveKitParticipantCameraOff(participant),
    isScreenSharing: liveKitParticipantScreenSharing(participant),
  }));
}

function activeSpeakerIdFromRoom(room) {
  const speaker = room?.activeSpeakers?.[0];
  return speaker ? participantIdentity(speaker) : null;
}

function normalizeNetworkQuality(quality) {
  const normalized = safeString(quality).toLowerCase();
  if (normalized === "poor" || normalized === "lost") return HUDDLE_MEDIA_NETWORK_QUALITY.poor;
  if (normalized === "good") return HUDDLE_MEDIA_NETWORK_QUALITY.ok;
  return HUDDLE_MEDIA_NETWORK_QUALITY.good;
}

function networkQualityFromRoom(room) {
  const qualities = [
    room?.localParticipant?.connectionQuality,
    ...remoteParticipantsFromRoom(room).map((participant) => participant.connectionQuality),
  ].map(normalizeNetworkQuality);

  if (qualities.includes(HUDDLE_MEDIA_NETWORK_QUALITY.poor)) return HUDDLE_MEDIA_NETWORK_QUALITY.poor;
  if (qualities.includes(HUDDLE_MEDIA_NETWORK_QUALITY.ok)) return HUDDLE_MEDIA_NETWORK_QUALITY.ok;
  return HUDDLE_MEDIA_NETWORK_QUALITY.good;
}

function boundedMetricItems(items = [], limit = 50) {
  return (Array.isArray(items) ? items : []).slice(-limit);
}

function liveKitActiveSpeakerDiagnostics(room, transitions = []) {
  const speakers = Array.isArray(room?.activeSpeakers) ? room.activeSpeakers : [];
  return createHuddleActiveSpeakerDiagnosticsV2({
    activeSpeakerId: activeSpeakerIdFromRoom(room),
    speakerRanking: speakers.map((speaker, index) => ({
      participantId: participantIdentity(speaker),
      rank: index + 1,
      isSpeaking: speaker.isSpeaking !== false,
      audioLevel: Number.isFinite(Number(speaker.audioLevel)) ? Number(speaker.audioLevel) : null,
    })),
    transitions,
  });
}

function participantQualityDiagnostics(participant = {}, statsByParticipant = {}) {
  const participantId = participantIdentity(participant);
  const stats = statsByParticipant[participantId] || {};
  return {
    participantId,
    quality: normalizeNetworkQuality(participant.connectionQuality),
    rttMs: stats.rttMs ?? null,
    packetLoss: stats.packetLoss ?? null,
    bitrateKbps: stats.bitrateKbps ?? null,
  };
}

function liveKitNetworkQualityDiagnostics(room, statsByParticipant = {}, transitions = []) {
  const participants = [
    room?.localParticipant,
    ...remoteParticipantsFromRoom(room),
  ].filter(Boolean).map((participant) => participantQualityDiagnostics(participant, statsByParticipant));
  const qualities = participants.map((participant) => participant.quality);
  const worstQuality = qualities.includes(HUDDLE_MEDIA_NETWORK_QUALITY.poor)
    ? HUDDLE_MEDIA_NETWORK_QUALITY.poor
    : qualities.includes(HUDDLE_MEDIA_NETWORK_QUALITY.ok)
      ? HUDDLE_MEDIA_NETWORK_QUALITY.ok
      : HUDDLE_MEDIA_NETWORK_QUALITY.good;
  const rtts = participants.map((participant) => participant.rttMs).filter((value) => Number.isFinite(value));
  const losses = participants.map((participant) => participant.packetLoss).filter((value) => Number.isFinite(value));
  const bitrateTotal = participants.reduce((total, participant) => total + (Number(participant.bitrateKbps) || 0), 0);

  return createHuddleNetworkQualityDiagnosticsV2({
    quality: worstQuality,
    participants,
    transitions,
    aggregate: {
      worstQuality,
      averageRttMs: rtts.length
        ? Math.round(rtts.reduce((total, value) => total + value, 0) / rtts.length)
        : null,
      averagePacketLoss: losses.length
        ? Number((losses.reduce((total, value) => total + value, 0) / losses.length).toFixed(4))
        : null,
      totalBitrateKbps: bitrateTotal || null,
    },
  });
}

function emptyParticipantStats() {
  return {
    rttSamples: [],
    packetsLost: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
  };
}

function addRtcStatsEntry(stats, entry) {
  if (!entry || typeof entry !== "object") return;
  if (entry.type === "remote-inbound-rtp" && Number.isFinite(Number(entry.roundTripTime))) {
    stats.rttSamples.push(Number(entry.roundTripTime) * 1000);
  }
  if (entry.type === "candidate-pair" && (entry.selected || entry.nominated)) {
    if (Number.isFinite(Number(entry.currentRoundTripTime))) {
      stats.rttSamples.push(Number(entry.currentRoundTripTime) * 1000);
    }
  }
  if (entry.type === "outbound-rtp") {
    stats.packetsLost += Number(entry.packetsLost || 0);
    stats.packetsReceived += Number(entry.packetsSent || 0);
    stats.bytesSent += Number(entry.bytesSent || 0);
  }
  if (entry.type === "inbound-rtp") {
    stats.packetsLost += Number(entry.packetsLost || 0);
    stats.packetsReceived += Number(entry.packetsReceived || 0);
    stats.bytesReceived += Number(entry.bytesReceived || 0);
  }
}

async function collectLiveKitNetworkStats(room) {
  const participants = [
    room?.localParticipant,
    ...remoteParticipantsFromRoom(room),
  ].filter(Boolean);
  const collectedAt = metricNow();
  const next = {};

  for (const participant of participants) {
    const participantId = participantIdentity(participant);
    const stats = emptyParticipantStats();
    for (const publication of uniqueTrackPublications(participant)) {
      const report = await publication.track?.getRTCStatsReport?.().catch(() => null);
      if (!report?.forEach) continue;
      report.forEach((entry) => addRtcStatsEntry(stats, entry));
    }

    const packetsTotal = stats.packetsReceived + stats.packetsLost;
    const bytesTotal = stats.bytesSent + stats.bytesReceived;
    next[participantId] = {
      observedAt: new Date().toISOString(),
      rttMs: stats.rttSamples.length
        ? Math.round(stats.rttSamples.reduce((total, value) => total + value, 0) / stats.rttSamples.length)
        : null,
      packetLoss: packetsTotal > 0
        ? Number((stats.packetsLost / packetsTotal).toFixed(4))
        : null,
      bitrateKbps: bytesTotal > 0 ? Math.round((bytesTotal * 8) / 1000) : null,
      bytesSent: stats.bytesSent,
      bytesReceived: stats.bytesReceived,
      collectedAt,
    };
  }

  return next;
}

function createInitialLiveKitMetrics() {
  return {
    joinStartedAt: null,
    joinLatencyMs: null,
    publishLatencyMs: null,
    subscribeLatencyMs: null,
    screenShareLatencyMs: null,
    firstSubscribeAt: null,
    roomStartedAt: null,
    roomEndedAt: null,
    reconnectStartedAt: null,
    reconnectLatencyMs: null,
    connectionStateTransitions: [],
    trackFailures: [],
    screenShareEvents: [],
    activeSpeakerEvents: [],
    networkQualityEvents: [],
  };
}

function recordMetricTransition(metrics, state, metadata = {}) {
  metrics.connectionStateTransitions = boundedMetricItems([
    ...metrics.connectionStateTransitions,
    {
      state,
      observedAt: new Date().toISOString(),
      ...metadata,
    },
  ]);
}

function recordMetricFailure(metrics, failure) {
  metrics.trackFailures = boundedMetricItems([
    ...metrics.trackFailures,
    {
      observedAt: new Date().toISOString(),
      ...failure,
    },
  ]);
}

function recordMetricEvent(metrics, key, event) {
  metrics[key] = boundedMetricItems([
    ...(metrics[key] || []),
    {
      observedAt: new Date().toISOString(),
      ...event,
    },
  ]);
}

function roomStateFromLiveKitRoom(room, fallback = LIVEKIT_ROOM_STATES.disabled) {
  const state = safeString(room?.state).toLowerCase();
  if (state === "connected") return LIVEKIT_ROOM_STATES.connected;
  if (state === "connecting") return LIVEKIT_ROOM_STATES.connecting;
  if (state === "reconnecting") return LIVEKIT_ROOM_STATES.reconnecting;
  if (state === "disconnected") return LIVEKIT_ROOM_STATES.disconnected;
  return fallback;
}

function safeRoomName({
  workspaceId = null,
  sessionId = null,
  providerRoomId = null,
  roomName = null,
} = {}) {
  return (
    safeString(providerRoomId) ||
    safeString(roomName) ||
    `livekit:workspace:${safeString(workspaceId) || "unknown"}:huddle:${safeString(sessionId) || "unmapped"}`
  );
}

function connectionStateFromRoomState(roomState) {
  if (roomState === LIVEKIT_ROOM_STATES.connected) return HUDDLE_MEDIA_CONNECTION_STATES.joined;
  if (
    roomState === LIVEKIT_ROOM_STATES.connecting ||
    roomState === LIVEKIT_ROOM_STATES.reconnecting
  ) {
    return HUDDLE_MEDIA_CONNECTION_STATES.connecting;
  }
  if (roomState === LIVEKIT_ROOM_STATES.failed) return HUDDLE_MEDIA_CONNECTION_STATES.failed;
  return HUDDLE_MEDIA_CONNECTION_STATES.idle;
}

function participantIdentity(participant = {}) {
  const metadata = safeMetadata(participant.metadata);
  return (
    safeString(participant.identity) ||
    safeString(participant.sid) ||
    safeString(participant.participantId) ||
    safeString(participant.userId) ||
    safeString(metadata.participantId) ||
    "unknown"
  );
}

export function createLiveKitProviderIdentityMapping({
  participant = {},
  participantId = participantIdentity(participant),
  deviceId = null,
  userId = null,
  guestId = null,
  identityKind = null,
} = {}) {
  const metadata = safeMetadata(participant.metadata);
  const resolvedUserId = safeString(userId) || safeString(participant.userId) || safeString(metadata.userId) || null;
  const resolvedGuestId = safeString(guestId) || safeString(participant.guestId) || safeString(metadata.guestId) || null;
  const resolvedKind =
    safeString(identityKind) ||
    safeString(metadata.identityKind) ||
    (resolvedUserId
      ? LIVEKIT_PROVIDER_IDENTITY_KINDS.workspaceUser
      : resolvedGuestId
        ? LIVEKIT_PROVIDER_IDENTITY_KINDS.guest
        : LIVEKIT_PROVIDER_IDENTITY_KINDS.unknown);
  const resolvedDeviceId =
    safeString(deviceId) ||
    safeString(participant.deviceId) ||
    safeString(metadata.deviceId) ||
    `livekit:${participantId}:device`;

  return {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    providerIdentity: safeString(participant.identity) || participantId,
    providerParticipantSid: safeString(participant.sid) || null,
    participantId,
    deviceId: resolvedDeviceId,
    userId: resolvedUserId,
    guestId: resolvedGuestId,
    identityKind: resolvedKind,
    diagnostics: {
      hasProviderIdentity: Boolean(safeString(participant.identity)),
      hasProviderParticipantSid: Boolean(safeString(participant.sid)),
      hasParticipantId: Boolean(participantId && participantId !== "unknown"),
      hasDeviceId: Boolean(resolvedDeviceId),
      hasUserId: Boolean(resolvedUserId),
      hasGuestId: Boolean(resolvedGuestId),
      readyForToken: false,
      readyForRoomJoin: false,
    },
  };
}

export function createLiveKitRoomModel({
  workspaceId = null,
  sessionId = null,
  providerRoomId = null,
  roomName = null,
  roomSid = null,
  roomState = LIVEKIT_ROOM_STATES.disabled,
  metadata = {},
} = {}) {
  const providerRoomName = safeRoomName({
    workspaceId,
    sessionId,
    providerRoomId,
    roomName,
  });
  const safeRoomState = Object.values(LIVEKIT_ROOM_STATES).includes(roomState)
    ? roomState
    : LIVEKIT_ROOM_STATES.disabled;

  return {
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    providerRoomId: providerRoomName,
    roomName: providerRoomName,
    roomSid: safeString(roomSid) || null,
    workspaceId: safeString(workspaceId) || null,
    sessionId: safeString(sessionId) || null,
    roomState: safeRoomState,
    connectionState: connectionStateFromRoomState(safeRoomState),
    roomProvisioned: false,
    canProvision: false,
    canConnect: false,
    metadata: {
      region: safeString(metadata.region) || null,
      egressEnabled: false,
      ingressEnabled: false,
      recordingEnabled: false,
      transcriptionEnabled: false,
    },
    diagnostics: {
      readiness: {
        modeled: true,
        enabled: false,
        sdkAvailable: false,
        tokenReady: false,
        roomReady: false,
        reason: "livekit_room_model_only",
      },
      hasRoomName: Boolean(providerRoomName),
      hasRoomSid: Boolean(roomSid),
      roomProvisioned: false,
    },
  };
}

function trackSource(publication = {}) {
  const source = safeString(publication.source || publication.track?.source).toLowerCase();
  if (source === "screen_share" || source === "screen_share_audio" || source === "screen") {
    return HUDDLE_MEDIA_TRACK_SOURCES.screen;
  }
  if (source === "camera") return HUDDLE_MEDIA_TRACK_SOURCES.camera;
  if (source === "microphone") return HUDDLE_MEDIA_TRACK_SOURCES.microphone;
  return (publication.kind || publication.track?.kind) === "video"
    ? HUDDLE_MEDIA_TRACK_SOURCES.camera
    : HUDDLE_MEDIA_TRACK_SOURCES.microphone;
}

function trackKind(source, publication = {}) {
  if (source === HUDDLE_MEDIA_TRACK_SOURCES.screen) {
    return HUDDLE_MEDIA_TRACK_KINDS.screen;
  }
  return (publication.kind || publication.track?.kind) === "video"
    ? HUDDLE_MEDIA_TRACK_KINDS.video
    : HUDDLE_MEDIA_TRACK_KINDS.audio;
}

function publicationState(publication = {}) {
  if (publication.error || publication.isFailed) {
    return HUDDLE_MEDIA_PUBLICATION_STATES.failed;
  }
  if (publication.isPublishing || publication.isPending) {
    return HUDDLE_MEDIA_PUBLICATION_STATES.publishing;
  }
  if (
    publication.track ||
    publication.trackSid ||
    publication.sid ||
    publication.isPublished ||
    publication.isLocal ||
    publication.isSubscribed
  ) {
    return HUDDLE_MEDIA_PUBLICATION_STATES.published;
  }
  return HUDDLE_MEDIA_PUBLICATION_STATES.unpublished;
}

function subscriptionState(publication = {}, { isLocal = false } = {}) {
  if (isLocal) return HUDDLE_MEDIA_SUBSCRIPTION_STATES.subscribed;
  if (publication.isSubscribed) return HUDDLE_MEDIA_SUBSCRIPTION_STATES.subscribed;
  if (publication.isSubscriptionPending || publication.isSubscribing) {
    return HUDDLE_MEDIA_SUBSCRIPTION_STATES.subscribing;
  }
  if (publication.subscriptionError || publication.isSubscriptionFailed) {
    return HUDDLE_MEDIA_SUBSCRIPTION_STATES.failed;
  }
  return HUDDLE_MEDIA_SUBSCRIPTION_STATES.unsubscribed;
}

function publicationEnabled(publication = {}) {
  if (typeof publication.isEnabled === "boolean") return publication.isEnabled;
  if (typeof publication.track?.mediaStreamTrack?.enabled === "boolean") {
    return publication.track.mediaStreamTrack.enabled;
  }
  return publication.isMuted !== true;
}

function sanitizeLiveKitMediaFailure(error, reason) {
  return {
    reason,
    name: safeString(error?.name) || null,
    message: safeString(error?.message) || reason,
  };
}

export async function publishInitialLiveKitMedia(room) {
  const publishStartedAt = metricNow();
  const diagnostics = {
    microphone: { ok: false, published: false },
    camera: { ok: false, published: false },
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalPublishLatencyMs: null,
  };

  try {
    const microphoneStartedAt = metricNow();
    const microphonePublication = await room?.localParticipant?.setMicrophoneEnabled?.(true);
    diagnostics.microphone = {
      ok: Boolean(microphonePublication || room?.localParticipant?.isMicrophoneEnabled),
      published: Boolean(microphonePublication || room?.localParticipant?.isMicrophoneEnabled),
      trackSid: safeString(microphonePublication?.trackSid) || null,
      source: HUDDLE_MEDIA_TRACK_SOURCES.microphone,
      latencyMs: elapsedMs(microphoneStartedAt),
    };
  } catch (error) {
    diagnostics.microphone = {
      ok: false,
      published: false,
      failure: sanitizeLiveKitMediaFailure(
        error,
        LIVEKIT_MEDIA_PUBLICATION_REASONS.MICROPHONE_PUBLICATION_FAILED
      ),
      latencyMs: null,
    };
  }

  try {
    const cameraStartedAt = metricNow();
    const cameraPublication = await room?.localParticipant?.setCameraEnabled?.(true);
    diagnostics.camera = {
      ok: Boolean(cameraPublication || room?.localParticipant?.isCameraEnabled),
      published: Boolean(cameraPublication || room?.localParticipant?.isCameraEnabled),
      trackSid: safeString(cameraPublication?.trackSid) || null,
      source: HUDDLE_MEDIA_TRACK_SOURCES.camera,
      latencyMs: elapsedMs(cameraStartedAt),
    };
  } catch (error) {
    diagnostics.camera = {
      ok: false,
      published: false,
      failure: sanitizeLiveKitMediaFailure(
        error,
        LIVEKIT_MEDIA_PUBLICATION_REASONS.CAMERA_PUBLICATION_FAILED
      ),
      latencyMs: null,
    };
  }

  diagnostics.completedAt = new Date().toISOString();
  diagnostics.totalPublishLatencyMs = elapsedMs(publishStartedAt);
  const ok = Boolean(diagnostics.microphone.ok && diagnostics.camera.ok);

  return {
    ok,
    reason: ok
      ? LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLISHED
      : LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLICATION_FAILED,
    diagnostics,
  };
}

export async function startLiveKitScreenShare(room) {
  const startedAt = metricNow();
  const diagnostics = {
    ok: false,
    action: "start",
    startedAt: new Date().toISOString(),
    completedAt: null,
    latencyMs: null,
    publicationCount: 0,
    publications: [],
  };

  if (!room?.localParticipant?.setScreenShareEnabled) {
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.latencyMs = elapsedMs(startedAt);
    diagnostics.failure = {
      reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLICATION_FAILED,
      message: "LiveKit screen share API unavailable",
    };
    return {
      ok: false,
      reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLICATION_FAILED,
      diagnostics,
    };
  }

  try {
    const result = await room.localParticipant.setScreenShareEnabled(true);
    const publications = Array.isArray(result) ? result : result ? [result] : [];
    diagnostics.publications = publications.map((publication) => ({
      trackSid: safeString(publication?.trackSid) || safeString(publication?.sid) || null,
      source: trackSource(publication),
      publicationState: publicationState(publication),
      subscriptionState: subscriptionState(publication, { isLocal: true }),
    }));
    diagnostics.publicationCount = diagnostics.publications.length;
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.latencyMs = elapsedMs(startedAt);
    diagnostics.ok = Boolean(room.localParticipant.isScreenShareEnabled || diagnostics.publicationCount > 0);
    return {
      ok: diagnostics.ok,
      reason: diagnostics.ok
        ? LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLISHED
        : LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLICATION_FAILED,
      diagnostics,
    };
  } catch (error) {
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.latencyMs = elapsedMs(startedAt);
    diagnostics.failure = sanitizeLiveKitMediaFailure(
      error,
      LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLICATION_FAILED
    );
    return {
      ok: false,
      reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLICATION_FAILED,
      diagnostics,
    };
  }
}

export async function stopLiveKitScreenShare(room) {
  const startedAt = metricNow();
  const diagnostics = {
    ok: false,
    action: "stop",
    startedAt: new Date().toISOString(),
    completedAt: null,
    latencyMs: null,
  };

  if (!room?.localParticipant?.setScreenShareEnabled) {
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.latencyMs = elapsedMs(startedAt);
    diagnostics.failure = {
      reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOP_FAILED,
      message: "LiveKit screen share API unavailable",
    };
    return {
      ok: false,
      reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOP_FAILED,
      diagnostics,
    };
  }

  try {
    await room.localParticipant.setScreenShareEnabled(false);
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.latencyMs = elapsedMs(startedAt);
    diagnostics.ok = !room.localParticipant.isScreenShareEnabled;
    return {
      ok: diagnostics.ok,
      reason: diagnostics.ok
        ? LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOPPED
        : LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOP_FAILED,
      diagnostics,
    };
  } catch (error) {
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.latencyMs = elapsedMs(startedAt);
    diagnostics.failure = sanitizeLiveKitMediaFailure(
      error,
      LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOP_FAILED
    );
    return {
      ok: false,
      reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOP_FAILED,
      diagnostics,
    };
  }
}

export function createLiveKitTrackMapping({
  publication = {},
  participantId,
  deviceId,
  userId = null,
  isLocal = false,
} = {}) {
  const source = trackSource(publication);
  const kind = trackKind(source, publication);
  const publishState = publicationState(publication);
  const subscribeState = subscriptionState(publication, { isLocal });
  const mediaTrack = mediaStreamTrackFromPublication(publication);
  const providerTrackId =
    safeString(publication.trackSid) ||
    safeString(publication.sid) ||
    safeString(publication.track?.sid) ||
    null;
  const trackId =
    providerTrackId ||
    `${deviceId}:${kind}:${source}:${safeString(publication.trackName) || safeString(publication.name) || "unpublished"}`;
  const enabled = publicationEnabled(publication);

  return {
    trackId,
    participantId,
    deviceId,
    userId,
    kind,
    source,
    providerTrackId,
    mediaTrackId: safeString(mediaTrack?.id) || null,
    streamId: streamIdFromPublication(publication),
    enabled,
    muted: publication.isMuted === true,
    publicationState: publishState,
    subscriptionState: subscribeState,
    isLocal,
    diagnostics: {
      hasProviderTrackId: Boolean(providerTrackId),
      hasMediaTrack: Boolean(mediaTrack),
      publicationReady: publishState === HUDDLE_MEDIA_PUBLICATION_STATES.published,
      subscriptionReady:
        isLocal || subscribeState === HUDDLE_MEDIA_SUBSCRIPTION_STATES.subscribed,
      source,
      kind,
    },
  };
}

export function adaptLiveKitTrackPublication({
  publication = {},
  participantId,
  deviceId,
  userId = null,
  isLocal = false,
} = {}) {
  const mapping = createLiveKitTrackMapping({
    publication,
    participantId,
    deviceId,
    userId,
    isLocal,
  });
  return createHuddleMediaTrackV2({
    trackId: mapping.trackId,
    participantId,
    deviceId,
    userId,
    kind: mapping.kind,
    source: mapping.source,
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    providerTrackId: mapping.providerTrackId,
    mediaTrackId: mapping.mediaTrackId,
    streamId: mapping.streamId,
    enabled: mapping.enabled,
    muted: mapping.muted,
    publicationState: mapping.publicationState,
    subscriptionState: mapping.subscriptionState,
    isLocal,
    metadata: {
      name: safeString(publication.trackName) || safeString(publication.name) || null,
      source: mapping.source,
      isScreenShare: mapping.source === HUDDLE_MEDIA_TRACK_SOURCES.screen,
      diagnostics: mapping.diagnostics,
    },
  });
}

export function adaptLiveKitParticipant({
  participant = {},
  isLocal = false,
} = {}) {
  const participantId = participantIdentity(participant);
  const identity = createLiveKitProviderIdentityMapping({ participant, participantId });
  const userId = identity.userId;
  const deviceId = identity.deviceId;
  const metadata = safeMetadata(participant.metadata);
  const uniquePublications = uniqueTrackPublications(participant);
  const tracks = uniquePublications.map((publication) =>
    adaptLiveKitTrackPublication({
      publication,
      participantId,
      deviceId,
      userId,
      isLocal,
    })
  );

  return {
    participant: createHuddleMediaParticipantV2({
      participantId,
      userId,
      username:
        safeString(participant.name) ||
        safeString(metadata.username) ||
        "",
      isLocal,
      devices: [deviceId],
      tracks: tracks.map((track) => track.trackId),
      metadata: {
        providerIdentity: identity.providerIdentity,
        providerSid: identity.providerParticipantSid,
        identityKind: identity.identityKind,
        diagnostics: identity.diagnostics,
      },
    }),
    device: createHuddleMediaDeviceV2({
      deviceId,
      participantId,
      userId,
      provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
      isLocal,
      connectionState: isLocal || participant.isConnected || participant.isActive
        ? HUDDLE_MEDIA_CONNECTION_STATES.joined
        : HUDDLE_MEDIA_CONNECTION_STATES.idle,
      tracks: tracks.map((track) => track.trackId),
      metadata: {
        providerIdentity: identity.providerIdentity,
        providerSid: identity.providerParticipantSid,
        diagnostics: identity.diagnostics,
      },
    }),
    tracks,
    providerIdentity: identity,
    diagnostics: {
      ...identity.diagnostics,
      trackCount: tracks.length,
      cameraTrackCount: tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.camera).length,
      microphoneTrackCount: tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.microphone).length,
      screenShareTrackCount: tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen).length,
    },
  };
}

export function buildLiveKitMediaStateV2({
  room = null,
  localParticipant = null,
  remoteParticipants = [],
  connectionState = HUDDLE_MEDIA_CONNECTION_STATES.idle,
  roomState = "disabled",
  canary = null,
  sdkDiagnostics = null,
  connectionPlan = null,
  activeSpeakerDiagnostics = null,
  networkQualityDiagnostics = null,
  revision = 0,
} = {}) {
  const roomModel = room || createLiveKitRoomModel({ roomState });
  const adapted = [];
  if (localParticipant) {
    adapted.push(adaptLiveKitParticipant({ participant: localParticipant, isLocal: true }));
  }
  for (const participant of remoteParticipants || []) {
    adapted.push(adaptLiveKitParticipant({ participant, isLocal: false }));
  }

  const participants = adapted.map((item) => item.participant);
  const devices = adapted.map((item) => item.device);
  const tracks = adapted.flatMap((item) => item.tracks);
  const screenShareParticipantIds = tracks
    .filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen)
    .map((track) => track.participantId);
  const uniqueScreenShareParticipantIds = Array.from(new Set(screenShareParticipantIds));
  const diagnostics = createHuddleMediaDiagnosticsV2({
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    participantCount: participants.length,
    deviceCount: devices.length,
    trackCount: tracks.length,
    screenShareActive: uniqueScreenShareParticipantIds.length > 0,
    screenShareParticipantIds: uniqueScreenShareParticipantIds,
    metadata: {
      readiness: createLiveKitProviderReadinessDiagnostics({
        room: roomModel,
        participants,
        tracks,
        canary,
        sdkDiagnostics,
        connectionPlan,
      }),
      sdkAvailability: sdkDiagnostics?.status || "not_loaded",
      connectionState: roomModel.connectionState || connectionState,
      roomState: roomModel.roomState || roomState,
      room: roomModel,
      connection: connectionPlan?.diagnostics || null,
      canary,
      revision,
      participantDiagnostics: adapted.map((item) => item.diagnostics),
      trackDiagnostics: tracks.map((track) => track.metadata?.diagnostics).filter(Boolean),
      activeSpeaker: activeSpeakerDiagnostics,
      networkQuality: networkQualityDiagnostics,
    },
  });

  return {
    version: 2,
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    connectionState: roomModel.connectionState || connectionState,
    room: roomModel,
    participants,
    devices,
    tracks,
    diagnostics,
  };
}

export function createLiveKitProviderReadinessDiagnostics({
  room = null,
  participants = [],
  tracks = [],
  tokenReady = false,
  canary = null,
  sdkDiagnostics = null,
  connectionPlan = null,
} = {}) {
  const roomModel = room || createLiveKitRoomModel();
  const sdkAvailable = Boolean(sdkDiagnostics?.available);
  const canaryEnabled = Boolean(canary?.canaryEnabled || canary?.enabled);
  const canaryEligible = Boolean(canary?.canaryEligible);
  const roomConnected = roomModel.roomState === LIVEKIT_ROOM_STATES.connected;
  const liveKitActive =
    roomConnected ||
    connectionPlan?.activeProvider === HUDDLE_MEDIA_PROVIDER_LIVEKIT ||
    connectionPlan?.reason === "livekit_connected";
  const canConnect = Boolean(connectionPlan?.canConnect || roomConnected);
  const cameraTrackCount = tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.camera).length;
  const microphoneTrackCount = tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.microphone).length;
  const screenShareTrackCount = tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen).length;

  return {
    ...LIVEKIT_MEDIA_PROVIDER_READINESS,
    enabled: canaryEnabled,
    active: liveKitActive,
    sdkAvailable,
    tokenReady: Boolean(tokenReady || liveKitActive),
    roomReady: roomConnected,
    participantReady: liveKitActive && participants.length > 0,
    trackReady: liveKitActive && tracks.length > 0,
    canConnect,
    canJoinRooms: canConnect,
    canSubscribeToTracks: liveKitActive,
    room: {
      state: roomModel.roomState,
      hasRoomIdentity: Boolean(roomModel.providerRoomId),
      provisioned: false,
      canConnect,
    },
    participants: {
      count: participants.length,
      ready: liveKitActive && participants.length > 0,
    },
    tracks: {
      count: tracks.length,
      cameraTrackCount,
      microphoneTrackCount,
      screenShareTrackCount,
      ready: liveKitActive && tracks.length > 0,
    },
    sdk: sdkDiagnostics || getCachedLiveKitSdkDiagnostics(),
    connection: connectionPlan?.diagnostics || null,
    canary: canary
      ? {
          enabled: canaryEnabled,
          eligible: canaryEligible,
          workspaceAllowed: Boolean(canary.workspaceAllowed),
          runtimeConnectionsEnabled: Boolean(canary.runtimeConnectionsEnabled),
          reason: canary.reason || null,
        }
      : null,
    reason:
      connectionPlan?.reason ||
      canary?.reason ||
      LIVEKIT_MEDIA_PROVIDER_READINESS.reason,
  };
}

export function createLiveKitProviderDiagnostics({
  connectionState = HUDDLE_MEDIA_CONNECTION_STATES.idle,
  roomState = "disabled",
  canary = null,
  sdkDiagnostics = null,
  connectionPlan = null,
} = {}) {
  const room = createLiveKitRoomModel({ roomState });
  return createHuddleMediaDiagnosticsV2({
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    metadata: {
      readiness: createLiveKitProviderReadinessDiagnostics({
        room,
        canary,
        sdkDiagnostics,
        connectionPlan,
      }),
      sdkAvailability: sdkDiagnostics?.status || "not_loaded",
      connectionState,
      roomState,
      room,
      connection: connectionPlan?.diagnostics || null,
      canary,
    },
  });
}

export function useLiveKitMediaProvider({
  currentUser = null,
  workspaceId = null,
  canary = null,
} = {}) {
  const resolvedWorkspaceId = resolveLocalWorkspaceId({ currentUser, workspaceId });
  const channelIdRef = useRef(null);
  const huddleIdRef = useRef(null);
  const connectedRoomRef = useRef(null);
  const providerMetricsRef = useRef(createInitialLiveKitMetrics());
  const [connectedRoom, setConnectedRoom] = useState(null);
  const [connectionResult, setConnectionResult] = useState(null);
  const [publicationDiagnostics, setPublicationDiagnostics] = useState(null);
  const [screenShareDiagnostics, setScreenShareDiagnostics] = useState(null);
  const [networkStatsByParticipant, setNetworkStatsByParticipant] = useState({});
  const [connecting, setConnecting] = useState(false);
  const [revision, setRevision] = useState(0);
  const sdkDiagnostics = getCachedLiveKitSdkDiagnostics();
  const connectionPlan = useMemo(() =>
    createLiveKitConnectionPlan({
      canary,
      workspaceId: resolvedWorkspaceId,
      sdkDiagnostics,
    }),
  [canary, resolvedWorkspaceId, sdkDiagnostics]);
  const roomState = roomStateFromLiveKitRoom(
    connectedRoom,
    connectionPlan.roomState || LIVEKIT_ROOM_STATES.disabled
  );
  const activeSpeakerDiagnostics = useMemo(() => {
    void revision;
    return liveKitActiveSpeakerDiagnostics(
      connectedRoom,
      providerMetricsRef.current.activeSpeakerEvents
    );
  }, [connectedRoom, revision]);
  const networkQualityDiagnostics = useMemo(() => {
    void revision;
    return liveKitNetworkQualityDiagnostics(
      connectedRoom,
      networkStatsByParticipant,
      providerMetricsRef.current.networkQualityEvents
    );
  }, [connectedRoom, networkStatsByParticipant, revision]);
  const mediaStateV2 = useMemo(() =>
    buildLiveKitMediaStateV2({
      room: createLiveKitRoomModel({
        workspaceId: resolvedWorkspaceId,
        roomState,
        providerRoomId:
          connectionResult?.connection?.roomName ||
          connectionPlan.room?.providerRoomId ||
          null,
      }),
      localParticipant: connectedRoom?.localParticipant || null,
      remoteParticipants: remoteParticipantsFromRoom(connectedRoom),
      connectionState: connectedRoom
        ? HUDDLE_MEDIA_CONNECTION_STATES.joined
        : connectionPlan.connectionState,
      canary,
      sdkDiagnostics,
      connectionPlan: connectionResult?.plan || connectionPlan,
      activeSpeakerDiagnostics,
      networkQualityDiagnostics,
      revision,
    }),
  [activeSpeakerDiagnostics, canary, connectedRoom, connectionPlan, connectionResult, networkQualityDiagnostics, resolvedWorkspaceId, roomState, sdkDiagnostics, revision]);
  const localStream = useMemo(() => {
    void revision;
    return liveKitLocalStream(connectedRoom);
  }, [connectedRoom, revision]);
  const remotePeers = useMemo(
    () => {
      void revision;
      return createLiveKitRemotePeers(remoteParticipantsFromRoom(connectedRoom));
    },
    [connectedRoom, revision]
  );
  const micEnabled = connectedRoom?.localParticipant?.isMicrophoneEnabled ?? true;
  const camEnabled = connectedRoom?.localParticipant?.isCameraEnabled ?? true;
  const screenSharing = Boolean(
    connectedRoom?.localParticipant?.isScreenShareEnabled ||
    mediaStateV2.tracks.some((track) => track.isLocal && track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen)
  );
  const activeSpeakerId = activeSpeakerDiagnostics.activeSpeakerId || activeSpeakerIdFromRoom(connectedRoom);
  const networkQuality = networkQualityDiagnostics.quality || networkQualityFromRoom(connectedRoom);
  const providerMetrics = useMemo(() => {
    void revision;
    const metrics = providerMetricsRef.current;
    const connectionTimings = connectionResult?.diagnostics?.timings || {};
    return createProviderMetricsSnapshot({
      provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
      connectionState: mediaStateV2.connectionState,
      participantCount: mediaStateV2.participants.length,
      deviceCount: mediaStateV2.devices.length,
      trackCount: mediaStateV2.tracks.length,
      timings: {
        joinMs: metrics.joinLatencyMs || connectionTimings.totalJoinLatencyMs,
        publishMs:
          metrics.publishLatencyMs ||
          publicationDiagnostics?.totalPublishLatencyMs,
        subscribeMs: metrics.subscribeLatencyMs,
        screenShareMs: metrics.screenShareLatencyMs,
        reconnectMs: metrics.reconnectLatencyMs,
        roomDurationMs: metrics.roomStartedAt
          ? elapsedMs(metrics.roomStartedAt, metrics.roomEndedAt || metricNow())
          : null,
        roomEndpointMs: connectionTimings.roomEndpointLatencyMs,
        tokenEndpointMs: connectionTimings.tokenEndpointLatencyMs,
        sdkLoadMs: connectionTimings.prepareLatencyMs,
      },
      transitions: metrics.connectionStateTransitions,
      failures: metrics.trackFailures,
      metadata: {
        canary,
        connectionReason: connectionResult?.reason || null,
        screenShareActive: screenSharing,
        screenShareEventCount: metrics.screenShareEvents.length,
        activeSpeakerEventCount: metrics.activeSpeakerEvents.length,
        networkQualityEventCount: metrics.networkQualityEvents.length,
        screenShare: screenShareDiagnostics,
        activeSpeaker: activeSpeakerDiagnostics,
        networkQuality: networkQualityDiagnostics,
      },
    });
  }, [
    activeSpeakerDiagnostics,
    canary,
    connectionResult,
    mediaStateV2,
    networkQualityDiagnostics,
    publicationDiagnostics,
    revision,
    screenShareDiagnostics,
    screenSharing,
  ]);

  useEffect(() => {
    if (!connectedRoom) {
      setNetworkStatsByParticipant({});
      return undefined;
    }

    let cancelled = false;
    const collect = async () => {
      try {
        const stats = await collectLiveKitNetworkStats(connectedRoom);
        if (!cancelled) {
          setNetworkStatsByParticipant(stats);
          setRevision((value) => value + 1);
        }
      } catch (error) {
        recordMetricFailure(providerMetricsRef.current, {
          type: "network_quality_stats_failed",
          reason: "network_quality_stats_failed",
          message: safeString(error?.message) || null,
        });
        if (!cancelled) setRevision((value) => value + 1);
      }
    };

    collect();
    const interval = window.setInterval(collect, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connectedRoom]);

  useEffect(() => {
    if (!connectedRoom?.on) return undefined;
    const metrics = providerMetricsRef.current;
    const bump = () => setRevision((value) => value + 1);
    const recordAndBump = (state, metadata = {}) => {
      recordMetricTransition(metrics, state, metadata);
      bump();
    };
    const disconnected = () => {
      metrics.roomEndedAt = metricNow();
      recordAndBump("disconnected");
      setConnectedRoom(null);
      connectedRoomRef.current = null;
    };
    const handlers = {
      connected: () => {
        metrics.roomStartedAt = metrics.roomStartedAt || metricNow();
        recordAndBump("connected");
      },
      disconnected,
      reconnecting: () => {
        metrics.reconnectStartedAt = metricNow();
        recordAndBump("reconnecting");
      },
      reconnected: () => {
        metrics.reconnectLatencyMs = elapsedMs(metrics.reconnectStartedAt);
        metrics.reconnectStartedAt = null;
        recordAndBump("reconnected", { reconnectLatencyMs: metrics.reconnectLatencyMs });
      },
      participantConnected: (participant) =>
        recordAndBump("participantConnected", { participantId: participantIdentity(participant) }),
      participantDisconnected: (participant) =>
        recordAndBump("participantDisconnected", { participantId: participantIdentity(participant) }),
      trackPublished: (_publication, participant) =>
        recordAndBump("trackPublished", { participantId: participantIdentity(participant) }),
      trackUnpublished: (_publication, participant) =>
        recordAndBump("trackUnpublished", { participantId: participantIdentity(participant) }),
      trackSubscribed: (_track, publication, participant) => {
        if (!metrics.firstSubscribeAt) {
          metrics.firstSubscribeAt = metricNow();
          metrics.subscribeLatencyMs = elapsedMs(metrics.roomStartedAt || metrics.joinStartedAt, metrics.firstSubscribeAt);
        }
        recordAndBump("trackSubscribed", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
          subscribeLatencyMs: metrics.subscribeLatencyMs,
        });
      },
      trackUnsubscribed: (_track, publication, participant) =>
        recordAndBump("trackUnsubscribed", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
        }),
      trackMuted: (publication, participant) =>
        recordAndBump("trackMuted", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
        }),
      trackUnmuted: (publication, participant) =>
        recordAndBump("trackUnmuted", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
        }),
      trackSubscriptionFailed: (trackSid, participant) => {
        recordMetricFailure(metrics, {
          type: "track_subscription_failed",
          reason: "track_subscription_failed",
          trackSid: safeString(trackSid) || null,
          participantId: participantIdentity(participant),
        });
        bump();
      },
      trackSubscriptionStatusChanged: (publication, status, participant) =>
        recordAndBump("trackSubscriptionStatusChanged", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
          status: safeString(status) || null,
        }),
      trackStreamStateChanged: (publication, streamState, participant) =>
        recordAndBump("trackStreamStateChanged", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
          streamState: safeString(streamState) || null,
        }),
      localTrackPublished: (publication) =>
        recordAndBump("localTrackPublished", { trackSid: safeString(publication?.trackSid) || null }),
      localTrackUnpublished: (publication) =>
        recordAndBump("localTrackUnpublished", { trackSid: safeString(publication?.trackSid) || null }),
      localTrackSubscribed: (publication) =>
        recordAndBump("localTrackSubscribed", { trackSid: safeString(publication?.trackSid) || null }),
      connectionStateChanged: (state) =>
        recordAndBump("connectionStateChanged", { connectionState: safeString(state) || null }),
      connectionQualityChanged: (quality, participant) =>
        {
          const event = {
            participantId: participantIdentity(participant),
            quality: normalizeNetworkQuality(quality),
            rawQuality: safeString(quality) || null,
          };
          recordMetricEvent(metrics, "networkQualityEvents", event);
          recordAndBump("connectionQualityChanged", event);
        },
      participantMetadataChanged: (_previous, participant) =>
        recordAndBump("participantMetadataChanged", { participantId: participantIdentity(participant) }),
      participantNameChanged: (_name, participant) =>
        recordAndBump("participantNameChanged", { participantId: participantIdentity(participant) }),
      participantAttributesChanged: (_attributes, participant) =>
        recordAndBump("participantAttributesChanged", { participantId: participantIdentity(participant) }),
      activeSpeakersChanged: (speakers = []) => {
        const ranking = (Array.isArray(speakers) ? speakers : connectedRoom.activeSpeakers || [])
          .map((speaker, index) => ({
            participantId: participantIdentity(speaker),
            rank: index + 1,
            audioLevel: Number.isFinite(Number(speaker.audioLevel)) ? Number(speaker.audioLevel) : null,
          }));
        recordMetricEvent(metrics, "activeSpeakerEvents", {
          activeSpeakerId: ranking[0]?.participantId || null,
          speakerRanking: ranking,
        });
        recordAndBump("activeSpeakersChanged", {
          activeSpeakerId: ranking[0]?.participantId || null,
          speakerCount: ranking.length,
        });
      },
      mediaDevicesError: (error, kind) => {
        recordMetricFailure(metrics, {
          type: "media_devices_error",
          reason: "media_devices_error",
          kind: safeString(kind) || null,
          message: safeString(error?.message) || null,
        });
        bump();
      },
    };
    Object.entries(handlers).forEach(([eventName, handler]) => {
      connectedRoom.on(eventName, handler);
    });
    return () => {
      Object.entries(handlers).forEach(([eventName, handler]) => {
        connectedRoom.off?.(eventName, handler);
      });
    };
  }, [connectedRoom]);

  const startCall = useCallback(async (params = {}) => {
    if (connecting || connectedRoomRef.current) {
      return connectionResult || { ok: true, reason: "livekit_already_connected" };
    }
    const channelId = safeString(params.channelId) || channelIdRef.current;
    const huddleId = safeString(params.huddleId) || huddleIdRef.current;
    const sessionId = safeString(params.sessionId) || huddleId;
    if (!channelId || !sessionId) {
      const result = {
        ok: false,
        reason: "livekit_channel_and_session_required",
        diagnostics: {
          fallbackProvider: "mesh",
          hasChannelId: Boolean(channelId),
          hasSessionId: Boolean(sessionId),
        },
      };
      setConnectionResult(result);
      return result;
    }

    setConnecting(true);
    try {
      providerMetricsRef.current = {
        ...createInitialLiveKitMetrics(),
        joinStartedAt: metricNow(),
      };
      let result = await connectLiveKitRoom({
        canary,
        workspaceId: resolvedWorkspaceId,
        channelId,
        huddleId,
        sessionId,
        deviceId: safeString(params.deviceId) || null,
      });

      if (result.ok && result.connection?.room) {
        providerMetricsRef.current.joinLatencyMs =
          result.diagnostics?.timings?.totalJoinLatencyMs ||
          elapsedMs(providerMetricsRef.current.joinStartedAt);
        providerMetricsRef.current.roomStartedAt = metricNow();
        recordMetricTransition(providerMetricsRef.current, "connected", {
          joinLatencyMs: providerMetricsRef.current.joinLatencyMs,
        });
        const publishResult = await publishInitialLiveKitMedia(result.connection.room);
        providerMetricsRef.current.publishLatencyMs =
          publishResult.diagnostics?.totalPublishLatencyMs || null;
        setPublicationDiagnostics(publishResult.diagnostics);

        if (!publishResult.ok) {
          recordMetricFailure(providerMetricsRef.current, {
            type: "track_publication_failed",
            reason: publishResult.reason,
            publication: publishResult.diagnostics,
          });
          try {
            result.connection.room.disconnect?.();
          } catch {
            // Disconnect is best-effort when the canary publish path fails.
          }

          result = {
            ...result,
            ok: false,
            reason: publishResult.reason,
            connection: null,
            diagnostics: {
              ...result.diagnostics,
              publication: publishResult.diagnostics,
              mediaFailure: {
                reason: publishResult.reason,
                fallbackProvider: "mesh",
              },
              fallbackProvider: "mesh",
            },
          };
          connectedRoomRef.current = null;
          setConnectedRoom(null);
          setRevision((value) => value + 1);
          setConnectionResult(result);
          return result;
        }

        result = {
          ...result,
          diagnostics: {
            ...result.diagnostics,
            publication: publishResult.diagnostics,
          },
        };
        connectedRoomRef.current = result.connection.room;
        setConnectedRoom(result.connection.room);
        setRevision((value) => value + 1);
      }

      setConnectionResult(result);
      return result;
    } finally {
      setConnecting(false);
    }
  }, [canary, connecting, connectionResult, resolvedWorkspaceId]);
  const leaveCall = useCallback(() => {
    const room = connectedRoomRef.current;
    try {
      room?.disconnect?.();
    } catch {
      // Disconnect is best-effort during provider cleanup.
    }
    providerMetricsRef.current.roomEndedAt = metricNow();
    recordMetricTransition(providerMetricsRef.current, "leaveCall");
    connectedRoomRef.current = null;
    setConnectedRoom(null);
    setPublicationDiagnostics(null);
    setScreenShareDiagnostics(null);
    setNetworkStatsByParticipant({});
    const result = disconnectLiveKitRoom();
    setConnectionResult(result);
    return result;
  }, []);
  const toggleMic = useCallback(async () => {
    const room = connectedRoomRef.current;
    if (!room?.localParticipant?.setMicrophoneEnabled) {
      return { ok: false, reason: "livekit_not_connected" };
    }

    const nextEnabled = !(room.localParticipant.isMicrophoneEnabled ?? true);
    try {
      const publication = await room.localParticipant.setMicrophoneEnabled(nextEnabled);
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        microphoneToggle: {
          ok: true,
          enabled: nextEnabled,
          trackSid: safeString(publication?.trackSid) || null,
          observedAt: new Date().toISOString(),
        },
      }));
      setRevision((value) => value + 1);
      return { ok: true, enabled: nextEnabled };
    } catch (error) {
      const failure = sanitizeLiveKitMediaFailure(
        error,
        LIVEKIT_MEDIA_PUBLICATION_REASONS.MICROPHONE_TOGGLE_FAILED
      );
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        microphoneToggle: {
          ok: false,
          failure,
          observedAt: new Date().toISOString(),
        },
      }));
      return { ok: false, reason: failure.reason, diagnostics: failure };
    }
  }, []);
  const toggleCamera = useCallback(async () => {
    const room = connectedRoomRef.current;
    if (!room?.localParticipant?.setCameraEnabled) {
      return { ok: false, reason: "livekit_not_connected" };
    }

    const nextEnabled = !(room.localParticipant.isCameraEnabled ?? true);
    try {
      const publication = await room.localParticipant.setCameraEnabled(nextEnabled);
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        cameraToggle: {
          ok: true,
          enabled: nextEnabled,
          trackSid: safeString(publication?.trackSid) || null,
          observedAt: new Date().toISOString(),
        },
      }));
      setRevision((value) => value + 1);
      return { ok: true, enabled: nextEnabled };
    } catch (error) {
      const failure = sanitizeLiveKitMediaFailure(
        error,
        LIVEKIT_MEDIA_PUBLICATION_REASONS.CAMERA_TOGGLE_FAILED
      );
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        cameraToggle: {
          ok: false,
          failure,
          observedAt: new Date().toISOString(),
        },
      }));
      return { ok: false, reason: failure.reason, diagnostics: failure };
    }
  }, []);
  const startScreenShare = useCallback(async () => {
    const room = connectedRoomRef.current;
    if (!room) {
      return { ok: false, reason: "livekit_not_connected" };
    }
    if (room.localParticipant?.isScreenShareEnabled) {
      return {
        ok: true,
        reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_PUBLISHED,
        diagnostics: screenShareDiagnostics,
      };
    }

    const result = await startLiveKitScreenShare(room);
    setScreenShareDiagnostics(result.diagnostics);
    if (result.ok) {
      providerMetricsRef.current.screenShareLatencyMs = result.diagnostics?.latencyMs || null;
      recordMetricEvent(providerMetricsRef.current, "screenShareEvents", {
        action: "start",
        ok: true,
        latencyMs: result.diagnostics?.latencyMs || null,
        publicationCount: result.diagnostics?.publicationCount || 0,
      });
    } else {
      recordMetricFailure(providerMetricsRef.current, {
        type: "screen_share_publication_failed",
        reason: result.reason,
        publication: result.diagnostics,
        fallbackProvider: "mesh",
      });
      recordMetricEvent(providerMetricsRef.current, "screenShareEvents", {
        action: "start",
        ok: false,
        reason: result.reason,
      });
    }
    setRevision((value) => value + 1);
    return result;
  }, [screenShareDiagnostics]);

  const stopScreenShare = useCallback(async () => {
    const room = connectedRoomRef.current;
    if (!room) {
      return { ok: false, reason: "livekit_not_connected" };
    }
    if (!room.localParticipant?.isScreenShareEnabled) {
      return {
        ok: true,
        reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.SCREEN_SHARE_STOPPED,
        diagnostics: screenShareDiagnostics,
      };
    }

    const result = await stopLiveKitScreenShare(room);
    setScreenShareDiagnostics(result.diagnostics);
    if (result.ok) {
      recordMetricEvent(providerMetricsRef.current, "screenShareEvents", {
        action: "stop",
        ok: true,
        latencyMs: result.diagnostics?.latencyMs || null,
      });
    } else {
      recordMetricFailure(providerMetricsRef.current, {
        type: "screen_share_stop_failed",
        reason: result.reason,
        publication: result.diagnostics,
        fallbackProvider: "mesh",
      });
      recordMetricEvent(providerMetricsRef.current, "screenShareEvents", {
        action: "stop",
        ok: false,
        reason: result.reason,
      });
    }
    setRevision((value) => value + 1);
    return result;
  }, [screenShareDiagnostics]);
  const setChannelId = useCallback((id) => {
    channelIdRef.current = safeString(id) || null;
  }, []);
  const setHuddleId = useCallback((id) => {
    huddleIdRef.current = safeString(id) || null;
  }, []);

  return {
    inCall: Boolean(connectedRoom),
    connecting,
    localStream,
    remotePeers,
    micEnabled,
    camEnabled,
    screenSharing,
    subtitlesEnabled: false,
    subtitles: {},
    activeSpeakerId,
    networkQuality,
    mediaStateV2,
    diagnostics: {
      ...mediaStateV2.diagnostics,
      metadata: {
        ...mediaStateV2.diagnostics.metadata,
        connectionResult: connectionResult?.diagnostics || null,
        publication: publicationDiagnostics,
        screenShare: screenShareDiagnostics,
        activeSpeaker: activeSpeakerDiagnostics,
        networkQuality: networkQualityDiagnostics,
        providerMetrics,
        fallbackProvider: connectionResult?.diagnostics?.fallbackProvider || "mesh",
      },
    },
    startCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    toggleSubtitles: noop,
    startRecording: noop,
    stopRecording: noop,
    muteAll: noop,
    setChannelId,
    setHuddleId,
  };
}
