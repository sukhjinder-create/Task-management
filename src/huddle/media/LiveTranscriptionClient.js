import api from "../../api";

const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_TIMESLICE_MS = 500;

function safeString(value, maxLength = null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return maxLength ? normalized.slice(0, maxLength) : normalized;
}

function jsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function preferredMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

function deepgramTranscript(payload = {}) {
  return safeString(payload?.channel?.alternatives?.[0]?.transcript, 4000);
}

function deepgramConfidence(payload = {}) {
  const confidence = Number(payload?.channel?.alternatives?.[0]?.confidence);
  return Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : null;
}

function segmentTiming(payload = {}, streamStartedAtMs = Date.now()) {
  const startedAt = Number.isFinite(Number(payload.start))
    ? new Date(streamStartedAtMs + Number(payload.start) * 1000).toISOString()
    : null;
  const duration = Number(payload.duration);
  const endedAt = startedAt && Number.isFinite(duration)
    ? new Date(new Date(startedAt).getTime() + duration * 1000).toISOString()
    : null;
  return { startedAt, endedAt };
}

export function liveTranscriptionSupported() {
  return (
    typeof window !== "undefined" &&
    typeof WebSocket !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof MediaStream !== "undefined"
  );
}

export function createLiveTranscriptionClient({
  sessionId,
  participantId = null,
  audioTrack,
  language = DEFAULT_LANGUAGE,
  onCaption = () => {},
  onDiagnostics = () => {},
} = {}) {
  let websocket = null;
  let mediaRecorder = null;
  let mediaStream = null;
  let transcriptionSession = null;
  let effectiveParticipantId = participantId;
  let effectiveParticipantDeviceId = null;
  let sequenceNumber = 0;
  let utteranceIndex = 0;
  let activeSourceSegmentId = null;
  let stopped = false;
  let streamStartedAtMs = Date.now();

  const diagnostics = {
    supported: liveTranscriptionSupported(),
    status: "idle",
    provider: null,
    model: null,
    language,
    grantOk: false,
    websocketOpen: false,
    recorderStarted: false,
    chunksSent: 0,
    providerMessages: 0,
    backendEvents: 0,
    lastError: null,
  };

  function emitDiagnostics(patch = {}) {
    Object.assign(diagnostics, patch, { observedAt: new Date().toISOString() });
    onDiagnostics({ ...diagnostics });
  }

  function nextSourceSegmentId(payload = {}) {
    if (!activeSourceSegmentId) {
      activeSourceSegmentId = [
        "deepgram",
        transcriptionSession?.id || sessionId || "session",
        "utterance",
        utteranceIndex,
      ].join(":");
    }
    if (payload?.is_final === true || payload?.speech_final === true) {
      const finalized = activeSourceSegmentId;
      utteranceIndex += 1;
      activeSourceSegmentId = null;
      return finalized;
    }
    return activeSourceSegmentId;
  }

  async function postProviderEvent(payload = {}) {
    const text = deepgramTranscript(payload);
    if (!text) return;

    const status = payload?.is_final === true || payload?.speech_final === true ? "final" : "partial";
    const sourceSegmentId = nextSourceSegmentId(payload);
    const providerEventId = [
      sourceSegmentId,
      sequenceNumber,
      status,
    ].join(":");
    const timing = segmentTiming(payload, streamStartedAtMs);

    await api.post(`/huddle/transcription/sessions/${sessionId}/events`, {
      transcriptionSessionId: transcriptionSession?.id,
      participantId: effectiveParticipantId,
      participantDeviceId: effectiveParticipantDeviceId,
      provider: "deepgram",
      providerEventId,
      providerRequestId: safeString(payload?.metadata?.request_id, 200) || null,
      sourceSegmentId,
      sequenceNumber,
      status,
      text,
      confidence: deepgramConfidence(payload),
      language: payload?.channel?.detected_language || language,
      startedAt: timing.startedAt,
      endedAt: timing.endedAt,
      providerPayload: payload,
    });

    diagnostics.backendEvents += 1;
    onCaption({
      source: "deepgram",
      speakerId: participantId || "local",
      text,
      isFinal: status === "final",
      sequenceNumber,
      at: new Date().toISOString(),
    });
    sequenceNumber += 1;
    emitDiagnostics({ status: "streaming" });
  }

  async function start() {
    if (!sessionId) {
      throw new Error("transcription_session_required");
    }
    if (!audioTrack) {
      throw new Error("transcription_audio_track_required");
    }
    if (!liveTranscriptionSupported()) {
      throw new Error("transcription_not_supported");
    }

    emitDiagnostics({ status: "granting" });
    const grantResponse = await api.post(`/huddle/transcription/sessions/${sessionId}/grant`, {
      participantId,
      language,
      provider: "deepgram",
    });
    const grant = grantResponse.data || {};
    transcriptionSession = grant.transcriptionSession;
    effectiveParticipantId = effectiveParticipantId || transcriptionSession?.participantId || null;
    effectiveParticipantDeviceId = transcriptionSession?.participantDeviceId || null;
    emitDiagnostics({
      status: "connecting",
      grantOk: true,
      provider: grant.provider,
      model: grant.model,
      language: grant.language || language,
    });

    mediaStream = new MediaStream([audioTrack]);
    websocket = grant.accessToken
      ? new WebSocket(grant.listenUrl, ["bearer", grant.accessToken])
      : new WebSocket(grant.listenUrl);
    websocket.binaryType = "arraybuffer";

    websocket.onopen = () => {
      if (stopped) return;
      streamStartedAtMs = Date.now();
      emitDiagnostics({ status: "streaming", websocketOpen: true });
      const mimeType = preferredMimeType();
      mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (event) => {
        if (stopped || !event.data || event.data.size <= 0) return;
        if (websocket?.readyState !== WebSocket.OPEN) return;
        websocket.send(event.data);
        diagnostics.chunksSent += 1;
        emitDiagnostics({ status: "streaming" });
      };
      mediaRecorder.onerror = (event) => {
        emitDiagnostics({
          status: "failed",
          lastError: safeString(event?.error?.message || event?.message) || "media_recorder_error",
        });
      };
      mediaRecorder.start(DEFAULT_TIMESLICE_MS);
      emitDiagnostics({ recorderStarted: true });
    };

    websocket.onmessage = async (event) => {
      const payload = typeof event.data === "string" ? jsonParse(event.data) : null;
      if (!payload || payload.type !== "Results") return;
      diagnostics.providerMessages += 1;
      try {
        await postProviderEvent(payload);
      } catch (error) {
        emitDiagnostics({
          status: "failed",
          lastError: safeString(error?.response?.data?.reason || error?.message) || "provider_event_post_failed",
        });
      }
    };

    websocket.onerror = () => {
      emitDiagnostics({ status: "failed", lastError: "transcription_websocket_error" });
    };

    websocket.onclose = () => {
      if (!stopped) emitDiagnostics({ status: "closed", websocketOpen: false });
    };

    return { ok: true, diagnostics: { ...diagnostics } };
  }

  function stop() {
    stopped = true;
    try {
      if (mediaRecorder?.state && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    } catch {
      // Best effort cleanup.
    }
    try {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: "CloseStream" }));
      }
      websocket?.close?.();
    } catch {
      // Best effort cleanup.
    }
    mediaRecorder = null;
    websocket = null;
    mediaStream = null;
    emitDiagnostics({ status: "stopped", websocketOpen: false, recorderStarted: false });
  }

  return {
    start,
    stop,
    diagnostics: () => ({ ...diagnostics }),
  };
}
