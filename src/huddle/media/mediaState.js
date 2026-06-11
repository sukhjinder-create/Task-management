export const HUDDLE_MEDIA_PROVIDER_MESH = "mesh";
export const HUDDLE_MEDIA_PROVIDER_LIVEKIT = "livekit";

export const HUDDLE_MEDIA_CONNECTION_STATES = Object.freeze({
  idle: "idle",
  connecting: "connecting",
  joined: "joined",
  leaving: "leaving",
  failed: "failed",
});

export const HUDDLE_MEDIA_TRACK_KINDS = Object.freeze({
  audio: "audio",
  video: "video",
  screen: "screen",
});

export const HUDDLE_MEDIA_MODEL_VERSION = 2;

export const HUDDLE_MEDIA_TRACK_SOURCES = Object.freeze({
  microphone: "microphone",
  camera: "camera",
  screen: "screen",
});

export const HUDDLE_MEDIA_PUBLICATION_STATES = Object.freeze({
  unpublished: "unpublished",
  publishing: "publishing",
  published: "published",
  failed: "failed",
});

export const HUDDLE_MEDIA_SUBSCRIPTION_STATES = Object.freeze({
  unsubscribed: "unsubscribed",
  subscribing: "subscribing",
  subscribed: "subscribed",
  failed: "failed",
});

export const HUDDLE_MEDIA_NETWORK_QUALITY = Object.freeze({
  good: "good",
  ok: "ok",
  poor: "poor",
});

export function createHuddleActiveSpeakerDiagnosticsV2({
  activeSpeakerId = null,
  speakerRanking = [],
  transitions = [],
  observedAt = new Date().toISOString(),
} = {}) {
  return {
    activeSpeakerId: activeSpeakerId == null ? null : String(activeSpeakerId),
    speakerRanking: (Array.isArray(speakerRanking) ? speakerRanking : []).map((speaker, index) => ({
      participantId: speaker?.participantId == null ? null : String(speaker.participantId),
      rank: Number.isFinite(Number(speaker?.rank)) ? Number(speaker.rank) : index + 1,
      isSpeaking: speaker?.isSpeaking !== false,
      audioLevel: Number.isFinite(Number(speaker?.audioLevel)) ? Number(speaker.audioLevel) : null,
    })),
    transitions: Array.isArray(transitions) ? transitions.slice(-40) : [],
    observedAt,
  };
}

export function createHuddleNetworkQualityDiagnosticsV2({
  quality = HUDDLE_MEDIA_NETWORK_QUALITY.good,
  participants = [],
  transitions = [],
  aggregate = {},
  observedAt = new Date().toISOString(),
} = {}) {
  const safeQuality = Object.values(HUDDLE_MEDIA_NETWORK_QUALITY).includes(quality)
    ? quality
    : HUDDLE_MEDIA_NETWORK_QUALITY.good;

  return {
    quality: safeQuality,
    participants: (Array.isArray(participants) ? participants : []).map((participant) => ({
      participantId: participant?.participantId == null ? null : String(participant.participantId),
      quality: participant?.quality || HUDDLE_MEDIA_NETWORK_QUALITY.good,
      rttMs: Number.isFinite(Number(participant?.rttMs)) ? Number(participant.rttMs) : null,
      packetLoss: Number.isFinite(Number(participant?.packetLoss)) ? Number(participant.packetLoss) : null,
      bitrateKbps: Number.isFinite(Number(participant?.bitrateKbps)) ? Number(participant.bitrateKbps) : null,
    })),
    transitions: Array.isArray(transitions) ? transitions.slice(-40) : [],
    aggregate: {
      worstQuality: aggregate?.worstQuality || safeQuality,
      averageRttMs: Number.isFinite(Number(aggregate?.averageRttMs)) ? Number(aggregate.averageRttMs) : null,
      averagePacketLoss: Number.isFinite(Number(aggregate?.averagePacketLoss)) ? Number(aggregate.averagePacketLoss) : null,
      totalBitrateKbps: Number.isFinite(Number(aggregate?.totalBitrateKbps)) ? Number(aggregate.totalBitrateKbps) : null,
    },
    observedAt,
  };
}

export function createInitialHuddleMediaState() {
  return {
    provider: HUDDLE_MEDIA_PROVIDER_MESH,
    connectionState: HUDDLE_MEDIA_CONNECTION_STATES.idle,
    localStream: null,
    remotePeers: [],
    micEnabled: true,
    camEnabled: true,
    screenSharing: false,
    subtitlesEnabled: false,
    subtitles: {},
    activeSpeakerId: null,
    networkQuality: HUDDLE_MEDIA_NETWORK_QUALITY.good,
    diagnostics: null,
    mediaStateV2: createInitialHuddleMediaStateV2(),
  };
}

export function createRemotePeerState({
  userId,
  username = "",
  stream = null,
  videoTrack = null,
  audioTrack = null,
  videoPublication = null,
  audioPublication = null,
  selectedVideoSource = null,
  isMuted = false,
  isCameraOff = false,
  isScreenSharing = false,
} = {}) {
  return {
    userId,
    username,
    stream,
    videoTrack,
    audioTrack,
    videoPublication,
    audioPublication,
    selectedVideoSource,
    isMuted,
    isCameraOff,
    isScreenSharing,
  };
}

export function createInitialHuddleMediaStateV2({
  provider = HUDDLE_MEDIA_PROVIDER_MESH,
  connectionState = HUDDLE_MEDIA_CONNECTION_STATES.idle,
} = {}) {
  return {
    version: HUDDLE_MEDIA_MODEL_VERSION,
    provider,
    connectionState,
    participants: [],
    devices: [],
    tracks: [],
    diagnostics: createHuddleMediaDiagnosticsV2({ provider }),
  };
}

export function createHuddleMediaParticipantV2({
  participantId,
  userId,
  username = "",
  role = "participant",
  isLocal = false,
  devices = [],
  tracks = [],
  metadata = {},
} = {}) {
  return {
    participantId: String(participantId || userId || ""),
    userId: userId == null ? null : String(userId),
    username,
    role,
    isLocal: Boolean(isLocal),
    devices,
    tracks,
    metadata,
  };
}

export function createHuddleMediaDeviceV2({
  deviceId,
  participantId,
  userId,
  provider = HUDDLE_MEDIA_PROVIDER_MESH,
  isLocal = false,
  connectionState = HUDDLE_MEDIA_CONNECTION_STATES.idle,
  tracks = [],
  metadata = {},
} = {}) {
  return {
    deviceId: String(deviceId || ""),
    participantId: String(participantId || userId || ""),
    userId: userId == null ? null : String(userId),
    provider,
    isLocal: Boolean(isLocal),
    connectionState,
    tracks,
    metadata,
  };
}

export function createHuddleMediaTrackV2({
  trackId,
  participantId,
  deviceId,
  userId,
  kind = HUDDLE_MEDIA_TRACK_KINDS.audio,
  source = HUDDLE_MEDIA_TRACK_SOURCES.microphone,
  provider = HUDDLE_MEDIA_PROVIDER_MESH,
  providerTrackId = null,
  mediaTrackId = null,
  streamId = null,
  enabled = true,
  muted = false,
  publicationState = HUDDLE_MEDIA_PUBLICATION_STATES.published,
  subscriptionState = HUDDLE_MEDIA_SUBSCRIPTION_STATES.subscribed,
  isLocal = false,
  metadata = {},
} = {}) {
  return {
    trackId: String(trackId || providerTrackId || mediaTrackId || ""),
    participantId: String(participantId || userId || ""),
    deviceId: String(deviceId || ""),
    userId: userId == null ? null : String(userId),
    kind,
    source,
    provider,
    providerTrackId,
    mediaTrackId,
    streamId,
    enabled: Boolean(enabled),
    muted: Boolean(muted),
    publicationState,
    subscriptionState,
    isLocal: Boolean(isLocal),
    metadata,
  };
}

export function createHuddleMediaDiagnosticsV2({
  provider = HUDDLE_MEDIA_PROVIDER_MESH,
  participantCount = 0,
  deviceCount = 0,
  trackCount = 0,
  screenShareActive = false,
  screenShareParticipantIds = [],
  observedAt = new Date().toISOString(),
  metadata = {},
} = {}) {
  return {
    version: HUDDLE_MEDIA_MODEL_VERSION,
    provider,
    participantCount,
    deviceCount,
    trackCount,
    screenShareActive: Boolean(screenShareActive),
    screenShareParticipantIds,
    observedAt,
    metadata,
  };
}

function localUserId(currentUser) {
  const id = currentUser?.id ?? currentUser?.userId ?? currentUser?._id;
  return id == null ? null : String(id);
}

function localUsername(currentUser) {
  return currentUser?.username || currentUser?.name || currentUser?.email || "";
}

function meshTrackSource(track, { screenSharing = false, peerScreenSharing = false } = {}) {
  if (track?.kind === "audio") return HUDDLE_MEDIA_TRACK_SOURCES.microphone;
  if (screenSharing || peerScreenSharing) return HUDDLE_MEDIA_TRACK_SOURCES.screen;
  return HUDDLE_MEDIA_TRACK_SOURCES.camera;
}

function meshTrackKind(track, source) {
  if (source === HUDDLE_MEDIA_TRACK_SOURCES.screen) return HUDDLE_MEDIA_TRACK_KINDS.screen;
  if (track?.kind === "video") return HUDDLE_MEDIA_TRACK_KINDS.video;
  return HUDDLE_MEDIA_TRACK_KINDS.audio;
}

function addMeshTracks({
  tracks,
  participantTrackIds,
  stream,
  participantId,
  deviceId,
  userId,
  provider,
  isLocal,
  muted = false,
  screenSharing = false,
  peerScreenSharing = false,
}) {
  if (!stream?.getTracks) return;
  stream.getTracks().forEach((track, index) => {
    const source = meshTrackSource(track, { screenSharing, peerScreenSharing });
    const kind = meshTrackKind(track, source);
    const trackId = `${deviceId}:${kind}:${source}:${track.id || index}`;
    participantTrackIds.push(trackId);
    tracks.push(createHuddleMediaTrackV2({
      trackId,
      participantId,
      deviceId,
      userId,
      kind,
      source,
      provider,
      providerTrackId: track.id || null,
      mediaTrackId: track.id || null,
      streamId: stream.id || null,
      enabled: track.enabled !== false,
      muted: muted || track.enabled === false,
      isLocal,
    }));
  });
}

export function buildMeshMediaStateV2({
  currentUser,
  inCall = false,
  connecting = false,
  localStream = null,
  remotePeers = [],
  micEnabled = true,
  camEnabled = true,
  screenSharing = false,
  metadata = {},
} = {}) {
  const provider = HUDDLE_MEDIA_PROVIDER_MESH;
  const connectionState = connecting
    ? HUDDLE_MEDIA_CONNECTION_STATES.connecting
    : inCall
      ? HUDDLE_MEDIA_CONNECTION_STATES.joined
      : HUDDLE_MEDIA_CONNECTION_STATES.idle;
  const participants = [];
  const devices = [];
  const tracks = [];
  const screenShareParticipantIds = [];
  const userId = localUserId(currentUser);

  const includeLocal = Boolean(localStream || inCall || connecting);
  if (includeLocal) {
    const participantId = userId || "local";
    const deviceId = `mesh:${participantId}:local`;
    const participantTrackIds = [];
    addMeshTracks({
      tracks,
      participantTrackIds,
      stream: localStream,
      participantId,
      deviceId,
      userId: participantId,
      provider,
      isLocal: true,
      muted: !micEnabled,
      screenSharing,
    });
    if (screenSharing) screenShareParticipantIds.push(participantId);
    devices.push(createHuddleMediaDeviceV2({
      deviceId,
      participantId,
      userId: participantId,
      provider,
      isLocal: true,
      connectionState,
      tracks: participantTrackIds,
      metadata: { micEnabled, camEnabled, screenSharing },
    }));
    participants.push(createHuddleMediaParticipantV2({
      participantId,
      userId: participantId,
      username: localUsername(currentUser),
      isLocal: true,
      devices: [deviceId],
      tracks: participantTrackIds,
    }));
  }

  remotePeers.forEach((peer) => {
    const peerId = String(peer.userId);
    if (!peerId || peerId === userId) return;
    const deviceId = `mesh:${peerId}:remote`;
    const participantTrackIds = [];
    addMeshTracks({
      tracks,
      participantTrackIds,
      stream: peer.stream,
      participantId: peerId,
      deviceId,
      userId: peerId,
      provider,
      isLocal: false,
      muted: Boolean(peer.isMuted),
      peerScreenSharing: Boolean(peer.isScreenSharing),
    });
    if (peer.isScreenSharing) screenShareParticipantIds.push(peerId);
    devices.push(createHuddleMediaDeviceV2({
      deviceId,
      participantId: peerId,
      userId: peerId,
      provider,
      isLocal: false,
      connectionState: HUDDLE_MEDIA_CONNECTION_STATES.joined,
      tracks: participantTrackIds,
      metadata: {
        isMuted: Boolean(peer.isMuted),
        isCameraOff: Boolean(peer.isCameraOff),
        isScreenSharing: Boolean(peer.isScreenSharing),
      },
    }));
    participants.push(createHuddleMediaParticipantV2({
      participantId: peerId,
      userId: peerId,
      username: peer.username || "",
      isLocal: false,
      devices: [deviceId],
      tracks: participantTrackIds,
    }));
  });

  const diagnostics = createHuddleMediaDiagnosticsV2({
    provider,
    participantCount: participants.length,
    deviceCount: devices.length,
    trackCount: tracks.length,
    screenShareActive: screenShareParticipantIds.length > 0,
    screenShareParticipantIds,
    metadata,
  });

  return {
    version: HUDDLE_MEDIA_MODEL_VERSION,
    provider,
    connectionState,
    participants,
    devices,
    tracks,
    diagnostics,
  };
}
