import { createInitialHuddleMediaState } from "./mediaState";

export const MEDIA_PROVIDER_METHODS = Object.freeze([
  "startCall",
  "leaveCall",
  "toggleMic",
  "toggleCamera",
  "startScreenShare",
  "stopScreenShare",
  "setBackgroundEffect",
  "setQualityMode",
  "toggleSubtitles",
  "startRecording",
  "stopRecording",
  "muteAll",
  "setChannelId",
  "setHuddleId",
]);

export const MEDIA_PROVIDER_STATE_FIELDS = Object.freeze([
  "inCall",
  "connecting",
  "localStream",
  "remotePeers",
  "micEnabled",
  "camEnabled",
  "screenSharing",
  "screenShareSupported",
  "backgroundEffectsSupported",
  "backgroundEffect",
  "subtitlesSupported",
  "subtitlesEnabled",
  "subtitles",
  "activeSpeakerId",
  "networkQuality",
  "qualityMode",
]);

export const MEDIA_PROVIDER_V2_STATE_FIELDS = Object.freeze([
  "mediaStateV2",
  "diagnostics",
]);

export function createEmptyMediaProvider() {
  const state = createInitialHuddleMediaState();
  const noop = () => {};
  const noopAsync = async () => {};

  return {
    inCall: false,
    connecting: false,
    localStream: state.localStream,
    remotePeers: state.remotePeers,
    micEnabled: state.micEnabled,
    camEnabled: state.camEnabled,
    screenSharing: state.screenSharing,
    screenShareSupported: false,
    backgroundEffectsSupported: false,
    backgroundEffect: { mode: "off", active: false },
    subtitlesSupported: false,
    subtitlesEnabled: state.subtitlesEnabled,
    subtitles: state.subtitles,
    activeSpeakerId: state.activeSpeakerId,
    networkQuality: state.networkQuality,
    qualityMode: "auto",
    mediaStateV2: state.mediaStateV2,
    diagnostics: state.mediaStateV2.diagnostics,
    startCall: noopAsync,
    leaveCall: noop,
    toggleMic: noop,
    toggleCamera: noopAsync,
    startScreenShare: noopAsync,
    stopScreenShare: noop,
    setBackgroundEffect: noopAsync,
    setQualityMode: noopAsync,
    toggleSubtitles: noop,
    startRecording: noop,
    stopRecording: noop,
    muteAll: noop,
    setChannelId: noop,
    setHuddleId: noop,
  };
}

export function assertMediaProviderContract(provider, providerName = "media") {
  const missingState = MEDIA_PROVIDER_STATE_FIELDS.filter((field) => !(field in provider));
  const missingV2State = MEDIA_PROVIDER_V2_STATE_FIELDS.filter((field) => !(field in provider));
  const missingMethods = MEDIA_PROVIDER_METHODS.filter((method) => typeof provider[method] !== "function");

  if (missingState.length || missingV2State.length || missingMethods.length) {
    throw new Error(
      `[huddle:${providerName}] invalid media provider contract: missing state [${missingState.join(", ")}], v2 state [${missingV2State.join(", ")}], methods [${missingMethods.join(", ")}]`
    );
  }

  return provider;
}
