import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectLiveKitRoom,
  createLiveKitConnectionPlan,
  disconnectLiveKitRoom,
} from "./LiveKitConnection";
import {
  createLiveTranscriptionClient,
  liveTranscriptionSupported,
} from "./LiveTranscriptionClient";
import api from "../../api";
import { getCachedLiveKitSdkDiagnostics, loadLiveKitSdk } from "./LiveKitSdk";
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
import {
  applyBackgroundEffect,
  destroyBackgroundEffect,
  getBackgroundEffectSupport,
  HUDDLE_BACKGROUND_EFFECTS,
} from "./BackgroundEffects";
import { getLiveKitRenderTarget } from "./LiveKitRenderTarget";

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

const LIVEKIT_QUALITY_MODES = Object.freeze({
  AUTO: "auto",
  STANDARD: "standard",
  HD: "hd",
});

const LIVEKIT_QUALITY_CAPTURE_OPTIONS = Object.freeze({
  [LIVEKIT_QUALITY_MODES.STANDARD]: {
    resolution: { width: 960, height: 540, frameRate: 24 },
  },
  [LIVEKIT_QUALITY_MODES.HD]: {
    resolution: { width: 1280, height: 720, frameRate: 30 },
  },
});

function isMobileMediaDevice() {
  return (
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
  );
}

function isMobileBackgroundEffectDevice() {
  return isMobileMediaDevice();
}

function cameraCaptureOptions(mode = LIVEKIT_QUALITY_MODES.AUTO) {
  if (isMobileMediaDevice()) {
    const portrait =
      typeof window !== "undefined" &&
      window.matchMedia?.("(orientation: portrait)")?.matches !== false;
    const standard = mode === LIVEKIT_QUALITY_MODES.STANDARD;
    return {
      facingMode: "user",
      resolution: {
        width: portrait ? (standard ? 540 : 720) : (standard ? 960 : 1280),
        height: portrait ? (standard ? 960 : 1280) : (standard ? 540 : 720),
        frameRate: 24,
        aspectRatio: portrait ? 9 / 16 : 16 / 9,
      },
    };
  }
  return (
    LIVEKIT_QUALITY_CAPTURE_OPTIONS[mode] || {
      facingMode: "user",
      resolution: { width: 1280, height: 720, frameRate: 30 },
    }
  );
}

function liveKitCameraSimulcastLayers(sdk = null) {
  const presets = sdk?.VideoPresets || {};
  const mobile = isMobileMediaDevice();
  return (
    mobile
      ? [presets.h180, presets.h360, presets.h540]
      : [presets.h180, presets.h360, presets.h720]
  ).filter(Boolean);
}

function cameraPublishOptions(mode = LIVEKIT_QUALITY_MODES.AUTO, sdk = null) {
  const mobile = isMobileMediaDevice();
  const layers = liveKitCameraSimulcastLayers(sdk);

  return {
    simulcast: true,
    videoEncoding: {
      maxBitrate:
        mode === LIVEKIT_QUALITY_MODES.HD
          ? (mobile ? 1_500_000 : 2_500_000)
          : (mobile ? 1_300_000 : 2_000_000),
      maxFramerate: mobile ? 24 : 30,
    },
    ...(layers.length ? { videoSimulcastLayers: layers } : {}),
  };
}

function stopPrewarmedLiveKitTracks(tracks = []) {
  for (const track of Array.isArray(tracks) ? tracks : []) {
    try {
      track?.stop?.();
    } catch {
      // Best effort cleanup for pre-connect media warmup.
    }
  }
}

function localTrackKind(track = {}) {
  return safeString(track.kind || track.mediaStreamTrack?.kind).toLowerCase();
}

async function prewarmInitialLiveKitTracks({
  sdk = null,
  mode = LIVEKIT_QUALITY_MODES.AUTO,
} = {}) {
  const startedAt = metricNow();
  const sdkResult = sdk
    ? { ok: true, sdk }
    : await loadLiveKitSdk({ enabled: true });
  const resolvedSdk = sdkResult.ok ? sdkResult.sdk : null;
  if (!resolvedSdk?.createLocalTracks) {
    return {
      ok: false,
      reason: "livekit_create_local_tracks_unavailable",
      sdk: resolvedSdk,
      tracks: [],
      diagnostics: {
        ok: false,
        latencyMs: elapsedMs(startedAt),
        reason: "livekit_create_local_tracks_unavailable",
      },
    };
  }
  try {
    const tracks = await resolvedSdk.createLocalTracks({
      audio: true,
      video: cameraCaptureOptions(mode),
    });
    const audioTrackCount = tracks.filter((track) => localTrackKind(track) === "audio").length;
    const videoTrackCount = tracks.filter((track) => localTrackKind(track) === "video").length;
    return {
      ok: tracks.length > 0,
      reason: tracks.length > 0 ? "livekit_tracks_prewarmed" : "livekit_no_tracks_prewarmed",
      sdk: resolvedSdk,
      tracks,
      diagnostics: {
        ok: tracks.length > 0,
        latencyMs: elapsedMs(startedAt),
        trackCount: tracks.length,
        audioTrackCount,
        videoTrackCount,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: "livekit_track_prewarm_failed",
      sdk: resolvedSdk,
      tracks: [],
      diagnostics: {
        ok: false,
        latencyMs: elapsedMs(startedAt),
        failure: sanitizeLiveKitMediaFailure(
          error,
          LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLICATION_FAILED
        ),
      },
    };
  }
}

const LIVE_CAPTION_LANGUAGE = "multi";
const LIVE_CAPTION_POLL_INTERVAL_MS = 500;
const LIVE_CAPTION_HISTORY_LIMIT = 1500;
const LIVE_CAPTION_CURSOR_OVERLAP_MS = 2000;

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

function isProviderIdentity(value) {
  const identity = safeString(value).toLowerCase();
  return (
    identity.startsWith("livekit:") ||
    identity.includes(":workspace:") ||
    identity.includes(":huddle:")
  );
}

function safeHumanName(...values) {
  for (const value of values) {
    const displayName = safeString(value);
    if (displayName && !isProviderIdentity(displayName)) {
      return displayName.slice(0, 80);
    }
  }
  return "";
}

function providerIdentitySegment(identity, segment) {
  const parts = safeString(identity).split(":");
  const index = parts.findIndex((part) => part === segment);
  return index >= 0 ? safeString(parts[index + 1]) || null : null;
}

function userIdFromProviderIdentity(identity) {
  return providerIdentitySegment(identity, "user");
}

function deviceIdFromProviderIdentity(identity) {
  return providerIdentitySegment(identity, "device");
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

function canonicalCaptionFeed(events = []) {
  const latestBySegment = new Map();
  events.forEach((event) => {
    const key =
      safeString(event?.metadata?.sourceSegmentId) ||
      safeString(event?.sourceSegmentId) ||
      safeString(event?.transcriptSegmentId) ||
      safeString(event?.id);
    if (!key) return;
    if (safeString(event?.status).toLowerCase() === "retracted") {
      latestBySegment.delete(key);
      return;
    }
    latestBySegment.set(key, event);
  });
  return Array.from(latestBySegment.values())
    .sort((left, right) => {
      const leftAt = new Date(left?.emittedAt || left?.createdAt || 0).getTime();
      const rightAt = new Date(right?.emittedAt || right?.createdAt || 0).getTime();
      if (leftAt !== rightAt) return leftAt - rightAt;
      return Number(left?.sequenceNumber || 0) - Number(right?.sequenceNumber || 0);
    })
    .slice(-LIVE_CAPTION_HISTORY_LIMIT);
}

function publicationTrackKind(publication = {}) {
  return safeString(
    publication.kind ||
    publication.track?.kind ||
    publication.track?.mediaStreamTrack?.kind ||
    publication.mediaStreamTrack?.kind
  ).toLowerCase();
}

function displayPublicationPriority(publication = {}) {
  const source = trackSource(publication);
  const kind = publicationTrackKind(publication);
  if (kind === "audio") return 30;
  if (source === HUDDLE_MEDIA_TRACK_SOURCES.screen) return 0;
  if (source === HUDDLE_MEDIA_TRACK_SOURCES.camera) return 10;
  return 20;
}

function displayTrackPublications(participant = {}) {
  return uniqueTrackPublications(participant).sort((a, b) => {
    const priorityDiff = displayPublicationPriority(a) - displayPublicationPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return publicationKey(a).localeCompare(publicationKey(b));
  });
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

function mediaStreamFromPublications(publications = [], cacheKey = null, streamCache = null) {
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

  if (!mediaTracks.length) {
    if (cacheKey && streamCache?.delete) streamCache.delete(cacheKey);
    return null;
  }

  const trackKey = mediaTracks
    .map((track, index) => `${safeString(track.kind) || "track"}:${safeString(track.id) || index}`)
    .sort()
    .join("|");
  const cached = cacheKey && streamCache?.get ? streamCache.get(cacheKey) : null;
  if (cached?.trackKey === trackKey && cached?.stream) return cached.stream;

  const stream = new MediaStream(mediaTracks);
  if (cacheKey && streamCache?.set) {
    streamCache.set(cacheKey, { trackKey, stream });
  }
  return stream;
}

function liveKitTrackFromPublication(publication = {}) {
  const track = publication?.track;
  return track && typeof track.attach === "function" ? track : null;
}

function displayVideoPublication(participant = {}) {
  return displayTrackPublications(participant).find((publication) => {
    const kind = publicationTrackKind(publication);
    const track = liveKitTrackFromPublication(publication);
    return kind === "video" && track && publication.isMuted !== true;
  }) || null;
}

function displayAudioPublication(participant = {}) {
  return displayTrackPublications(participant).find((publication) => {
    const kind = publicationTrackKind(publication);
    const track = liveKitTrackFromPublication(publication);
    return kind === "audio" && track && publication.isMuted !== true;
  }) || null;
}

function liveKitLocalStream(room, streamCache = null) {
  return mediaStreamFromPublications(
    displayTrackPublications(room?.localParticipant),
    "local",
    streamCache
  );
}

function liveKitLocalAudioTrack(room) {
  return displayTrackPublications(room?.localParticipant)
    .map((publication) => mediaStreamTrackFromPublication(publication))
    .find((track) => track?.kind === "audio" && track.readyState !== "ended") || null;
}

function liveKitLocalCameraTrack(room) {
  const publication = displayTrackPublications(room?.localParticipant).find(
    (item) =>
      trackSource(item) === HUDDLE_MEDIA_TRACK_SOURCES.camera &&
      publicationTrackKind(item) === "video"
  );
  return liveKitTrackFromPublication(publication);
}

function liveKitRemoteStream(participant = {}, streamCache = null) {
  const subscribedPublications = displayTrackPublications(participant).filter((publication) => (
    publication.isSubscribed === true ||
    Boolean(publication.track) ||
    Boolean(mediaStreamTrackFromPublication(publication))
  ));
  return mediaStreamFromPublications(
    subscribedPublications,
    `remote:${participantIdentity(participant)}:${safeString(participant.sid) || "unknown"}`,
    streamCache
  );
}

function liveKitParticipantUsername(participant = {}) {
  const metadata = safeMetadata(participant.metadata);
  return (
    safeHumanName(
      participant.name,
      metadata.displayName,
      metadata.username,
      metadata.name,
      metadata.userName
    ) ||
    "Teammate"
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

export function createLiveKitRemotePeers(remoteParticipants = [], streamCache = null) {
  return (remoteParticipants || []).map((participant) => {
    const videoPublication = displayVideoPublication(participant);
    const audioPublication = displayAudioPublication(participant);
    return createRemotePeerState({
      userId: participantIdentity(participant),
      username: liveKitParticipantUsername(participant),
      stream: liveKitRemoteStream(participant, streamCache),
      videoTrack: liveKitTrackFromPublication(videoPublication),
      audioTrack: liveKitTrackFromPublication(audioPublication),
      videoPublication,
      audioPublication,
      selectedVideoSource: videoPublication ? trackSource(videoPublication) : null,
      isMuted: liveKitParticipantMuted(participant),
      isCameraOff: liveKitParticipantCameraOff(participant),
      isScreenSharing: liveKitParticipantScreenSharing(participant),
    });
  });
}

function normalizedVideoQuality(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return ({ 0: "low", 1: "medium", 2: "high", 3: "off" })[numeric] || `unknown_${numeric}`;
  }
  return safeString(value).toLowerCase() || null;
}

function attachedElementMetrics(track = null, publication = null) {
  const elements = Array.isArray(track?.attachedElements)
    ? track.attachedElements.filter(Boolean)
    : [];
  const visible = elements
    .map((element) => {
      const rect = element?.getBoundingClientRect?.();
      return {
        width: Math.round(rect?.width || element?.clientWidth || 0),
        height: Math.round(rect?.height || element?.clientHeight || 0),
      };
    })
    .filter((item) => item.width > 0 && item.height > 0);
  const largest = visible.reduce(
    (current, item) => (
      item.width * item.height > current.width * current.height ? item : current
    ),
    { width: 0, height: 0 }
  );
  const requested = getLiveKitRenderTarget(publication);
  return {
    attachedElementCount: elements.length,
    renderedWidth: largest.width || null,
    renderedHeight: largest.height || null,
    adaptiveStreamAttached: elements.length > 0,
    requestedWidth: requested?.width || null,
    requestedHeight: requested?.height || null,
    requestedContentWidth: requested?.contentCssWidth || null,
    requestedContentHeight: requested?.contentCssHeight || null,
    requestedSourceWidth: requested?.sourceWidth || null,
    requestedSourceHeight: requested?.sourceHeight || null,
    requestedFramesPerSecond: requested?.framesPerSecond || null,
    requestedPixelRatio: requested?.pixelRatio || null,
    renderTargetVisible:
      requested?.visible === undefined ? null : Boolean(requested.visible),
  };
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
    next[participantId] = {
      observedAt: new Date().toISOString(),
      rttMs: stats.rttSamples.length
        ? Math.round(stats.rttSamples.reduce((total, value) => total + value, 0) / stats.rttSamples.length)
        : null,
      packetLoss: packetsTotal > 0
        ? Number((stats.packetsLost / packetsTotal).toFixed(4))
        : null,
      bitrateKbps: null,
      bytesSent: stats.bytesSent,
      bytesReceived: stats.bytesReceived,
      collectedAt,
    };
  }

  return next;
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function qualityParticipantName(participant = {}) {
  return safeHumanName(
    participant.name,
    participant.metadata?.displayName,
    participant.metadata?.username,
    safeMetadata(participant.metadata).displayName,
    safeMetadata(participant.metadata).username
  ) || null;
}

function rtcReportEntries(report) {
  const entries = [];
  if (!report?.forEach) return entries;
  report.forEach((entry) => entries.push(entry));
  return entries;
}

function codecFromReportEntry(entry = {}, codecs = new Map()) {
  const codec = codecs.get(entry.codecId);
  return {
    codec: safeString(codec?.mimeType || entry.mimeType || entry.codec) || null,
    mimeType: safeString(codec?.mimeType || entry.mimeType) || null,
  };
}

function rtpEncodingDiagnostics(track = null) {
  const encodings = track?.sender?.getParameters?.().encodings;
  if (!Array.isArray(encodings)) {
    return {
      senderEncodingCount: null,
      senderActiveEncodingCount: null,
      senderEncodings: [],
    };
  }

  const normalized = encodings.slice(0, 5).map((encoding, index) => ({
    index,
    rid: safeString(encoding.rid) || null,
    active: encoding.active !== false,
    scaleResolutionDownBy: safeNumber(encoding.scaleResolutionDownBy),
    maxBitrateKbps: Number.isFinite(Number(encoding.maxBitrate))
      ? Math.round(Number(encoding.maxBitrate) / 1000)
      : null,
    maxFramerate: safeNumber(encoding.maxFramerate),
    scalabilityMode: safeString(encoding.scalabilityMode) || null,
  }));

  return {
    senderEncodingCount: encodings.length,
    senderActiveEncodingCount: normalized.filter((encoding) => encoding.active).length,
    senderEncodings: normalized,
  };
}

function bitrateFromDelta(sampleKey, bytes, timestamp, previousSamples) {
  if (!previousSamples || !sampleKey || !Number.isFinite(bytes)) return null;
  const now = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();
  const previous = previousSamples.get(sampleKey);
  previousSamples.set(sampleKey, { bytes, timestamp: now });
  if (!previous || !Number.isFinite(previous.bytes) || !Number.isFinite(previous.timestamp)) {
    return null;
  }
  const elapsedMsForSample = Math.max(1, now - previous.timestamp);
  const deltaBytes = Math.max(0, bytes - previous.bytes);
  return Math.round((deltaBytes * 8) / elapsedMsForSample);
}

function applyQualityStatsEntry(track, entry = {}, codecs = new Map()) {
  if (entry.type === "codec") return;

  if (entry.type === "candidate-pair" && (entry.selected || entry.nominated)) {
    if (Number.isFinite(Number(entry.currentRoundTripTime))) {
      track.rttMs = Math.round(Number(entry.currentRoundTripTime) * 1000);
    }
    if (Number.isFinite(Number(entry.availableOutgoingBitrate))) {
      track.availableOutgoingBitrateKbps = Math.round(Number(entry.availableOutgoingBitrate) / 1000);
    }
    if (Number.isFinite(Number(entry.availableIncomingBitrate))) {
      track.availableIncomingBitrateKbps = Math.round(Number(entry.availableIncomingBitrate) / 1000);
    }
  }

  if (entry.type === "remote-inbound-rtp" && Number.isFinite(Number(entry.roundTripTime))) {
    track.rttMs = Math.round(Number(entry.roundTripTime) * 1000);
  }

  if (entry.type === "inbound-rtp") {
    if (Number.isFinite(Number(entry.framesDecoded))) {
      track.framesDecoded = Math.max(Number(track.framesDecoded) || 0, Number(entry.framesDecoded));
    }
    if (Number.isFinite(Number(entry.framesRendered))) {
      track.framesRendered = Math.max(Number(track.framesRendered) || 0, Number(entry.framesRendered));
    }
    if (Number.isFinite(Number(entry.freezeCount))) {
      track.freezeCount = Math.max(Number(track.freezeCount) || 0, Number(entry.freezeCount));
    }
    if (Number.isFinite(Number(entry.totalFreezesDuration))) {
      track.totalFreezesDuration = Math.max(
        Number(track.totalFreezesDuration) || 0,
        Number(entry.totalFreezesDuration)
      );
    }
    if (Number.isFinite(Number(entry.pauseCount))) {
      track.pauseCount = Math.max(Number(track.pauseCount) || 0, Number(entry.pauseCount));
    }
    if (Number.isFinite(Number(entry.totalPausesDuration))) {
      track.totalPausesDuration = Math.max(
        Number(track.totalPausesDuration) || 0,
        Number(entry.totalPausesDuration)
      );
    }
  }

  if (entry.type !== "outbound-rtp" && entry.type !== "inbound-rtp" && entry.type !== "media-source") {
    return;
  }

  const kind = safeString(entry.kind || entry.mediaType).toLowerCase();
  if (kind && track.kind && kind !== track.kind) return;

  if (Number.isFinite(Number(entry.frameWidth))) {
    track.width = Math.max(Number(track.width) || 0, Number(entry.frameWidth));
  }
  if (Number.isFinite(Number(entry.frameHeight))) {
    track.height = Math.max(Number(track.height) || 0, Number(entry.frameHeight));
  }
  if (Number.isFinite(Number(entry.framesPerSecond))) {
    track.framesPerSecond = Math.max(
      Number(track.framesPerSecond) || 0,
      Number(entry.framesPerSecond)
    );
  }
  const rtpEntry =
    entry.type === "outbound-rtp" || entry.type === "inbound-rtp";
  if (rtpEntry && Number.isFinite(Number(entry.framesDropped))) {
    track.framesDropped = Math.max(Number(track.framesDropped) || 0, Number(entry.framesDropped));
  }
  if (rtpEntry && Number.isFinite(Number(entry.bytesSent))) {
    track.bytesSent = (Number(track.bytesSent) || 0) + Number(entry.bytesSent);
  }
  if (rtpEntry && Number.isFinite(Number(entry.bytesReceived))) {
    track.bytesReceived =
      (Number(track.bytesReceived) || 0) + Number(entry.bytesReceived);
  }
  if (rtpEntry && Number.isFinite(Number(entry.packetsLost))) {
    track.packetsLost =
      (Number(track.packetsLost) || 0) + Number(entry.packetsLost);
  }
  if (rtpEntry && Number.isFinite(Number(entry.packetsSent))) {
    track.packetsSent =
      (Number(track.packetsSent) || 0) + Number(entry.packetsSent);
  }
  if (rtpEntry && Number.isFinite(Number(entry.packetsReceived))) {
    track.packetsReceived =
      (Number(track.packetsReceived) || 0) + Number(entry.packetsReceived);
  }
  if (entry.qualityLimitationReason) {
    track.qualityLimitationReason = safeString(entry.qualityLimitationReason) || null;
  }
  if (entry.rid) track.rid = safeString(entry.rid) || null;
  if (entry.scalabilityMode) track.scalabilityMode = safeString(entry.scalabilityMode) || null;
  const codec = codecFromReportEntry(entry, codecs);
  track.codec = track.codec || codec.codec;
  track.mimeType = track.mimeType || codec.mimeType;
}

async function collectLiveKitQualitySnapshot(room, networkStatsByParticipant = {}, previousSamples = new Map()) {
  const participants = [
    room?.localParticipant,
    ...remoteParticipantsFromRoom(room),
  ].filter(Boolean);
  const observedAt = new Date().toISOString();
  const tracks = [];
  const participantSummaries = [];

  for (const participant of participants) {
    const participantId = participantIdentity(participant);
    const isLocal = participant === room?.localParticipant;
    const publications = uniqueTrackPublications(participant);
    const participantStats = networkStatsByParticipant[participantId] || {};
    const summary = {
      participantId,
      isLocal,
      displayName: qualityParticipantName(participant),
      connectionQuality: normalizeNetworkQuality(participant.connectionQuality),
      trackCount: publications.length,
      videoTrackCount: 0,
      audioTrackCount: 0,
      screenShareTrackCount: 0,
      rttMs: participantStats.rttMs ?? null,
      packetLoss: participantStats.packetLoss ?? null,
      bitrateKbps: participantStats.bitrateKbps ?? null,
    };

    for (const publication of publications) {
      const mediaTrack = mediaStreamTrackFromPublication(publication);
      const settings = mediaTrack?.getSettings?.() || {};
      const kind = publicationTrackKind(publication) || safeString(settings.kind).toLowerCase();
      const source = trackSource(publication);
      const sampleKey = `${participantId}:${publicationKey(publication)}:${isLocal ? "send" : "receive"}`;
      const track = {
        trackId: publicationKey(publication),
        participantId,
        isLocal,
        kind,
        source,
        direction: isLocal ? "send" : "receive",
        publicationState: publicationState(publication),
        subscriptionState: subscriptionState(publication, { isLocal }),
        isMuted: publication.isMuted === true,
        isSubscribed: isLocal ? true : publication.isSubscribed === true,
        width: safeNumber(settings.width),
        height: safeNumber(settings.height),
        framesPerSecond: safeNumber(settings.frameRate),
        mediaSourceWidth: safeNumber(settings.width),
        mediaSourceHeight: safeNumber(settings.height),
        mediaSourceFrameRate: safeNumber(settings.frameRate),
        mediaSourceFacingMode: safeString(settings.facingMode) || null,
        mediaSourceResizeMode: safeString(settings.resizeMode) || null,
        mediaSourceDisplaySurface: safeString(settings.displaySurface) || null,
        mediaTrackContentHint: safeString(mediaTrack?.contentHint) || null,
        bitrateKbps: null,
        availableOutgoingBitrateKbps: null,
        availableIncomingBitrateKbps: null,
        rttMs: null,
        packetLoss: null,
        packetsLost: null,
        packetsSent: null,
        packetsReceived: null,
        bytesSent: null,
        bytesReceived: null,
        framesDropped: null,
        framesDecoded: null,
        framesRendered: null,
        freezeCount: null,
        totalFreezesDuration: null,
        pauseCount: null,
        totalPausesDuration: null,
        codec: null,
        mimeType: null,
        rid: null,
        scalabilityMode: null,
        simulcastLayer: normalizedVideoQuality(
          publication.videoQuality ?? publication.currentVideoQuality
        ),
        streamState: safeString(publication.streamState || publication.track?.streamState) || null,
        videoQuality: normalizedVideoQuality(
          publication.videoQuality ?? publication.currentVideoQuality
        ),
        ...(isLocal ? rtpEncodingDiagnostics(publication.track) : {}),
        qualityLimitationReason: null,
        publicationWidth: safeNumber(publication.dimensions?.width),
        publicationHeight: safeNumber(publication.dimensions?.height),
        ...attachedElementMetrics(publication.track, publication),
        currentBitrateKbps: Number.isFinite(Number(publication.track?.currentBitrate))
          ? Math.round(Number(publication.track.currentBitrate) / 1000)
          : null,
      };

      if (kind === "video") summary.videoTrackCount += 1;
      if (kind === "audio") summary.audioTrackCount += 1;
      if (source === HUDDLE_MEDIA_TRACK_SOURCES.screen) summary.screenShareTrackCount += 1;

      const report = await publication.track?.getRTCStatsReport?.().catch(() => null);
      const entries = rtcReportEntries(report);
      const codecs = new Map(entries.filter((entry) => entry.type === "codec").map((entry) => [entry.id, entry]));
      entries.forEach((entry) => applyQualityStatsEntry(track, entry, codecs));

      const bytes = safeNumber((track.bytesSent || 0) + (track.bytesReceived || 0));
      const timestamp = entries.find((entry) => Number.isFinite(Number(entry.timestamp)))?.timestamp;
      track.bitrateKbps = bitrateFromDelta(sampleKey, bytes, timestamp, previousSamples);
      const packetTotal = (track.packetsSent || track.packetsReceived || 0) + (track.packetsLost || 0);
      track.packetLoss = packetTotal > 0
        ? Number(((track.packetsLost || 0) / packetTotal).toFixed(4))
        : null;
      tracks.push(track);
    }

    participantSummaries.push(summary);
  }

  const rttValues = tracks.map((track) => track.rttMs).filter((value) => Number.isFinite(value));
  const packetLossValues = tracks.map((track) => track.packetLoss).filter((value) => Number.isFinite(value));
  const bitrateValues = tracks.map((track) => track.bitrateKbps).filter((value) => Number.isFinite(value));
  const sendBitrateValues = tracks
    .filter((track) => track.direction === "send")
    .map((track) => track.bitrateKbps)
    .filter((value) => Number.isFinite(value));
  const receiveBitrateValues = tracks
    .filter((track) => track.direction === "receive")
    .map((track) => track.bitrateKbps)
    .filter((value) => Number.isFinite(value));
  const sendVideoTracks = tracks.filter((track) => track.direction === "send" && track.kind === "video");
  const receiveVideoTracks = tracks.filter((track) => track.direction === "receive" && track.kind === "video");
  const sendScreenTracks = tracks.filter((track) => track.direction === "send" && track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen);
  const receiveScreenTracks = tracks.filter((track) => track.direction === "receive" && track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen);
  const targetedReceiveVideoTracks = receiveVideoTracks.filter(
    (track) =>
      Number(track.requestedWidth) > 0 &&
      Number(track.requestedHeight) > 0
  );
  const renderTargetMismatchCount = targetedReceiveVideoTracks.filter((track) => {
    const requestedWidth = Number(track.requestedWidth) || 0;
    const requestedHeight = Number(track.requestedHeight) || 0;
    const actualWidth = Number(track.width) || 0;
    const actualHeight = Number(track.height) || 0;
    const requestedPixels = requestedWidth * requestedHeight;
    const actualPixels = actualWidth * actualHeight;
    if (!requestedPixels || !actualPixels) return false;
    const requestedLongEdge = Math.max(requestedWidth, requestedHeight);
    const requestedShortEdge = Math.min(requestedWidth, requestedHeight);
    const actualLongEdge = Math.max(actualWidth, actualHeight);
    const actualShortEdge = Math.min(actualWidth, actualHeight);
    return (
      actualPixels < requestedPixels * 0.72 ||
      actualLongEdge < requestedLongEdge * 0.78 ||
      actualShortEdge < requestedShortEdge * 0.72
    );
  }).length;
  const maxBy = (items, key) => items.reduce((max, item) => Math.max(max, safeNumber(item[key], 0) || 0), 0) || null;
  const sumBy = (items, key) => items.reduce(
    (total, item) => total + (safeNumber(item[key], 0) || 0),
    0
  );
  const freezeTracks = receiveVideoTracks.filter((track) => Number(track.freezeCount) > 0);

  return {
    observedAt,
    provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
    adaptiveStream: true,
    dynacast: true,
    browser: typeof window === "undefined" ? {} : {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen?.width,
      screenHeight: window.screen?.height,
      devicePixelRatio: window.devicePixelRatio,
    },
    aggregate: {
      participantCount: participantSummaries.length,
      trackCount: tracks.length,
      videoTrackCount: tracks.filter((track) => track.kind === "video").length,
      audioTrackCount: tracks.filter((track) => track.kind === "audio").length,
      screenShareTrackCount: tracks.filter((track) => track.source === HUDDLE_MEDIA_TRACK_SOURCES.screen).length,
      averageRttMs: rttValues.length
        ? Math.round(rttValues.reduce((total, value) => total + value, 0) / rttValues.length)
        : null,
      averagePacketLoss: packetLossValues.length
        ? Number((packetLossValues.reduce((total, value) => total + value, 0) / packetLossValues.length).toFixed(4))
        : null,
      totalBitrateKbps: bitrateValues.length
        ? Math.round(bitrateValues.reduce((total, value) => total + value, 0))
        : null,
      sendBitrateKbps: sendBitrateValues.length
        ? Math.round(sendBitrateValues.reduce((total, value) => total + value, 0))
        : null,
      receiveBitrateKbps: receiveBitrateValues.length
        ? Math.round(receiveBitrateValues.reduce((total, value) => total + value, 0))
        : null,
      estimatedMegabytesPerHour: bitrateValues.length
        ? Number(
            (
              (bitrateValues.reduce((total, value) => total + value, 0) *
                3600) /
              8 /
              1024
            ).toFixed(1)
          )
        : null,
      maxSendWidth: maxBy(sendVideoTracks, "width"),
      maxSendHeight: maxBy(sendVideoTracks, "height"),
      maxReceiveWidth: maxBy(receiveVideoTracks, "width"),
      maxReceiveHeight: maxBy(receiveVideoTracks, "height"),
      maxScreenShareSendWidth: maxBy(sendScreenTracks, "width"),
      maxScreenShareSendHeight: maxBy(sendScreenTracks, "height"),
      maxScreenShareReceiveWidth: maxBy(receiveScreenTracks, "width"),
      maxScreenShareReceiveHeight: maxBy(receiveScreenTracks, "height"),
      maxRequestedReceiveWidth: maxBy(receiveVideoTracks, "requestedWidth"),
      maxRequestedReceiveHeight: maxBy(receiveVideoTracks, "requestedHeight"),
      maxRequestedContentReceiveWidth: maxBy(receiveVideoTracks, "requestedContentWidth"),
      maxRequestedContentReceiveHeight: maxBy(receiveVideoTracks, "requestedContentHeight"),
      renderTargetTrackCount: targetedReceiveVideoTracks.length,
      renderTargetMismatchCount,
      screenShareSendBitrateKbps: sumBy(sendScreenTracks, "bitrateKbps") || null,
      screenShareReceiveBitrateKbps: sumBy(receiveScreenTracks, "bitrateKbps") || null,
      adaptiveStreamAttachedTrackCount: tracks.filter((track) => track.adaptiveStreamAttached).length,
      selectedLowLayerCount: tracks.filter((track) => track.videoQuality === "low").length,
      selectedMediumLayerCount: tracks.filter((track) => track.videoQuality === "medium").length,
      selectedHighLayerCount: tracks.filter((track) => track.videoQuality === "high").length,
      freezeTrackCount: freezeTracks.length,
      totalFreezeCount: sumBy(receiveVideoTracks, "freezeCount") || null,
      totalFreezeDurationSeconds: sumBy(receiveVideoTracks, "totalFreezesDuration") || null,
      totalFramesDropped: sumBy(receiveVideoTracks, "framesDropped") || null,
      totalFramesDecoded: sumBy(receiveVideoTracks, "framesDecoded") || null,
      totalFramesRendered: sumBy(receiveVideoTracks, "framesRendered") || null,
    },
    participants: participantSummaries,
    tracks,
  };
}

function createInitialLiveKitMetrics() {
  return {
    intentStartedAt: null,
    joinStartedAt: null,
    joinLatencyMs: null,
    intentToJoinLatencyMs: null,
    publishLatencyMs: null,
    subscribeLatencyMs: null,
    firstAudioSubscribeLatencyMs: null,
    firstVideoSubscribeLatencyMs: null,
    captionsActiveLatencyMs: null,
    connectionTimings: null,
    screenShareLatencyMs: null,
    firstSubscribeAt: null,
    firstAudioSubscribeAt: null,
    firstVideoSubscribeAt: null,
    firstCaptionAt: null,
    captionTransportReadyAt: null,
    captionTransportReadyLatencyMs: null,
    captionTransportReadyFromIntentMs: null,
    captionStartupTimings: null,
    captionGrantCacheHit: false,
    captionGrantSharedInFlight: false,
    mediaPrewarmLatencyMs: null,
    mediaPrewarmOk: false,
    mediaPrewarmTrackCount: 0,
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

function markExistingSubscribedTracks(metrics, room) {
  if (!metrics || !room) return;
  const now = metricNow();
  for (const participant of remoteParticipantsFromRoom(room)) {
    for (const publication of uniqueTrackPublications(participant)) {
      const hasTrack =
        publication?.isSubscribed === true ||
        Boolean(publication?.track) ||
        Boolean(mediaStreamTrackFromPublication(publication));
      if (!hasTrack) continue;
      const trackKind = publicationTrackKind(publication);
      if (!metrics.firstSubscribeAt) {
        metrics.firstSubscribeAt = now;
        metrics.subscribeLatencyMs = elapsedMs(
          metrics.roomStartedAt || metrics.joinStartedAt,
          metrics.firstSubscribeAt
        );
      }
      if (trackKind === "audio" && !metrics.firstAudioSubscribeAt) {
        metrics.firstAudioSubscribeAt = now;
        metrics.firstAudioSubscribeLatencyMs = elapsedMs(
          metrics.intentStartedAt || metrics.joinStartedAt,
          metrics.firstAudioSubscribeAt
        );
      }
      if (trackKind === "video" && !metrics.firstVideoSubscribeAt) {
        metrics.firstVideoSubscribeAt = now;
        metrics.firstVideoSubscribeLatencyMs = elapsedMs(
          metrics.intentStartedAt || metrics.joinStartedAt,
          metrics.firstVideoSubscribeAt
        );
      }
      recordMetricTransition(metrics, "trackSubscribedExisting", {
        participantId: participantIdentity(participant),
        trackSid: safeString(publication?.trackSid) || null,
        trackKind: trackKind || null,
      });
    }
  }
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
    safeString(participant.participantId) ||
    safeString(participant.userId) ||
    safeString(metadata.participantId) ||
    safeString(metadata.userId) ||
    userIdFromProviderIdentity(participant.identity) ||
    safeString(participant.sid) ||
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
  const resolvedUserId =
    safeString(userId) ||
    safeString(participant.userId) ||
    safeString(metadata.userId) ||
    userIdFromProviderIdentity(participant.identity) ||
    null;
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
    deviceIdFromProviderIdentity(participant.identity) ||
    `${participantId}:device`;

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

async function publishPrewarmedLiveKitMedia(room, {
  tracks = [],
  sdk = null,
  mode = LIVEKIT_QUALITY_MODES.AUTO,
} = {}) {
  const startedAt = metricNow();
  const diagnostics = {
    ok: false,
    prewarmed: true,
    microphone: { ok: false, published: false },
    camera: { ok: false, published: false },
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalPublishLatencyMs: null,
  };
  if (!Array.isArray(tracks) || tracks.length === 0 || !room?.localParticipant?.publishTrack) {
    diagnostics.completedAt = new Date().toISOString();
    diagnostics.totalPublishLatencyMs = elapsedMs(startedAt);
    diagnostics.failure = {
      reason: "prewarmed_tracks_unavailable",
    };
    return diagnostics;
  }

  const published = [];
  const results = await Promise.allSettled(
    tracks.map(async (track) => {
      const kind = localTrackKind(track);
      const options = kind === "video"
        ? cameraPublishOptions(mode, sdk)
        : undefined;
      const publication = await room.localParticipant.publishTrack(track, options);
      return { track, kind, publication };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      published.push(result.value);
      const { kind, publication } = result.value;
      if (kind === "audio") {
        diagnostics.microphone = {
          ok: true,
          published: true,
          prewarmed: true,
          trackSid: safeString(publication?.trackSid) || null,
          source: HUDDLE_MEDIA_TRACK_SOURCES.microphone,
          latencyMs: elapsedMs(startedAt),
        };
      } else if (kind === "video") {
        diagnostics.camera = {
          ok: true,
          published: true,
          prewarmed: true,
          trackSid: safeString(publication?.trackSid) || null,
          source: HUDDLE_MEDIA_TRACK_SOURCES.camera,
          simulcastLayerCount: liveKitCameraSimulcastLayers(sdk).length,
          latencyMs: elapsedMs(startedAt),
        };
      }
    }
  }

  diagnostics.ok = Boolean(diagnostics.microphone.ok && diagnostics.camera.ok);
  diagnostics.completedAt = new Date().toISOString();
  diagnostics.totalPublishLatencyMs = elapsedMs(startedAt);
  if (!diagnostics.ok) {
    diagnostics.failure = {
      reason: "prewarmed_media_publication_incomplete",
      failures: results
        .filter((result) => result.status === "rejected")
        .map((result) =>
          sanitizeLiveKitMediaFailure(
            result.reason,
            LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLICATION_FAILED
          )
        ),
    };
    for (const item of published) {
      try {
        await room.localParticipant.unpublishTrack?.(item.track, true);
      } catch {
        // Best effort rollback before falling back to the SDK enable path.
      }
    }
    stopPrewarmedLiveKitTracks(tracks);
  }
  return diagnostics;
}

export async function publishInitialLiveKitMedia(room, {
  prewarmedTracks = null,
  prewarmDiagnostics = null,
  sdk = null,
  mode = LIVEKIT_QUALITY_MODES.AUTO,
} = {}) {
  const publishStartedAt = metricNow();
  const diagnostics = {
    microphone: { ok: false, published: false },
    camera: { ok: false, published: false },
    prewarm: prewarmDiagnostics || null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    totalPublishLatencyMs: null,
  };

  if (Array.isArray(prewarmedTracks) && prewarmedTracks.length > 0) {
    const prewarmed = await publishPrewarmedLiveKitMedia(room, {
      tracks: prewarmedTracks,
      sdk,
      mode,
    });
    if (prewarmed.ok) {
      return {
        ok: true,
        reason: LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLISHED,
        diagnostics: {
          ...diagnostics,
          ...prewarmed,
          prewarm: prewarmDiagnostics || prewarmed.prewarm || null,
        },
      };
    }
    diagnostics.prewarm = {
      ...(prewarmDiagnostics || {}),
      publishFailure: prewarmed.failure || null,
      publishLatencyMs: prewarmed.totalPublishLatencyMs,
    };
  }

  const combinedStartedAt = metricNow();
  try {
    if (
      typeof room?.localParticipant?.setMicrophoneEnabled !== "function" ||
      typeof room?.localParticipant?.setCameraEnabled !== "function"
    ) {
      throw new Error("explicit_media_enable_unavailable");
    }
    const sdkResult = await loadLiveKitSdk({ enabled: true });
    const sdk = sdkResult.ok ? sdkResult.sdk : null;
    const [microphoneResult, cameraResult] = await Promise.allSettled([
      room?.localParticipant?.setMicrophoneEnabled?.(true),
      room?.localParticipant?.setCameraEnabled?.(
        true,
        cameraCaptureOptions(mode),
        cameraPublishOptions(mode, sdk)
      ),
    ]);
    diagnostics.microphone = microphoneResult.status === "fulfilled"
      ? {
          ok: Boolean(microphoneResult.value || room?.localParticipant?.isMicrophoneEnabled),
          published: Boolean(microphoneResult.value || room?.localParticipant?.isMicrophoneEnabled),
          trackSid: safeString(microphoneResult.value?.trackSid) || null,
          source: HUDDLE_MEDIA_TRACK_SOURCES.microphone,
          latencyMs: elapsedMs(combinedStartedAt),
        }
      : {
          ok: false,
          published: false,
          failure: sanitizeLiveKitMediaFailure(
            microphoneResult.reason,
            LIVEKIT_MEDIA_PUBLICATION_REASONS.MICROPHONE_PUBLICATION_FAILED
          ),
          latencyMs: null,
        };
    diagnostics.camera = cameraResult.status === "fulfilled"
      ? {
          ok: Boolean(cameraResult.value || room?.localParticipant?.isCameraEnabled),
          published: Boolean(cameraResult.value || room?.localParticipant?.isCameraEnabled),
          trackSid: safeString(cameraResult.value?.trackSid) || null,
          source: HUDDLE_MEDIA_TRACK_SOURCES.camera,
          simulcastLayerCount: liveKitCameraSimulcastLayers(sdk).length,
          latencyMs: elapsedMs(combinedStartedAt),
        }
      : {
          ok: false,
          published: false,
          failure: sanitizeLiveKitMediaFailure(
            cameraResult.reason,
            LIVEKIT_MEDIA_PUBLICATION_REASONS.CAMERA_PUBLICATION_FAILED
          ),
          latencyMs: null,
        };
  } catch (explicitError) {
    try {
      if (typeof room?.localParticipant?.enableCameraAndMicrophone !== "function") {
        throw explicitError;
      }
      await room.localParticipant.enableCameraAndMicrophone();
      const microphonePublication =
        room.localParticipant.getTrackPublication?.(HUDDLE_MEDIA_TRACK_SOURCES.microphone);
      const cameraPublication =
        room.localParticipant.getTrackPublication?.(HUDDLE_MEDIA_TRACK_SOURCES.camera);
      const latencyMs = elapsedMs(combinedStartedAt);
      diagnostics.microphone = {
        ok: Boolean(microphonePublication || room.localParticipant.isMicrophoneEnabled),
        published: Boolean(microphonePublication || room.localParticipant.isMicrophoneEnabled),
        trackSid: safeString(microphonePublication?.trackSid) || null,
        source: HUDDLE_MEDIA_TRACK_SOURCES.microphone,
        latencyMs,
        fallback: "combined_media_enable",
      };
      diagnostics.camera = {
        ok: Boolean(cameraPublication || room.localParticipant.isCameraEnabled),
        published: Boolean(cameraPublication || room.localParticipant.isCameraEnabled),
        trackSid: safeString(cameraPublication?.trackSid) || null,
        source: HUDDLE_MEDIA_TRACK_SOURCES.camera,
        latencyMs,
        fallback: "combined_media_enable",
      };
    } catch (combinedError) {
      const failure = sanitizeLiveKitMediaFailure(
        combinedError,
        LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLICATION_FAILED
      );
      diagnostics.microphone = {
        ok: false,
        published: false,
        failure,
        latencyMs: null,
      };
      diagnostics.camera = {
        ok: false,
        published: false,
        failure,
        latencyMs: null,
      };
    }
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
    const userAgent = globalThis.navigator?.userAgent || "";
    const safari = /Safari/i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent);
    const captureOptions = {
      audio: true,
      video: { displaySurface: "monitor" },
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "include",
      contentHint: "detail",
      ...(safari
        ? {}
        : {
            resolution: {
              width: 1920,
              height: 1080,
              frameRate: 30,
              aspectRatio: 16 / 9,
            },
          }),
    };
    const publishOptions = {
      simulcast: true,
      videoEncoding: {
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      },
      screenShareEncoding: {
        maxBitrate: 2_500_000,
        maxFramerate: 30,
      },
    };
    const result = await room.localParticipant.setScreenShareEnabled(
      true,
      captureOptions,
      publishOptions
    );
    const publications = Array.isArray(result) ? result : result ? [result] : [];
    diagnostics.publications = publications.map((publication) => ({
      trackSid: safeString(publication?.trackSid) || safeString(publication?.sid) || null,
      source: trackSource(publication),
      publicationState: publicationState(publication),
      subscriptionState: subscriptionState(publication, { isLocal: true }),
    }));
    diagnostics.publicationCount = diagnostics.publications.length;
    diagnostics.capture = {
      audioRequested: true,
      contentHint: captureOptions.contentHint,
      displaySurface: captureOptions.video.displaySurface,
      resolution: captureOptions.resolution || "browser_default",
      safariResolutionWorkaround: safari,
    };
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
        liveKitParticipantUsername(participant),
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
  const sessionIdRef = useRef(null);
  const connectedRoomRef = useRef(null);
  const providerMetricsRef = useRef(createInitialLiveKitMetrics());
  const streamCacheRef = useRef(new Map());
  const latestNetworkStatsRef = useRef({});
  const qualityStatsPreviousRef = useRef(new Map());
  const qualityPostInFlightRef = useRef(false);
  const transcriptionClientRef = useRef(null);
  const transcriptionStartingRef = useRef(false);
  const captionCursorRef = useRef(null);
  const backgroundProcessorRef = useRef(null);
  const backgroundTrackRef = useRef(null);
  const backgroundEffectRef = useRef({
    mode: HUDDLE_BACKGROUND_EFFECTS.OFF,
    active: false,
  });
  const backgroundStressSamplesRef = useRef(0);
  const [connectedRoom, setConnectedRoom] = useState(null);
  const [connectionResult, setConnectionResult] = useState(null);
  const [publicationDiagnostics, setPublicationDiagnostics] = useState(null);
  const [screenShareDiagnostics, setScreenShareDiagnostics] = useState(null);
  const [backgroundEffect, setBackgroundEffectState] = useState({
    mode: HUDDLE_BACKGROUND_EFFECTS.OFF,
    active: false,
    imagePathConfigured: false,
    diagnostics: null,
  });
  const [transcriptionDiagnostics, setTranscriptionDiagnostics] = useState(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitles, setSubtitles] = useState({});
  const [captionFeed, setCaptionFeed] = useState([]);
  const [networkStatsByParticipant, setNetworkStatsByParticipant] = useState({});
  const [qualityMode, setQualityModeState] = useState(LIVEKIT_QUALITY_MODES.AUTO);
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
    return liveKitLocalStream(connectedRoom, streamCacheRef.current);
  }, [connectedRoom, revision]);
  const remotePeers = useMemo(
    () => {
      void revision;
      return createLiveKitRemotePeers(
        remoteParticipantsFromRoom(connectedRoom),
        streamCacheRef.current
      );
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
        intentToJoinMs: metrics.intentToJoinLatencyMs,
        firstAudioMs: metrics.firstAudioSubscribeLatencyMs,
        firstVideoMs: metrics.firstVideoSubscribeLatencyMs,
        captionsActiveMs: metrics.captionsActiveLatencyMs,
        captionTransportReadyMs: metrics.captionTransportReadyLatencyMs,
        captionTransportReadyFromIntentMs: metrics.captionTransportReadyFromIntentMs,
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
      latestNetworkStatsRef.current = {};
      qualityStatsPreviousRef.current.clear();
      return undefined;
    }

    let cancelled = false;
    const collect = async () => {
      try {
        const stats = await collectLiveKitNetworkStats(connectedRoom);
        latestNetworkStatsRef.current = stats;
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
    if (!connectedRoom) return undefined;
    let cancelled = false;

    const postDiagnostics = async () => {
      if (cancelled || qualityPostInFlightRef.current) return;
      const room = connectedRoomRef.current || connectedRoom;
      const channelId = channelIdRef.current;
      const huddleId = huddleIdRef.current;
      const sessionId = sessionIdRef.current || huddleId;
      if (!room || !channelId || !sessionId || !resolvedWorkspaceId) return;

      qualityPostInFlightRef.current = true;
      try {
        const diagnostics = await collectLiveKitQualitySnapshot(
          room,
          latestNetworkStatsRef.current,
          qualityStatsPreviousRef.current
        );
        const providerMetrics = providerMetricsRef.current;
        diagnostics.startup = {
          joinMs: providerMetrics.joinLatencyMs,
          publishMs: providerMetrics.publishLatencyMs,
          subscribeMs: providerMetrics.subscribeLatencyMs,
          intentToJoinMs: providerMetrics.intentToJoinLatencyMs,
          firstAudioMs: providerMetrics.firstAudioSubscribeLatencyMs,
          firstVideoMs: providerMetrics.firstVideoSubscribeLatencyMs,
          captionsActiveMs: providerMetrics.captionsActiveLatencyMs,
          prepareLatencyMs: providerMetrics.connectionTimings?.prepareLatencyMs,
          sdkLoadLatencyMs: providerMetrics.connectionTimings?.sdkLoadLatencyMs,
          roomEndpointLatencyMs: providerMetrics.connectionTimings?.roomEndpointLatencyMs,
          tokenEndpointLatencyMs: providerMetrics.connectionTimings?.tokenEndpointLatencyMs,
          tokenEndpointBackendTimings: providerMetrics.connectionTimings?.tokenEndpointBackendTimings,
          preconnectLatencyMs: providerMetrics.connectionTimings?.preconnectLatencyMs,
          preconnectInserted: providerMetrics.connectionTimings?.preconnectInserted,
          connectLatencyMs: providerMetrics.connectionTimings?.connectLatencyMs,
          totalJoinLatencyMs: providerMetrics.connectionTimings?.totalJoinLatencyMs,
          captionGrantLatencyMs: providerMetrics.captionStartupTimings?.grantLatencyMs,
          captionWebsocketOpenLatencyMs: providerMetrics.captionStartupTimings?.websocketOpenLatencyMs,
          captionRecorderStartLatencyMs: providerMetrics.captionStartupTimings?.recorderStartLatencyMs,
          captionTransportReadyLatencyMs: providerMetrics.captionTransportReadyLatencyMs,
          captionTransportReadyFromIntentMs: providerMetrics.captionTransportReadyFromIntentMs,
          captionFirstProviderResultLatencyMs: providerMetrics.captionStartupTimings?.firstProviderResultLatencyMs,
          captionFirstBackendEventLatencyMs: providerMetrics.captionStartupTimings?.firstBackendEventLatencyMs,
          captionFirstLocalCaptionLatencyMs: providerMetrics.captionStartupTimings?.firstLocalCaptionLatencyMs,
          captionGrantCacheHit: providerMetrics.captionGrantCacheHit,
          captionGrantSharedInFlight: providerMetrics.captionGrantSharedInFlight,
          mediaPrewarmLatencyMs: providerMetrics.mediaPrewarmLatencyMs,
          mediaPrewarmOk: providerMetrics.mediaPrewarmOk,
          mediaPrewarmTrackCount: providerMetrics.mediaPrewarmTrackCount,
        };
        diagnostics.backgroundEffect = backgroundEffectRef.current;
        const activeEffect = backgroundEffectRef.current;
        const localCamera = diagnostics.tracks.find(
          (track) =>
            track.isLocal &&
            track.direction === "send" &&
            track.kind === "video" &&
            track.source === HUDDLE_MEDIA_TRACK_SOURCES.camera
        );
        const effectUnderStress = Boolean(
          activeEffect?.active &&
          localCamera &&
          (
            localCamera.qualityLimitationReason === "cpu" ||
            (
              Number(localCamera.framesPerSecond) > 0 &&
              Number(localCamera.framesPerSecond) < 21
            )
          )
        );
        backgroundStressSamplesRef.current = effectUnderStress
          ? backgroundStressSamplesRef.current + 1
          : 0;
        if (
          activeEffect?.active &&
          backgroundStressSamplesRef.current >= 1
        ) {
          const localTrack = liveKitLocalCameraTrack(room);
          const nextMode =
            activeEffect.mode === HUDDLE_BACKGROUND_EFFECTS.REPLACEMENT
              ? HUDDLE_BACKGROUND_EFFECTS.BLUR
              : HUDDLE_BACKGROUND_EFFECTS.OFF;
          const degraded = await applyBackgroundEffect({
            localVideoTrack: localTrack,
            processor: backgroundProcessorRef.current,
            mode: nextMode,
            blurRadius: 8,
          });
          if (degraded.ok) {
            backgroundProcessorRef.current = degraded.processor;
            const nextEffect = {
              mode: nextMode,
              active: nextMode !== HUDDLE_BACKGROUND_EFFECTS.OFF,
              imagePath: null,
              imagePathConfigured: false,
              diagnostics: {
                reason:
                  nextMode === HUDDLE_BACKGROUND_EFFECTS.BLUR
                    ? "background_replacement_degraded_to_blur"
                    : "background_effect_automatically_disabled",
                trigger: localCamera.qualityLimitationReason || "low_frame_rate",
                framesPerSecond: localCamera.framesPerSecond,
                timings: degraded.timings || null,
                observedAt: new Date().toISOString(),
              },
            };
            backgroundEffectRef.current = nextEffect;
            setBackgroundEffectState(nextEffect);
            backgroundStressSamplesRef.current = 0;
          }
        }
        await api.post("/huddle/media/livekit/diagnostics", {
          provider: HUDDLE_MEDIA_PROVIDER_LIVEKIT,
          workspaceId: resolvedWorkspaceId,
          channelId,
          huddleId,
          sessionId,
          providerRoomId:
            connectionResult?.connection?.roomName ||
            connectionPlan.room?.providerRoomId ||
            null,
          diagnostics,
        });
      } catch (error) {
        recordMetricFailure(providerMetricsRef.current, {
          type: "quality_diagnostics_persist_failed",
          reason: "quality_diagnostics_persist_failed",
          message: safeString(error?.message) || null,
        });
        setRevision((value) => value + 1);
      } finally {
        qualityPostInFlightRef.current = false;
      }
    };

    postDiagnostics();
    const interval = window.setInterval(postDiagnostics, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connectedRoom, connectionPlan.room?.providerRoomId, connectionResult?.connection?.roomName, resolvedWorkspaceId]);

  const stopLiveTranscription = useCallback(() => {
    try {
      transcriptionClientRef.current?.stop?.();
    } catch {
      // Best effort cleanup.
    }
    transcriptionClientRef.current = null;
    transcriptionStartingRef.current = false;
    setTranscriptionDiagnostics((previous) => ({
      ...(previous || {}),
      status: "stopped",
      observedAt: new Date().toISOString(),
    }));
  }, []);

  const startLiveTranscriptionCapture = useCallback(async () => {
    if (transcriptionClientRef.current || transcriptionStartingRef.current) {
      return { ok: true, alreadyStarted: true };
    }
    const room = connectedRoomRef.current || connectedRoom;
    const sessionId = sessionIdRef.current || huddleIdRef.current;
    const audioTrack = liveKitLocalAudioTrack(room);
    if (!room || !sessionId) {
      return { ok: false, reason: "livekit_not_connected" };
    }
    if (!liveTranscriptionSupported()) {
      return { ok: false, reason: "live_transcription_not_supported" };
    }
    if (!audioTrack) {
      return { ok: false, reason: "microphone_track_required" };
    }

    transcriptionStartingRef.current = true;
    const client = createLiveTranscriptionClient({
      sessionId,
      audioTrack,
      language: LIVE_CAPTION_LANGUAGE,
      onCaption: (caption) => {
        const metrics = providerMetricsRef.current;
        if (!metrics.firstCaptionAt) {
          metrics.firstCaptionAt = metricNow();
          metrics.captionsActiveLatencyMs = elapsedMs(
            metrics.intentStartedAt || metrics.joinStartedAt,
            metrics.firstCaptionAt
          );
        }
        const localCaption = {
          ...caption,
          speaker: {
            participantId: caption.speakerId || null,
            userId: currentUser?.id || null,
            label: currentUser?.username || currentUser?.name || "You",
          },
        };
        setSubtitles((previous) => ({
          ...previous,
          local: localCaption,
        }));
        setCaptionFeed((previous) =>
          canonicalCaptionFeed([...previous, localCaption])
        );
      },
      onDiagnostics: (diagnostics) => {
        const metrics = providerMetricsRef.current;
        const timings = diagnostics?.timings || metrics.captionStartupTimings;
        metrics.captionStartupTimings = timings;
        metrics.captionGrantCacheHit = Boolean(diagnostics?.grantCacheHit);
        metrics.captionGrantSharedInFlight = Boolean(diagnostics?.grantSharedInFlight);
        if (
          diagnostics?.websocketOpen &&
          diagnostics?.recorderStarted &&
          !metrics.captionTransportReadyAt
        ) {
          metrics.captionTransportReadyAt = metricNow();
          metrics.captionTransportReadyLatencyMs = Math.max(
            Number(timings?.websocketOpenLatencyMs) || 0,
            Number(timings?.recorderStartLatencyMs) || 0
          ) || null;
          metrics.captionTransportReadyFromIntentMs = elapsedMs(
            metrics.intentStartedAt || metrics.joinStartedAt,
            metrics.captionTransportReadyAt
          );
        }
        setTranscriptionDiagnostics(diagnostics);
      },
    });
    transcriptionClientRef.current = client;

    try {
      await client.start();
      transcriptionStartingRef.current = false;
      return { ok: true, capturing: true };
    } catch (error) {
      transcriptionClientRef.current = null;
      transcriptionStartingRef.current = false;
      setTranscriptionDiagnostics({
        status: "failed",
        reason: safeString(error?.response?.data?.reason || error?.message) || "live_transcription_start_failed",
        observedAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: safeString(error?.response?.data?.reason || error?.message) || "live_transcription_start_failed",
      };
    }
  }, [
    connectedRoom,
    currentUser?.id,
    currentUser?.name,
    currentUser?.username,
  ]);

  const toggleSubtitles = useCallback(async () => {
    const enabled = !subtitlesEnabled;
    setSubtitlesEnabled(enabled);
    return { ok: true, enabled };
  }, [subtitlesEnabled]);

  useEffect(() => {
    if (!connectedRoom || !liveTranscriptionSupported()) return undefined;
    let cancelled = false;
    let retryTimer = null;

    const ensureCapture = async () => {
      const result = await startLiveTranscriptionCapture();
      if (!cancelled && !result?.ok) {
        retryTimer = window.setTimeout(ensureCapture, 1000);
      }
    };
    ensureCapture();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [connectedRoom, revision, startLiveTranscriptionCapture]);

  useEffect(() => {
    if (!connectedRoom || !subtitlesEnabled) return undefined;
    let cancelled = false;
    let inFlight = false;

    const loadCaptions = async () => {
      if (cancelled || inFlight) return;
      const sessionId = sessionIdRef.current || huddleIdRef.current;
      if (!sessionId) return;
      inFlight = true;
      try {
        const cursor = captionCursorRef.current;
        const after = cursor
          ? new Date(
              Math.max(
                0,
                new Date(cursor).getTime() - LIVE_CAPTION_CURSOR_OVERLAP_MS
              )
            ).toISOString()
          : null;
        const { data } = await api.get(
          `/huddle/intelligence/sessions/${sessionId}/captions`,
          {
            params: {
              replayableOnly: true,
              after,
              limit: LIVE_CAPTION_HISTORY_LIMIT,
            },
          }
        );
        if (!cancelled) {
          const incoming = Array.isArray(data?.captions) ? data.captions : [];
          if (incoming.length > 0) {
            const metrics = providerMetricsRef.current;
            if (!metrics.firstCaptionAt) {
              metrics.firstCaptionAt = metricNow();
              metrics.captionsActiveLatencyMs = elapsedMs(
                metrics.intentStartedAt || metrics.joinStartedAt,
                metrics.firstCaptionAt
              );
            }
            captionCursorRef.current =
              incoming[incoming.length - 1]?.emittedAt ||
              captionCursorRef.current;
            setCaptionFeed((previous) =>
              canonicalCaptionFeed([...previous, ...incoming])
            );
          }
          setTranscriptionDiagnostics((previous) => ({
            ...(previous || {}),
            captionFeedStatus: "streaming",
            captionFeedLastEventAt:
              incoming[incoming.length - 1]?.emittedAt ||
              previous?.captionFeedLastEventAt ||
              null,
            captionFeedEventCount: incoming.length,
            observedAt: new Date().toISOString(),
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setTranscriptionDiagnostics((previous) => ({
            ...(previous || {}),
            captionFeedStatus: "failed",
            captionFeedError:
              safeString(error?.response?.data?.reason || error?.message) ||
              "caption_feed_failed",
            observedAt: new Date().toISOString(),
          }));
        }
      } finally {
        inFlight = false;
      }
    };

    loadCaptions();
    const interval = window.setInterval(loadCaptions, LIVE_CAPTION_POLL_INTERVAL_MS);
    const refreshNow = () => {
      void loadCaptions();
    };
    window.addEventListener("online", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, [connectedRoom, subtitlesEnabled]);

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
      streamCacheRef.current.clear();
      stopLiveTranscription();
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
        const trackKind = safeString(_track?.kind || publication?.kind).toLowerCase();
        if (!metrics.firstSubscribeAt) {
          metrics.firstSubscribeAt = metricNow();
          metrics.subscribeLatencyMs = elapsedMs(metrics.roomStartedAt || metrics.joinStartedAt, metrics.firstSubscribeAt);
        }
        if (trackKind === "audio" && !metrics.firstAudioSubscribeAt) {
          metrics.firstAudioSubscribeAt = metricNow();
          metrics.firstAudioSubscribeLatencyMs = elapsedMs(
            metrics.intentStartedAt || metrics.joinStartedAt,
            metrics.firstAudioSubscribeAt
          );
        }
        if (trackKind === "video" && !metrics.firstVideoSubscribeAt) {
          metrics.firstVideoSubscribeAt = metricNow();
          metrics.firstVideoSubscribeLatencyMs = elapsedMs(
            metrics.intentStartedAt || metrics.joinStartedAt,
            metrics.firstVideoSubscribeAt
          );
        }
        recordAndBump("trackSubscribed", {
          participantId: participantIdentity(participant),
          trackSid: safeString(publication?.trackSid) || null,
          trackKind: trackKind || null,
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
  }, [connectedRoom, stopLiveTranscription]);

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

    channelIdRef.current = channelId;
    huddleIdRef.current = huddleId || huddleIdRef.current;
    sessionIdRef.current = sessionId;
    captionCursorRef.current = null;
    setCaptionFeed([]);
    setConnecting(true);
    try {
      providerMetricsRef.current = {
        ...createInitialLiveKitMetrics(),
        intentStartedAt:
          Number.isFinite(Number(params.intentStartedAt))
            ? Number(params.intentStartedAt)
            : metricNow(),
        joinStartedAt: metricNow(),
      };
      streamCacheRef.current.clear();
      const mediaPrewarmPromise = prewarmInitialLiveKitTracks({
        mode: qualityMode,
      });
      let result = await connectLiveKitRoom({
        canary,
        workspaceId: resolvedWorkspaceId,
        channelId,
        huddleId,
        sessionId,
        deviceId: safeString(params.deviceId) || null,
      });

      if (result.ok && result.connection?.room) {
        connectedRoomRef.current = result.connection.room;
        setConnectedRoom(result.connection.room);
        setRevision((value) => value + 1);
        providerMetricsRef.current.joinLatencyMs =
          result.diagnostics?.timings?.totalJoinLatencyMs ||
          elapsedMs(providerMetricsRef.current.joinStartedAt);
        providerMetricsRef.current.connectionTimings =
          result.diagnostics?.timings || null;
        providerMetricsRef.current.intentToJoinLatencyMs = elapsedMs(
          providerMetricsRef.current.intentStartedAt
        );
        providerMetricsRef.current.roomStartedAt = metricNow();
        recordMetricTransition(providerMetricsRef.current, "connected", {
          joinLatencyMs: providerMetricsRef.current.joinLatencyMs,
        });
        markExistingSubscribedTracks(providerMetricsRef.current, result.connection.room);
        const prewarmResult = await mediaPrewarmPromise.catch((error) => ({
          ok: false,
          reason: "livekit_track_prewarm_failed",
          tracks: [],
          sdk: null,
          diagnostics: {
            ok: false,
            failure: sanitizeLiveKitMediaFailure(
              error,
              LIVEKIT_MEDIA_PUBLICATION_REASONS.MEDIA_PUBLICATION_FAILED
            ),
          },
        }));
        providerMetricsRef.current.mediaPrewarmLatencyMs =
          prewarmResult?.diagnostics?.latencyMs || null;
        providerMetricsRef.current.mediaPrewarmOk = Boolean(prewarmResult?.ok);
        providerMetricsRef.current.mediaPrewarmTrackCount =
          prewarmResult?.diagnostics?.trackCount || 0;
        const publishResult = await publishInitialLiveKitMedia(result.connection.room, {
          prewarmedTracks: prewarmResult?.tracks || null,
          prewarmDiagnostics: prewarmResult?.diagnostics || null,
          sdk: prewarmResult?.sdk || null,
          mode: qualityMode,
        });
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

        void startLiveTranscriptionCapture();

        result = {
          ...result,
          diagnostics: {
            ...result.diagnostics,
            publication: publishResult.diagnostics,
          },
        };
      }
      if (!result.ok) {
        void mediaPrewarmPromise
          .then((prewarmResult) => stopPrewarmedLiveKitTracks(prewarmResult?.tracks || []))
          .catch(noop);
      }

      setConnectionResult(result);
      return result;
    } finally {
      setConnecting(false);
    }
  }, [canary, connecting, connectionResult, qualityMode, resolvedWorkspaceId, startLiveTranscriptionCapture]);
  const leaveCall = useCallback(() => {
    const room = connectedRoomRef.current;
    try {
      room?.disconnect?.();
    } catch {
      // Disconnect is best-effort during provider cleanup.
    }
    providerMetricsRef.current.roomEndedAt = metricNow();
    recordMetricTransition(providerMetricsRef.current, "leaveCall");
    stopLiveTranscription();
    setSubtitlesEnabled(false);
    connectedRoomRef.current = null;
    streamCacheRef.current.clear();
    setConnectedRoom(null);
    setPublicationDiagnostics(null);
    setScreenShareDiagnostics(null);
    void destroyBackgroundEffect(backgroundProcessorRef.current);
    backgroundProcessorRef.current = null;
    backgroundTrackRef.current = null;
    setBackgroundEffectState({
      mode: HUDDLE_BACKGROUND_EFFECTS.OFF,
      active: false,
      imagePathConfigured: false,
      diagnostics: null,
    });
    backgroundEffectRef.current = {
      mode: HUDDLE_BACKGROUND_EFFECTS.OFF,
      active: false,
    };
    backgroundStressSamplesRef.current = 0;
    setNetworkStatsByParticipant({});
    latestNetworkStatsRef.current = {};
    qualityStatsPreviousRef.current.clear();
    sessionIdRef.current = null;
    captionCursorRef.current = null;
    setSubtitles({});
    setCaptionFeed([]);
    const result = disconnectLiveKitRoom();
    setConnectionResult(result);
    return result;
  }, [stopLiveTranscription]);
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
      const sdkResult = await loadLiveKitSdk({ enabled: true });
      const sdk = sdkResult.ok ? sdkResult.sdk : null;
      const publication = await room.localParticipant.setCameraEnabled(
        nextEnabled,
        nextEnabled ? cameraCaptureOptions(qualityMode) : undefined,
        nextEnabled ? cameraPublishOptions(qualityMode, sdk) : undefined
      );
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        cameraToggle: {
          ok: true,
          enabled: nextEnabled,
          trackSid: safeString(publication?.trackSid) || null,
          simulcastLayerCount: nextEnabled
            ? liveKitCameraSimulcastLayers(sdk).length
            : null,
          observedAt: new Date().toISOString(),
        },
      }));
      setRevision((value) => value + 1);
      if (nextEnabled && backgroundEffect.mode !== HUDDLE_BACKGROUND_EFFECTS.OFF) {
        window.setTimeout(() => {
          const nextTrack = liveKitLocalCameraTrack(room);
          if (!nextTrack) return;
          if (backgroundTrackRef.current && backgroundTrackRef.current !== nextTrack) {
            void destroyBackgroundEffect(backgroundProcessorRef.current);
            backgroundProcessorRef.current = null;
          }
          backgroundTrackRef.current = nextTrack;
          void applyBackgroundEffect({
            localVideoTrack: nextTrack,
            processor: backgroundProcessorRef.current,
            mode: backgroundEffect.mode,
            imagePath: backgroundEffect.imagePath || null,
          }).then((result) => {
            if (!result.ok) return;
            backgroundProcessorRef.current = result.processor;
            setBackgroundEffectState((current) => ({
              ...current,
              diagnostics: {
                ...result,
                timings: result.timings || null,
              },
            }));
          });
        }, 250);
      }
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
  }, [backgroundEffect.imagePath, backgroundEffect.mode, qualityMode]);
  const setQualityMode = useCallback(async (requestedMode = LIVEKIT_QUALITY_MODES.AUTO) => {
    const mode = Object.values(LIVEKIT_QUALITY_MODES).includes(requestedMode)
      ? requestedMode
      : LIVEKIT_QUALITY_MODES.AUTO;
    const room = connectedRoomRef.current;
    if (!room) return { ok: false, reason: "livekit_not_connected" };
    try {
      const sdkResult = await loadLiveKitSdk({ enabled: true });
      if (!sdkResult.ok) return { ok: false, reason: "livekit_sdk_unavailable" };
      const sdk = sdkResult.sdk;
      const captureOptions = cameraCaptureOptions(mode);
      const localCameraTrack = liveKitLocalCameraTrack(room);
      if (localCameraTrack?.restartTrack && room.localParticipant?.isCameraEnabled) {
        await localCameraTrack.restartTrack(captureOptions);
      }
      for (const participant of remoteParticipantsFromRoom(room)) {
        for (const publication of displayTrackPublications(participant)) {
          if (
            publication?.kind !== "video" ||
            publication?.source === sdk.Track?.Source?.ScreenShare
          ) {
            continue;
          }
          if (mode === LIVEKIT_QUALITY_MODES.HD) {
            publication.setVideoQuality?.(sdk.VideoQuality.HIGH);
          } else if (mode === LIVEKIT_QUALITY_MODES.STANDARD) {
            publication.setVideoQuality?.(sdk.VideoQuality.MEDIUM);
          }
        }
      }
      setQualityModeState(mode);
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        qualityMode: {
          mode,
          captureOptions,
          publishOptions: cameraPublishOptions(mode, sdk),
          simulcastLayerCount: liveKitCameraSimulcastLayers(sdk).length,
          adaptiveStream: true,
          dynacast: true,
          observedAt: new Date().toISOString(),
        },
      }));
      setRevision((value) => value + 1);
      return { ok: true, mode, captureOptions };
    } catch (error) {
      return {
        ok: false,
        reason: safeString(error?.message) || "livekit_quality_mode_failed",
      };
    }
  }, []);
  const setBackgroundEffect = useCallback(async ({
    mode = HUDDLE_BACKGROUND_EFFECTS.OFF,
    imagePath = null,
    blurRadius = 12,
  } = {}) => {
    const room = connectedRoomRef.current;
    const localVideoTrack = liveKitLocalCameraTrack(room);
    if (!room || !localVideoTrack) {
      return { ok: false, reason: "livekit_camera_track_required" };
    }
    if (
      isMobileBackgroundEffectDevice() &&
      mode !== HUDDLE_BACKGROUND_EFFECTS.OFF
    ) {
      const next = {
        mode: HUDDLE_BACKGROUND_EFFECTS.OFF,
        active: false,
        imagePath: null,
        imagePathConfigured: false,
        diagnostics: {
          reason: "background_effect_disabled_on_mobile_for_call_quality",
          requestedMode: mode,
          observedAt: new Date().toISOString(),
        },
      };
      await destroyBackgroundEffect(backgroundProcessorRef.current);
      backgroundProcessorRef.current = null;
      backgroundEffectRef.current = next;
      backgroundStressSamplesRef.current = 0;
      setBackgroundEffectState(next);
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        backgroundEffect: next,
      }));
      setRevision((value) => value + 1);
      return {
        ok: false,
        reason: next.diagnostics.reason,
        backgroundEffect: next,
      };
    }
    if (
      backgroundTrackRef.current &&
      backgroundTrackRef.current !== localVideoTrack
    ) {
      await destroyBackgroundEffect(backgroundProcessorRef.current);
      backgroundProcessorRef.current = null;
    }
    backgroundTrackRef.current = localVideoTrack;
    try {
      const result = await applyBackgroundEffect({
        localVideoTrack,
        processor: backgroundProcessorRef.current,
        mode,
        imagePath,
        blurRadius,
      });
      if (!result.ok) return result;
      backgroundProcessorRef.current = result.processor;
      const next = {
        mode,
        active: mode !== HUDDLE_BACKGROUND_EFFECTS.OFF,
        imagePath: mode === HUDDLE_BACKGROUND_EFFECTS.REPLACEMENT ? imagePath : null,
        imagePathConfigured:
          mode === HUDDLE_BACKGROUND_EFFECTS.REPLACEMENT && Boolean(imagePath),
        diagnostics: {
          reason: result.reason,
          modern: result.modern,
          timings: result.timings || null,
          observedAt: result.observedAt,
        },
      };
      backgroundEffectRef.current = next;
      backgroundStressSamplesRef.current = 0;
      setBackgroundEffectState(next);
      setPublicationDiagnostics((previous) => ({
        ...(previous || {}),
        backgroundEffect: next,
      }));
      setRevision((value) => value + 1);
      return { ...result, ...next };
    } catch (error) {
      const diagnostics = {
        reason: safeString(error?.message) || "background_effect_failed",
        observedAt: new Date().toISOString(),
      };
      setBackgroundEffectState((current) => ({
        ...current,
        diagnostics,
      }));
      return { ok: false, reason: diagnostics.reason, diagnostics };
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
  const backgroundEffectSupport = getBackgroundEffectSupport();
  const backgroundEffectsEnabled =
    backgroundEffectSupport.supported && !isMobileBackgroundEffectDevice();

  return {
    inCall: Boolean(connectedRoom),
    connecting,
    localStream,
    remotePeers,
    micEnabled,
    camEnabled,
    screenSharing,
    screenShareSupported: Boolean(
      connectedRoom?.localParticipant?.setScreenShareEnabled &&
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getDisplayMedia
    ),
    backgroundEffectsSupported: backgroundEffectsEnabled,
    backgroundEffectSupport: {
      ...backgroundEffectSupport,
      supported: backgroundEffectsEnabled,
      mobileDisabledForCallQuality:
        backgroundEffectSupport.supported && isMobileBackgroundEffectDevice(),
    },
    backgroundEffect,
    subtitlesSupported: Boolean(connectedRoom && liveTranscriptionSupported()),
    subtitlesEnabled,
    subtitles,
    captionFeed,
    captionStatus:
      transcriptionDiagnostics?.captionFeedStatus ||
      transcriptionDiagnostics?.status ||
      "idle",
    activeSpeakerId,
    networkQuality,
    qualityMode,
    mediaStateV2,
    diagnostics: {
      ...mediaStateV2.diagnostics,
      metadata: {
        ...mediaStateV2.diagnostics.metadata,
        connectionResult: connectionResult?.diagnostics || null,
        publication: publicationDiagnostics,
        screenShare: screenShareDiagnostics,
        backgroundEffect,
        transcription: transcriptionDiagnostics,
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
    setBackgroundEffect,
    setQualityMode,
    toggleSubtitles,
    startRecording: noop,
    stopRecording: noop,
    muteAll: noop,
    setChannelId,
    setHuddleId,
  };
}
