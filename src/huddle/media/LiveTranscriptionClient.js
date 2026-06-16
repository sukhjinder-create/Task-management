import api from "../../api";

const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_TIMESLICE_MS = 250;
const KEEP_ALIVE_INTERVAL_MS = 8000;
const MAX_RECONNECT_DELAY_MS = 15000;
const PROVIDER_EVENT_POST_RETRIES = 3;
const NO_PROVIDER_RESULTS_TIMEOUT_MS = 12000;
const NO_PROVIDER_RESULTS_MIN_CHUNKS = 12;
const NO_PROVIDER_RESULTS_MAX_RECONNECTS = 2;

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function elapsedMs(startedAt, endedAt = nowMs()) {
  const start = Number(startedAt);
  const end = Number(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round(end - start));
}

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
  let streamAttemptStartedAtMs = nowMs();
  let reconnectTimer = null;
  let keepAliveTimer = null;
  let noProviderResultsTimer = null;
  let reconnectAttempts = 0;
  let noProviderResultsReconnects = 0;
  let connectionGeneration = 0;
  let pendingPartialEvent = null;
  const pendingFinalEvents = [];
  let eventPumpRunning = false;

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
    reconnectAttempts: 0,
    noProviderResultsReconnects: 0,
    coalescedPartialEvents: 0,
    pendingFinalEvents: 0,
    eventPumpRunning: false,
    timings: {
      grantLatencyMs: null,
      websocketOpenLatencyMs: null,
      recorderStartLatencyMs: null,
      firstProviderResultLatencyMs: null,
      firstBackendEventLatencyMs: null,
      firstLocalCaptionLatencyMs: null,
    },
    lastProviderMessageAt: null,
    lastBackendEventAt: null,
    lastError: null,
  };

  function emitDiagnostics(patch = {}) {
    Object.assign(diagnostics, patch, { observedAt: new Date().toISOString() });
    onDiagnostics({ ...diagnostics });
  }

  function allocateSourceSegmentId(payload = {}) {
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

  async function postWithRetry(body) {
    let lastError = null;
    for (let attempt = 1; attempt <= PROVIDER_EVENT_POST_RETRIES; attempt += 1) {
      try {
        return await api.post(`/huddle/transcription/sessions/${sessionId}/events`, body);
      } catch (error) {
        lastError = error;
        if (attempt < PROVIDER_EVENT_POST_RETRIES) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, attempt * 300);
          });
        }
      }
    }
    throw lastError;
  }

  async function postProviderEvent({
    payload = {},
    clientProviderReceivedAt = null,
    text,
    status,
    sourceSegmentId,
    eventSequence,
  } = {}) {
    const providerEventId = [
      sourceSegmentId,
      eventSequence,
      status,
    ].join(":");
    const timing = segmentTiming(payload, streamStartedAtMs);
    const clientPostedAt = new Date().toISOString();

    await postWithRetry({
      transcriptionSessionId: transcriptionSession?.id,
      participantId: effectiveParticipantId,
      participantDeviceId: effectiveParticipantDeviceId,
      provider: "deepgram",
      providerEventId,
      providerRequestId: safeString(payload?.metadata?.request_id, 200) || null,
      sourceSegmentId,
      sequenceNumber: eventSequence,
      status,
      text,
      confidence: deepgramConfidence(payload),
      language: payload?.channel?.detected_language || language,
      startedAt: timing.startedAt,
      endedAt: timing.endedAt,
      clientCapturedAt: timing.endedAt,
      clientProviderReceivedAt,
      clientPostedAt,
      providerPayload: payload,
    });

    diagnostics.backendEvents += 1;
    diagnostics.lastBackendEventAt = new Date().toISOString();
    if (!diagnostics.timings.firstBackendEventLatencyMs) {
      diagnostics.timings.firstBackendEventLatencyMs = elapsedMs(streamAttemptStartedAtMs);
    }
    emitDiagnostics({ status: "streaming", lastError: null });
  }

  async function pumpProviderEvents() {
    if (eventPumpRunning || stopped) return;
    eventPumpRunning = true;
    emitDiagnostics({
      eventPumpRunning: true,
      pendingFinalEvents: pendingFinalEvents.length,
    });
    try {
      while (!stopped) {
        const event = pendingFinalEvents.shift() || pendingPartialEvent;
        if (!event) break;
        if (event === pendingPartialEvent) pendingPartialEvent = null;
        try {
          await postProviderEvent(event);
        } catch (error) {
          emitDiagnostics({
            status: "degraded",
            lastError:
              safeString(error?.response?.data?.reason || error?.message) ||
              "provider_event_post_failed",
          });
        }
        emitDiagnostics({
          pendingFinalEvents: pendingFinalEvents.length,
        });
      }
    } finally {
      eventPumpRunning = false;
      emitDiagnostics({
        eventPumpRunning: false,
        pendingFinalEvents: pendingFinalEvents.length,
      });
      if (!stopped && (pendingFinalEvents.length > 0 || pendingPartialEvent)) {
        void pumpProviderEvents();
      }
    }
  }

  function enqueueProviderEvent(payload = {}, clientProviderReceivedAt = null) {
    const text = deepgramTranscript(payload);
    if (!text) return;
    const status =
      payload?.is_final === true || payload?.speech_final === true
        ? "final"
        : "partial";
    const sourceSegmentId = allocateSourceSegmentId(payload);
    const eventSequence = sequenceNumber;
    sequenceNumber += 1;
    const event = {
      payload,
      clientProviderReceivedAt,
      text,
      status,
      sourceSegmentId,
      eventSequence,
    };

    // Local captions stay immediate while persistence is handled by the
    // bounded event pump. The canonical server event replaces this row.
    const observedAt = clientProviderReceivedAt || new Date().toISOString();
    if (!diagnostics.timings.firstLocalCaptionLatencyMs) {
      diagnostics.timings.firstLocalCaptionLatencyMs = elapsedMs(streamAttemptStartedAtMs);
    }
    onCaption({
      id: `local:${sourceSegmentId}`,
      source: "deepgram",
      sourceSegmentId,
      metadata: { sourceSegmentId },
      speakerId: effectiveParticipantId || participantId || "local",
      text,
      status,
      isFinal: status === "final",
      sequenceNumber: eventSequence,
      emittedAt: observedAt,
      at: observedAt,
    });

    if (status === "final") {
      if (pendingPartialEvent?.sourceSegmentId === sourceSegmentId) {
        pendingPartialEvent = null;
      }
      pendingFinalEvents.push(event);
    } else {
      if (pendingPartialEvent) diagnostics.coalescedPartialEvents += 1;
      pendingPartialEvent = event;
    }
    diagnostics.pendingFinalEvents = pendingFinalEvents.length;
    void pumpProviderEvents();
  }

  function clearTimer(timer) {
    if (timer) window.clearTimeout(timer);
  }

  function clearNoProviderResultsTimer() {
    clearTimer(noProviderResultsTimer);
    noProviderResultsTimer = null;
  }

  function scheduleNoProviderResultsWatchdog() {
    if (stopped || noProviderResultsTimer) return;
    if (diagnostics.providerMessages > 0) return;
    if (diagnostics.chunksSent < NO_PROVIDER_RESULTS_MIN_CHUNKS) return;
    if (noProviderResultsReconnects >= NO_PROVIDER_RESULTS_MAX_RECONNECTS) return;

    noProviderResultsTimer = window.setTimeout(() => {
      noProviderResultsTimer = null;
      if (
        stopped ||
        diagnostics.providerMessages > 0 ||
        diagnostics.chunksSent < NO_PROVIDER_RESULTS_MIN_CHUNKS ||
        noProviderResultsReconnects >= NO_PROVIDER_RESULTS_MAX_RECONNECTS
      ) {
        return;
      }
      noProviderResultsReconnects += 1;
      diagnostics.noProviderResultsReconnects = noProviderResultsReconnects;
      scheduleReconnect("transcription_provider_no_results");
    }, NO_PROVIDER_RESULTS_TIMEOUT_MS);
  }

  function cleanupTransport({ closeSocket = true } = {}) {
    clearTimer(keepAliveTimer);
    clearNoProviderResultsTimer();
    keepAliveTimer = null;
    try {
      if (mediaRecorder?.state && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    } catch {
      // Best effort cleanup.
    }
    mediaRecorder = null;
    if (closeSocket) {
      try {
        websocket?.close?.();
      } catch {
        // Best effort cleanup.
      }
    }
    websocket = null;
    mediaStream = null;
  }

  function scheduleReconnect(reason) {
    if (stopped || reconnectTimer) return;
    cleanupTransport({ closeSocket: false });
    reconnectAttempts += 1;
    diagnostics.reconnectAttempts = reconnectAttempts;
    const delay = Math.min(
      1000 * (2 ** Math.min(reconnectAttempts - 1, 4)),
      MAX_RECONNECT_DELAY_MS
    );
    emitDiagnostics({
      status: "reconnecting",
      websocketOpen: false,
      recorderStarted: false,
      lastError: reason,
      reconnectDelayMs: delay,
    });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      void connectStream();
    }, delay);
  }

  async function connectStream() {
    if (stopped) return { ok: false, reason: "transcription_stopped" };
    const generation = ++connectionGeneration;
    const streamAttemptStartedAt = nowMs();
    streamAttemptStartedAtMs = streamAttemptStartedAt;
    cleanupTransport();
    activeSourceSegmentId = null;

    emitDiagnostics({
      status: reconnectAttempts > 0 ? "reconnecting" : "granting",
      websocketOpen: false,
      recorderStarted: false,
    });
    try {
      const grantStartedAt = nowMs();
      const grantResponse = await api.post(`/huddle/transcription/sessions/${sessionId}/grant`, {
        participantId,
        language,
        provider: "deepgram",
      });
      diagnostics.timings.grantLatencyMs = elapsedMs(grantStartedAt);
      if (stopped || generation !== connectionGeneration) {
        return { ok: false, reason: "transcription_connection_superseded" };
      }
      const grant = grantResponse.data || {};
      transcriptionSession = grant.transcriptionSession;
      effectiveParticipantId =
        effectiveParticipantId || transcriptionSession?.participantId || null;
      effectiveParticipantDeviceId =
        transcriptionSession?.participantDeviceId || null;
      emitDiagnostics({
        status: "connecting",
        grantOk: true,
        provider: grant.provider,
        model: grant.model,
        language: grant.language || language,
        timings: { ...diagnostics.timings },
      });

      mediaStream = new MediaStream([audioTrack]);
      websocket = grant.accessToken
        ? new WebSocket(grant.listenUrl, ["bearer", grant.accessToken])
        : new WebSocket(grant.listenUrl);
      websocket.binaryType = "arraybuffer";

      websocket.onopen = () => {
        if (stopped || generation !== connectionGeneration) return;
        streamStartedAtMs = Date.now();
        diagnostics.timings.websocketOpenLatencyMs = elapsedMs(streamAttemptStartedAt);
        reconnectAttempts = 0;
        diagnostics.reconnectAttempts = 0;
        emitDiagnostics({
          status: "streaming",
          websocketOpen: true,
          lastError: null,
          timings: { ...diagnostics.timings },
        });
        const mimeType = preferredMimeType();
        mediaRecorder = new MediaRecorder(
          mediaStream,
          mimeType ? { mimeType } : undefined
        );
        mediaRecorder.ondataavailable = (event) => {
          if (stopped || !event.data || event.data.size <= 0) return;
          if (websocket?.readyState !== WebSocket.OPEN) return;
          websocket.send(event.data);
          diagnostics.chunksSent += 1;
          scheduleNoProviderResultsWatchdog();
        };
        mediaRecorder.onerror = (event) => {
          scheduleReconnect(
            safeString(event?.error?.message || event?.message) ||
            "media_recorder_error"
          );
        };
        mediaRecorder.start(DEFAULT_TIMESLICE_MS);
        diagnostics.timings.recorderStartLatencyMs = elapsedMs(streamAttemptStartedAt);
        keepAliveTimer = window.setInterval(() => {
          if (websocket?.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, KEEP_ALIVE_INTERVAL_MS);
        emitDiagnostics({ recorderStarted: true, timings: { ...diagnostics.timings } });
      };

      websocket.onmessage = (event) => {
        const payload = typeof event.data === "string" ? jsonParse(event.data) : null;
        if (!payload || payload.type !== "Results") return;
        const clientProviderReceivedAt = new Date().toISOString();
        clearNoProviderResultsTimer();
        diagnostics.providerMessages += 1;
        diagnostics.lastProviderMessageAt = clientProviderReceivedAt;
        if (!diagnostics.timings.firstProviderResultLatencyMs) {
          diagnostics.timings.firstProviderResultLatencyMs = elapsedMs(streamAttemptStartedAt);
        }
        enqueueProviderEvent(payload, clientProviderReceivedAt);
        emitDiagnostics({ timings: { ...diagnostics.timings } });
      };

      websocket.onerror = () => {
        emitDiagnostics({
          status: "reconnecting",
          lastError: "transcription_websocket_error",
        });
      };

      websocket.onclose = () => {
        if (!stopped && generation === connectionGeneration) {
          scheduleReconnect("transcription_websocket_closed");
        }
      };
      return { ok: true, diagnostics: { ...diagnostics } };
    } catch (error) {
      if (!stopped && generation === connectionGeneration) {
        scheduleReconnect(
          safeString(error?.response?.data?.reason || error?.message) ||
          "transcription_connect_failed"
        );
      }
      return {
        ok: false,
        reason:
          safeString(error?.response?.data?.reason || error?.message) ||
          "transcription_connect_failed",
      };
    }
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
    return connectStream();
  }

  function stop() {
    const finalEventsToFlush = pendingFinalEvents.splice(0);
    if (finalEventsToFlush.length > 0) {
      void Promise.allSettled(
        finalEventsToFlush.map((event) => postProviderEvent(event))
      );
    }
    pendingPartialEvent = null;
    stopped = true;
    connectionGeneration += 1;
    clearTimer(reconnectTimer);
    clearNoProviderResultsTimer();
    reconnectTimer = null;
    try {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: "CloseStream" }));
      }
    } catch {
      // Best effort cleanup.
    }
    cleanupTransport();
    emitDiagnostics({ status: "stopped", websocketOpen: false, recorderStarted: false });
  }

  return {
    start,
    stop,
    diagnostics: () => ({ ...diagnostics }),
  };
}
