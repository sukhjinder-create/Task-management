// src/huddle/media/MeshMediaProvider.js
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSocket } from "../../socket";
import { buildMeshMediaStateV2 } from "./mediaState";
import {
  createProviderMetricsSnapshot,
  elapsedMs,
  metricNow,
} from "./providerDiagnostics";

const API_URL = import.meta.env.VITE_API_URL || "";
const PEER_RECONNECT_GRACE_MS = 20000;

function browserSupportsScreenShare() {
  return typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getDisplayMedia);
}

function browserSupportsSpeechRecognition() {
  return typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Fetch ICE servers (STUN + TURN) from backend once at module load.
// This avoids rebuilding the APK when TURN credentials change.
let cachedRtcConfig = null;
let iceFetchPromise = null;

function fetchIceConfig() {
  if (cachedRtcConfig) return Promise.resolve(cachedRtcConfig);
  if (iceFetchPromise) return iceFetchPromise;
  if (!API_URL) return Promise.resolve(buildFallbackRtcConfig());

  iceFetchPromise = fetch(`${API_URL}/ice-servers`, { cache: "no-store" })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.iceServers?.length) {
        cachedRtcConfig = { iceServers: data.iceServers };
      } else {
        cachedRtcConfig = buildFallbackRtcConfig();
      }
      iceFetchPromise = null;
      return cachedRtcConfig;
    })
    .catch(() => {
      iceFetchPromise = null;
      cachedRtcConfig = buildFallbackRtcConfig();
      return cachedRtcConfig;
    });

  return iceFetchPromise;
}

function buildFallbackRtcConfig() {
  const u = import.meta.env?.VITE_TURN_USERNAME || "";
  const c = import.meta.env?.VITE_TURN_CREDENTIAL || "";
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turn:openrelay.metered.ca:80?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
  if (u && c) {
    iceServers.push(
      { urls: "turn:global.relay.metered.ca:80",                  username: u, credential: c },
      { urls: "turn:global.relay.metered.ca:80?transport=tcp",    username: u, credential: c },
      { urls: "turn:global.relay.metered.ca:443",                 username: u, credential: c },
      { urls: "turns:global.relay.metered.ca:443?transport=tcp",  username: u, credential: c },
    );
  }
  return { iceServers };
}

function classifyIceTransport({ protocol, relayProtocol, url } = {}) {
  const value = String(relayProtocol || protocol || "").toLowerCase();
  const sourceUrl = String(url || "").toLowerCase();

  if (value === "tls" || sourceUrl.startsWith("turns:") || sourceUrl.includes("transport=tls")) return "tls";
  if (value === "tcp" || sourceUrl.includes("transport=tcp")) return "tcp";
  if (value === "udp" || sourceUrl.includes("transport=udp")) return "udp";
  return value || "unknown";
}

function parseIceCandidateDiagnostic(candidate) {
  const raw = String(candidate?.candidate || "");
  const parts = raw.split(/\s+/);
  const typIndex = parts.indexOf("typ");
  const tcpTypeIndex = parts.indexOf("tcptype");
  const protocol = String(parts[2] || "").toLowerCase();
  const candidateType = typIndex >= 0 ? parts[typIndex + 1] || "unknown" : "unknown";

  return {
    candidateType,
    transport: classifyIceTransport({ protocol }),
    protocol: protocol || "unknown",
    tcpType: tcpTypeIndex >= 0 ? parts[tcpTypeIndex + 1] || null : null,
  };
}

function normalizeStatsCandidate(candidate) {
  if (!candidate) return null;

  return {
    id: candidate.id,
    candidateType: candidate.candidateType || "unknown",
    transport: classifyIceTransport(candidate),
    protocol: candidate.protocol || "unknown",
    relayProtocol: candidate.relayProtocol || null,
    networkType: candidate.networkType || null,
  };
}

function getSelectedCandidatePairDiagnostic(stats) {
  const reports = Array.from(stats.values());
  const transport = reports.find((report) => report.type === "transport" && report.selectedCandidatePairId);
  const pair = (
    (transport && stats.get(transport.selectedCandidatePairId)) ||
    reports.find((report) => report.type === "candidate-pair" && report.selected) ||
    reports.find((report) => report.type === "candidate-pair" && report.state === "succeeded")
  );

  if (!pair) return null;

  return {
    pairId: pair.id,
    state: pair.state || "unknown",
    selected: Boolean(pair.selected || transport?.selectedCandidatePairId === pair.id),
    nominated: Boolean(pair.nominated),
    rttMs: typeof pair.currentRoundTripTime === "number" ? Math.round(pair.currentRoundTripTime * 1000) : null,
    localCandidate: normalizeStatsCandidate(stats.get(pair.localCandidateId)),
    remoteCandidate: normalizeStatsCandidate(stats.get(pair.remoteCandidateId)),
  };
}

function selectedPairLogKey(diagnostic) {
  if (!diagnostic) return "";

  return JSON.stringify({
    pairId: diagnostic.pairId,
    state: diagnostic.state,
    localType: diagnostic.localCandidate?.candidateType,
    localTransport: diagnostic.localCandidate?.transport,
    remoteType: diagnostic.remoteCandidate?.candidateType,
    remoteTransport: diagnostic.remoteCandidate?.transport,
  });
}

function createInitialMeshMetrics() {
  return {
    joinStartedAt: null,
    joinLatencyMs: null,
    roomStartedAt: null,
    roomEndedAt: null,
    failures: [],
  };
}

function flattenIceTransitions(iceDiagnostics = {}) {
  return Object.values(iceDiagnostics.peers || {}).flatMap((peer) =>
    (peer.stateTransitions || []).map((transition) => ({
      ...transition,
      peerId: peer.peerId,
    }))
  );
}

function flattenIceFailures(iceDiagnostics = {}) {
  return Object.values(iceDiagnostics.peers || {}).flatMap((peer) =>
    (peer.failures || []).map((failure) => ({
      ...failure,
      type: "ice_failure",
      reason: failure.iceConnectionState || "ice_failure",
      peerId: peer.peerId,
    }))
  );
}

function countStreamTracks(stream) {
  return stream?.getTracks?.().length || 0;
}

function createIceCandidateFromSignal(data = {}) {
  const raw = data?.candidate;
  if (!raw) return null;

  if (typeof raw === "string") {
    return new RTCIceCandidate({
      candidate: raw,
      sdpMid: data.sdpMid ?? data.id ?? null,
      sdpMLineIndex: data.sdpMLineIndex ?? data.label ?? null,
    });
  }

  return new RTCIceCandidate(raw);
}

// Prefetch on module load so it's ready before the first call
fetchIceConfig();

export function useMeshMediaProvider({ currentUser }) {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState("good");
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitles, setSubtitles] = useState({});
  const [error, setError] = useState("");

  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const inboundStreamsRef = useRef({}); // Android WebView: accumulate tracks when event.streams is empty
  const localStreamRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const blackTrackRef = useRef(null);
  const iceCandidateQueueRef = useRef({});
  const peerDisconnectTimersRef = useRef({});
  const recognitionRef = useRef(null);
  const subtitlesEnabledRef = useRef(false);
  const iceDiagnosticsRef = useRef({ peers: {} });
  const selectedPairLogKeyRef = useRef({});

  const channelIdRef = useRef(null);
  const huddleIdRef = useRef(null);
  const userRef = useRef(currentUser);
  const inCallRef = useRef(false);
  const startingRef = useRef(false);
  const remotePeersRef = useRef([]);
  const initLocalMediaPromiseRef = useRef(null);
  const providerMetricsRef = useRef(createInitialMeshMetrics());

  useEffect(() => { userRef.current = currentUser; }, [currentUser]);
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);
  useEffect(() => { remotePeersRef.current = remotePeers; }, [remotePeers]);

  const mediaStateV2 = useMemo(() => buildMeshMediaStateV2({
    currentUser,
    inCall,
    connecting,
    localStream,
    remotePeers,
    micEnabled,
    camEnabled,
    screenSharing,
    metadata: {
      peerConnectionCount: Object.keys(peerConnectionsRef.current).length,
      icePeerCount: Object.keys(iceDiagnosticsRef.current.peers || {}).length,
      providerMetrics: createProviderMetricsSnapshot({
        provider: "mesh",
        connectionState: connecting ? "connecting" : inCall ? "joined" : "idle",
        participantCount: (inCall || connecting || localStream ? 1 : 0) + remotePeers.length,
        deviceCount: (inCall || connecting || localStream ? 1 : 0) + remotePeers.length,
        trackCount:
          countStreamTracks(localStream) +
          remotePeers.reduce((total, peer) => total + countStreamTracks(peer.stream), 0),
        timings: {
          joinMs: providerMetricsRef.current.joinLatencyMs,
          roomDurationMs: providerMetricsRef.current.roomStartedAt
            ? elapsedMs(
                providerMetricsRef.current.roomStartedAt,
                providerMetricsRef.current.roomEndedAt || metricNow()
              )
            : null,
        },
        transitions: flattenIceTransitions(iceDiagnosticsRef.current),
        failures: [
          ...providerMetricsRef.current.failures,
          ...flattenIceFailures(iceDiagnosticsRef.current),
        ],
        metadata: {
          peerConnectionCount: Object.keys(peerConnectionsRef.current).length,
          icePeerCount: Object.keys(iceDiagnosticsRef.current.peers || {}).length,
        },
      }),
    },
  }), [currentUser, inCall, connecting, localStream, remotePeers, micEnabled, camEnabled, screenSharing]);

  const setChannelId = useCallback((id) => { channelIdRef.current = id; }, []);
  const setHuddleId = useCallback((id) => { huddleIdRef.current = id; }, []);

  const getSocketSafe = () => {
    const socket = getSocket();
    if (!socket) console.warn("[huddle] Socket not initialized");
    return socket;
  };

  const getPeerIceDiagnostics = useCallback((peerId) => {
    const uid = String(peerId);
    if (!iceDiagnosticsRef.current.peers[uid]) {
      iceDiagnosticsRef.current.peers[uid] = {
        peerId: uid,
        localCandidates: [],
        stateTransitions: [],
        failures: [],
        selectedCandidatePair: null,
      };
    }

    return iceDiagnosticsRef.current.peers[uid];
  }, []);

  const recordIceCandidateDiagnostic = useCallback((peerId, candidate) => {
    const diagnostics = getPeerIceDiagnostics(peerId);
    const entry = {
      ...parseIceCandidateDiagnostic(candidate),
      observedAt: new Date().toISOString(),
    };

    diagnostics.localCandidates = [...diagnostics.localCandidates.slice(-19), entry];
    console.debug("[huddle:ice:candidate]", { peerId: String(peerId), ...entry });
  }, [getPeerIceDiagnostics]);

  const recordIceStateTransition = useCallback((peerId, state) => {
    const diagnostics = getPeerIceDiagnostics(peerId);
    const previous = diagnostics.stateTransitions[diagnostics.stateTransitions.length - 1];
    if (previous?.state === state) return;

    const entry = {
      state,
      observedAt: new Date().toISOString(),
    };

    diagnostics.stateTransitions = [...diagnostics.stateTransitions.slice(-19), entry];
    console.debug("[huddle:ice:state]", { peerId: String(peerId), ...entry });
  }, [getPeerIceDiagnostics]);

  const recordIceFailure = useCallback((peerId, detail) => {
    const diagnostics = getPeerIceDiagnostics(peerId);
    const entry = {
      ...detail,
      observedAt: new Date().toISOString(),
    };

    diagnostics.failures = [...diagnostics.failures.slice(-19), entry];
    console.warn("[huddle:ice:failure]", { peerId: String(peerId), ...entry });
  }, [getPeerIceDiagnostics]);

  const recordSelectedCandidatePair = useCallback((peerId, diagnostic) => {
    if (!diagnostic) return;

    const uid = String(peerId);
    const diagnostics = getPeerIceDiagnostics(uid);
    diagnostics.selectedCandidatePair = {
      ...diagnostic,
      observedAt: new Date().toISOString(),
    };

    const key = selectedPairLogKey(diagnostic);
    if (selectedPairLogKeyRef.current[uid] === key) return;

    selectedPairLogKeyRef.current[uid] = key;
    console.debug("[huddle:ice:selected-pair]", {
      peerId: uid,
      ...diagnostics.selectedCandidatePair,
    });
  }, [getPeerIceDiagnostics]);

  // ── Remote peer helpers ─────────────────────────────────────────────────────
  const updateRemotePeerStream = useCallback((userId, stream) => {
    const uid = String(userId);
    if (stream) remoteStreamsRef.current[uid] = stream;
    else delete remoteStreamsRef.current[uid];
    setRemotePeers((prev) => {
      const existing = prev.find((p) => String(p.userId) === uid);
      if (existing) return prev.map((p) => String(p.userId) === uid ? { ...p, stream, connectionState: stream ? "connected" : "reconnecting" } : p);
      return [...prev, { userId, username: "", stream, isMuted: false, isCameraOff: false, isScreenSharing: false, connectionState: stream ? "connected" : "reconnecting" }];
    });
  }, []);

  const updateRemotePeerMeta = useCallback((userId, meta) => {
    const uid = String(userId);
    setRemotePeers((prev) => prev.map((p) => String(p.userId) === uid ? { ...p, ...meta } : p));
  }, []);

  const markRemotePeerReconnecting = useCallback((userId) => {
    const uid = String(userId);
    delete remoteStreamsRef.current[uid];
    delete inboundStreamsRef.current[uid];
    setRemotePeers((prev) => prev.map((p) => String(p.userId) === uid ? { ...p, stream: null, connectionState: "reconnecting" } : p));
  }, []);

  const removeRemotePeer = useCallback((userId) => {
    const uid = String(userId);
    clearTimeout(peerDisconnectTimersRef.current[uid]);
    delete peerDisconnectTimersRef.current[uid];
    setRemotePeers((prev) => prev.filter((p) => String(p.userId) !== uid));
    const pc = peerConnectionsRef.current[uid];
    if (pc) { pc.close(); delete peerConnectionsRef.current[uid]; }
    delete remoteStreamsRef.current[uid];
    delete iceCandidateQueueRef.current[uid];
    delete inboundStreamsRef.current[uid];
    delete iceDiagnosticsRef.current.peers[uid];
    delete selectedPairLogKeyRef.current[uid];
  }, []);

  // ── Create RTCPeerConnection ────────────────────────────────────────────────
  const createPeerConnection = useCallback((remoteUserId) => {
    const uid = String(remoteUserId);
    const socket = getSocketSafe();
    if (!socket) return null;

    const existing = peerConnectionsRef.current[uid];
    const reusableExisting =
      existing &&
      !["failed", "closed", "disconnected"].includes(existing.connectionState) &&
      !["failed", "closed", "disconnected"].includes(existing.iceConnectionState);
    if (reusableExisting) {
      return existing;
    }
    // Clean up a dead connection before creating a new one
    if (existing) {
      existing.close();
      delete peerConnectionsRef.current[uid];
      delete iceCandidateQueueRef.current[uid];
      markRemotePeerReconnecting(uid);
    }

    const rtcConfig = cachedRtcConfig || buildFallbackRtcConfig();
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        recordIceCandidateDiagnostic(uid, event.candidate);
        socket.emit("huddle:signal", {
          channelId: channelIdRef.current,
          targetUserId: uid,
          huddleId: huddleIdRef.current,
          data: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      let stream = event.streams?.[0];
      if (!stream && event.track) {
        // Android WebView sends empty event.streams — accumulate tracks manually
        if (!inboundStreamsRef.current[uid]) {
          inboundStreamsRef.current[uid] = new MediaStream();
        }
        inboundStreamsRef.current[uid].addTrack(event.track);
        stream = inboundStreamsRef.current[uid];
      }
      if (event.track) {
        event.track.onended = () => markRemotePeerReconnecting(uid);
      }
      if (stream) updateRemotePeerStream(uid, stream);
    };

    // ICE connection state monitoring — detect failure and auto-restart
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[huddle] ICE ${uid}: ${state}`);
      recordIceStateTransition(uid, state);

      if (state === "failed") {
        recordIceFailure(uid, {
          iceConnectionState: state,
          connectionState: pc.connectionState,
          signalingState: pc.signalingState,
        });
        // The lower userId is "impolite" — only they restart to avoid collision
        const myId = String(userRef.current?.id || "");
        if (myId <= uid && pc.signalingState === "stable") {
          console.warn(`[huddle] Restarting ICE for ${uid}`);
          pc.restartIce?.();
          pc.createOffer({ iceRestart: true })
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
              const s = getSocketSafe();
              if (s && channelIdRef.current) {
                s.emit("huddle:signal", {
                  channelId: channelIdRef.current,
                  targetUserId: uid,
                  huddleId: huddleIdRef.current,
                  data: { type: "offer", sdp: pc.localDescription.sdp, fromUsername: userRef.current?.username || "" },
                });
              }
            })
            .catch(e => console.error("[huddle] ICE restart failed:", e));
        }
      }

      if (state === "disconnected") {
        markRemotePeerReconnecting(uid);
        clearTimeout(peerDisconnectTimersRef.current[uid]);
        peerDisconnectTimersRef.current[uid] = setTimeout(() => {
          if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
            removeRemotePeer(uid);
          }
        }, PEER_RECONNECT_GRACE_MS);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[huddle] Connection ${uid}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        clearTimeout(peerDisconnectTimersRef.current[uid]);
        delete peerDisconnectTimersRef.current[uid];
        updateRemotePeerMeta(uid, { connectionState: "connected" });
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        markRemotePeerReconnecting(uid);
      }
    };

    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((track) => pc.addTrack(track, local));

    peerConnectionsRef.current[uid] = pc;
    return pc;
  }, [
    updateRemotePeerStream,
    updateRemotePeerMeta,
    removeRemotePeer,
    markRemotePeerReconnecting,
    recordIceCandidateDiagnostic,
    recordIceFailure,
    recordIceStateTransition,
  ]);

  // ── Init local media ────────────────────────────────────────────────────────
  const initLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    if (initLocalMediaPromiseRef.current) return initLocalMediaPromiseRef.current;

    initLocalMediaPromiseRef.current = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      cameraVideoTrackRef.current = stream.getVideoTracks()[0] || null;

      try {
        const audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const detect = () => {
          analyser.getByteFrequencyData(data);
          const volume = data.reduce((a, b) => a + b, 0) / data.length;
          if (volume > 25) setActiveSpeakerId("local");
          requestAnimationFrame(detect);
        };
        detect();
      } catch (e) {
        console.warn("[huddle] Audio analyser init failed:", e);
      }

      return stream;
    })();

    try {
      return await initLocalMediaPromiseRef.current;
    } finally {
      initLocalMediaPromiseRef.current = null;
    }
  }, []);

  // ── Flush queued ICE candidates after remote description is set ─────────────
  const flushIceCandidates = useCallback(async (pc, userId) => {
    const uid = String(userId);
    const queued = iceCandidateQueueRef.current[uid] || [];
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch { /* Ignore stale ICE candidates from the existing mesh flow. */ }
    }
    delete iceCandidateQueueRef.current[uid];
  }, []);

  // ── Create and send an offer to a remote peer ───────────────────────────────
  const sendOffer = useCallback(async (peerId, peerUsername) => {
    const uid = String(peerId);
    const socket = getSocketSafe();
    if (!socket) return;

    try {
      setError("");
      await initLocalMedia();
      const pc = createPeerConnection(uid);
      if (!pc) return;
      if (pc.signalingState !== "stable") return;

      setRemotePeers(prev => {
        if (prev.find(p => String(p.userId) === uid)) return prev;
        return [...prev, { userId: uid, username: peerUsername || "", stream: remoteStreamsRef.current[uid] || null, isMuted: false, isCameraOff: false, isScreenSharing: false, connectionState: "connecting" }];
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("huddle:signal", {
        channelId: channelIdRef.current,
        targetUserId: uid,
        huddleId: huddleIdRef.current,
        data: { type: "offer", sdp: offer.sdp, fromUsername: userRef.current?.username || "" },
      });
    } catch (err) {
      setError(err?.name === "NotAllowedError"
        ? "Camera or microphone permission was blocked."
        : "Could not start Huddle media.");
      console.error("[huddle] sendOffer error for", uid, ":", err);
    }
  }, [createPeerConnection, initLocalMedia]);

  const requestMeshResync = useCallback(async () => {
    if (!inCallRef.current || !channelIdRef.current || !huddleIdRef.current) return;
    const socket = getSocketSafe();
    if (!socket?.connected) return;

    socket.emit("huddle:join", {
      channelId: channelIdRef.current,
      huddleId: huddleIdRef.current,
    });

    const peerIds = new Set([
      ...remotePeersRef.current.map((peer) => String(peer.userId)),
      ...Object.keys(peerConnectionsRef.current),
      ...Object.keys(remoteStreamsRef.current),
    ]);

    for (const peerId of peerIds) {
      if (!peerId || peerId === String(userRef.current?.id || "")) continue;
      await sendOffer(
        peerId,
        remotePeersRef.current.find((peer) => String(peer.userId) === peerId)?.username
      );
    }
  }, [sendOffer]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const handleOnline = () => {
      requestMeshResync();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") requestMeshResync();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [requestMeshResync]);

  // ── Start call ──────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!channelIdRef.current || !userRef.current) return;
    if (inCallRef.current || startingRef.current) return;
    startingRef.current = true;
    providerMetricsRef.current = {
      ...createInitialMeshMetrics(),
      joinStartedAt: metricNow(),
      roomStartedAt: metricNow(),
    };

    const socket = getSocketSafe();
    if (!socket) { startingRef.current = false; return; }

    // Prefetch ICE config (no-op if already cached)
    await fetchIceConfig().catch(() => {});

    setConnecting(true);
    inCallRef.current = true;
    setInCall(true);
    setError("");

    socket.emit("huddle:join", {
      channelId: channelIdRef.current,
      huddleId: huddleIdRef.current,
    });

    try {
      await initLocalMedia();
    } catch (err) {
      console.error("[huddle] media access failed:", err.message);
      setError(err?.name === "NotAllowedError"
        ? "Camera or microphone permission was blocked."
        : "Could not start Huddle media.");
      providerMetricsRef.current.failures = [
        ...providerMetricsRef.current.failures.slice(-49),
        {
          type: "media_access_failed",
          reason: "media_access_failed",
          message: err?.message || null,
          observedAt: new Date().toISOString(),
        },
      ];
    }

    providerMetricsRef.current.joinLatencyMs = elapsedMs(providerMetricsRef.current.joinStartedAt);
    setConnecting(false);
    startingRef.current = false;
  }, [initLocalMedia]);

  // ── Leave call ──────────────────────────────────────────────────────────────
  const leaveCall = useCallback(() => {
    inCallRef.current = false;
    startingRef.current = false;
    providerMetricsRef.current.roomEndedAt = metricNow();

    const socket = getSocketSafe();
    if (socket && channelIdRef.current) {
      socket.emit("huddle:leave", {
        channelId: channelIdRef.current,
        huddleId: huddleIdRef.current,
      });
    }

    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    remoteStreamsRef.current = {};
    iceCandidateQueueRef.current = {};
    Object.values(peerDisconnectTimersRef.current).forEach((timer) => clearTimeout(timer));
    peerDisconnectTimersRef.current = {};
    setRemotePeers([]);

    if (blackTrackRef.current) {
      blackTrackRef.current.track.stop();
      blackTrackRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    cameraVideoTrackRef.current = null;

    setMicEnabled(true);
    setCamEnabled(true);
    setScreenSharing(false);
    setInCall(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    subtitlesEnabledRef.current = false;
    setSubtitlesEnabled(false);
    setSubtitles({});
  }, []);

  // ── Toggle mic ──────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const local = localStreamRef.current;
    if (!local) return;
    const newValue = !micEnabled;
    local.getAudioTracks().forEach((track) => { track.enabled = newValue; });
    setMicEnabled(newValue);
    const socket = getSocketSafe();
    if (socket && channelIdRef.current) {
      socket.emit(newValue ? "huddle:unmute" : "huddle:mute", { channelId: channelIdRef.current });
    }
  }, [micEnabled]);

  // ── Toggle camera ───────────────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const local = localStreamRef.current;
    if (!local) return;
    const turningOn = !camEnabled;

    if (!turningOn) {
      const cameraTrack = cameraVideoTrackRef.current || local.getVideoTracks()[0];
      const canvas = document.createElement("canvas");
      canvas.width = 2; canvas.height = 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 2, 2);
      const blackStream = canvas.captureStream ? canvas.captureStream(10) : null;
      const blackTrack = blackStream ? blackStream.getVideoTracks()[0] : null;

      if (blackTrack) {
        local.addTrack(blackTrack);
        if (cameraTrack) local.removeTrack(cameraTrack);
        blackTrackRef.current = { track: blackTrack, canvas };
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(blackTrack);
        });
      } else {
        if (cameraTrack) cameraTrack.enabled = false;
      }
      if (cameraTrack) cameraTrack.enabled = false;
      if (cameraTrack) cameraVideoTrackRef.current = cameraTrack;
      setCamEnabled(false);

      const socket = getSocketSafe();
      if (socket && channelIdRef.current) {
        socket.emit("huddle:camera-off", { channelId: channelIdRef.current });
      }
      return;
    }

    const cameraTrack = cameraVideoTrackRef.current;
    const blackInfo = blackTrackRef.current;

    if (cameraTrack && cameraTrack.readyState === "live") {
      cameraTrack.enabled = true;
      local.addTrack(cameraTrack);
      if (blackInfo) {
        local.removeTrack(blackInfo.track);
        blackInfo.track.stop();
        blackTrackRef.current = null;
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      });
      setCamEnabled(true);
      const socket = getSocketSafe();
      if (socket && channelIdRef.current) {
        socket.emit("huddle:camera-on", { channelId: channelIdRef.current });
      }
      return;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      local.addTrack(newTrack);
      if (blackInfo) {
        local.removeTrack(blackInfo.track);
        blackInfo.track.stop();
        blackTrackRef.current = null;
      }
      cameraVideoTrackRef.current = newTrack;
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(newTrack);
      });
      setCamEnabled(true);
      const socket = getSocketSafe();
      if (socket && channelIdRef.current) {
        socket.emit("huddle:camera-on", { channelId: channelIdRef.current });
      }
    } catch (err) {
      console.error("[huddle] toggleCamera re-acquire failed:", err);
    }
  }, [camEnabled]);

  // ── Screen share ────────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    if (screenSharing) return { ok: true, reason: "screen_share_already_active" };
    if (!browserSupportsScreenShare()) {
      return { ok: false, reason: "screen_share_not_supported" };
    }
    const socket = getSocketSafe();
    if (!socket) return { ok: false, reason: "socket_unavailable" };
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return { ok: false, reason: "screen_track_unavailable" };
      screenTrackRef.current = screenTrack;
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });
      const local = localStreamRef.current;
      if (local) {
        local.getVideoTracks().forEach((t) => local.removeTrack(t));
        local.addTrack(screenTrack);
        setLocalStream(new MediaStream(local.getTracks()));
      }
      setScreenSharing(true);
      screenTrack.onended = () => stopScreenShare();
      if (channelIdRef.current) {
        socket.emit("huddle:screen-start", { channelId: channelIdRef.current });
      }
      return { ok: true, reason: "screen_share_started" };
    } catch (err) {
      console.error("[huddle] startScreenShare error:", err);
      return {
        ok: false,
        reason: "screen_share_failed",
        message: String(err?.message || "").slice(0, 160) || null,
      };
    }
  }, [screenSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopScreenShare = useCallback(() => {
    const socket = getSocketSafe();
    const cameraTrack = cameraVideoTrackRef.current;
    const screenTrack = screenTrackRef.current;
    if (screenTrack) { screenTrack.stop(); screenTrackRef.current = null; }
    if (cameraTrack && localStreamRef.current) {
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      });
      const local = localStreamRef.current;
      local.getVideoTracks().forEach((t) => local.removeTrack(t));
      local.addTrack(cameraTrack);
      setLocalStream(new MediaStream(local.getTracks()));
    }
    setScreenSharing(false);
    if (socket && channelIdRef.current) {
      socket.emit("huddle:screen-stop", { channelId: channelIdRef.current });
    }
  }, []);

  // ── Mute all (host) ─────────────────────────────────────────────────────────
  const muteAll = useCallback(() => {
    const socket = getSocketSafe();
    if (!socket || !channelIdRef.current) return;
    socket.emit("huddle:mute-all", { channelId: channelIdRef.current });
  }, []);

  // ── Live subtitles ──────────────────────────────────────────────────────────
  const toggleSubtitles = useCallback(() => {
    const next = !subtitlesEnabledRef.current;
    subtitlesEnabledRef.current = next;
    setSubtitlesEnabled(next);

    if (!next) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setSubtitles({});
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      subtitlesEnabledRef.current = true;
      setSubtitlesEnabled(true);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      const at = Date.now();
      setSubtitles((prev) => ({ ...prev, local: { text: transcript, at, isFinal } }));
      if (isFinal) {
        setTimeout(() => {
          setSubtitles((prev) => {
            const entry = prev.local;
            if (entry && entry.at === at) { const next = { ...prev }; delete next.local; return next; }
            return prev;
          });
        }, 4500);
      }
      const socket = getSocketSafe();
      if (socket && channelIdRef.current) {
        socket.emit("huddle:subtitle", { channelId: channelIdRef.current, text: transcript, isFinal });
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        subtitlesEnabledRef.current = false;
        setSubtitlesEnabled(false);
      }
    };

    recognition.onend = () => {
      if (subtitlesEnabledRef.current && inCallRef.current) {
        try { recognition.start(); } catch { /* Browser speech recognition can reject rapid restarts. */ }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("[huddle] SpeechRecognition start failed:", e);
      subtitlesEnabledRef.current = false;
      setSubtitlesEnabled(false);
      return;
    }
    recognitionRef.current = recognition;
  }, []);

  // ── Recording ───────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!localStreamRef.current) return;
    const recorder = new MediaRecorder(localStreamRef.current, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      console.log("[huddle] Recording finished:", blob);
    };
    recorder.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  // ── Socket event handlers ───────────────────────────────────────────────────
  useEffect(() => {
    let cleanup = () => {};

    function attachSocketHandlers() {
      const socket = getSocket();
      cleanup();
      cleanup = () => {};
      if (!socket) return;

      // ── User joined the same huddle room (existing participant creates offer) ──
      const isCurrentHuddle = (incomingHuddleId) =>
        !incomingHuddleId || String(incomingHuddleId) === String(huddleIdRef.current || "");

      const handleUserJoined = async ({ channelId, huddleId, userId, username }) => {
        if (channelId !== channelIdRef.current) return;
        if (!isCurrentHuddle(huddleId)) return;
        if (String(userId) === String(userRef.current?.id)) return;
        if (!inCallRef.current) return;
        await sendOffer(userId, username);
      };

      // ── Server sent us the list of participants already in the call ──────────
      // This fires on the JOINER side and fixes the race condition where
      // huddle:user-joined might be missed if the caller's socket wasn't in the
      // channel room yet when this user joined.
      const handleParticipants = async ({ channelId, huddleId, participants }) => {
        if (channelId !== channelIdRef.current) return;
        if (!isCurrentHuddle(huddleId)) return;
        if (!inCallRef.current) return;
        for (const { userId: peerId, username } of (participants || [])) {
          if (String(peerId) === String(userRef.current?.id)) continue;
          await sendOffer(peerId, username);
        }
      };

      const handleUserLeft = ({ channelId, huddleId, userId }) => {
        if (channelId !== channelIdRef.current) return;
        if (!isCurrentHuddle(huddleId)) return;
        removeRemotePeer(userId);
        setSubtitles((prev) => {
          const next = { ...prev };
          delete next[String(userId)];
          return next;
        });
      };

      // ── WebRTC signaling with Perfect Negotiation ─────────────────────────────
      // "Polite" peer = higher userId: yields when there's an offer collision.
      // "Impolite" peer = lower userId: ignores colliding incoming offers.
      const handleSignal = async ({ fromUserId, data, channelId, huddleId }) => {
        if (channelId !== channelIdRef.current) return;
        if (!isCurrentHuddle(huddleId)) return;
        if (String(fromUserId) === String(userRef.current?.id)) return;

        const { type } = data;
        const myId   = String(userRef.current?.id || "");
        const peerId = String(fromUserId);
        const isPolite = myId > peerId; // higher userId is polite

        try {
          if (type === "offer") await initLocalMedia();

          const pc = createPeerConnection(fromUserId);
          if (!pc) return;

          if (type === "offer") {
            const offerCollision = pc.signalingState !== "stable";

            if (!isPolite && offerCollision) {
              // Impolite peer: ignore the incoming offer — our own offer wins
              return;
            }

            // Polite peer: rollback our pending offer and process theirs
            if (offerCollision && pc.signalingState !== "stable") {
              await pc.setLocalDescription({ type: "rollback" });
            }

            // Add tile to UI immediately so the user sees the peer's placeholder
            const fromUsername = data.fromUsername || "";
            setRemotePeers((prev) => {
              if (prev.find((p) => String(p.userId) === peerId)) return prev;
              return [...prev, { userId: fromUserId, username: fromUsername, stream: remoteStreamsRef.current[peerId] || null, isMuted: false, isCameraOff: false, isScreenSharing: false, connectionState: "connecting" }];
            });

            await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
            await flushIceCandidates(pc, fromUserId);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("huddle:signal", {
              channelId: channelIdRef.current,
              targetUserId: fromUserId,
              huddleId: huddleIdRef.current,
              data: { type: "answer", sdp: answer.sdp },
            });

          } else if (type === "answer") {
            // Only accept an answer if we actually sent an offer
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
              await flushIceCandidates(pc, fromUserId);
            }

          } else if (type === "candidate" && data.candidate) {
            const candidate = createIceCandidateFromSignal(data);
            if (!candidate) return;
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(candidate); } catch { /* Ignore stale ICE candidates from the existing mesh flow. */ }
            } else {
              if (!iceCandidateQueueRef.current[peerId]) iceCandidateQueueRef.current[peerId] = [];
              iceCandidateQueueRef.current[peerId].push(candidate);
            }
          }
        } catch (err) {
          console.error("[huddle] handleSignal error:", err);
        }
      };

      const handleMute        = ({ userId }) => updateRemotePeerMeta(userId, { isMuted: true });
      const handleUnmute      = ({ userId }) => updateRemotePeerMeta(userId, { isMuted: false });
      const handleCameraOff   = ({ userId }) => updateRemotePeerMeta(userId, { isCameraOff: true });
      const handleCameraOn    = ({ userId }) => updateRemotePeerMeta(userId, { isCameraOff: false });
      const handleScreenStart = ({ userId }) => updateRemotePeerMeta(userId, { isScreenSharing: true });
      const handleScreenStop  = ({ userId }) => updateRemotePeerMeta(userId, { isScreenSharing: false });

      const handleMuted = () => {
        const local = localStreamRef.current;
        if (!local) return;
        local.getAudioTracks().forEach((track) => { track.enabled = false; });
        setMicEnabled(false);
      };

      const handleSubtitle = ({ fromUserId, text, isFinal }) => {
        const at = Date.now();
        setSubtitles((prev) => ({ ...prev, [fromUserId]: { text, at, isFinal } }));
        setTimeout(() => {
          setSubtitles((prev) => {
            const entry = prev[fromUserId];
            if (entry && entry.at === at) {
              const next = { ...prev };
              delete next[fromUserId];
              return next;
            }
            return prev;
          });
        }, 4500);
      };

      socket.on("huddle:user-joined",  handleUserJoined);
      socket.on("huddle:participants", handleParticipants);
      socket.on("huddle:user-left",    handleUserLeft);
      socket.on("huddle:signal",       handleSignal);
      socket.on("huddle:mute",         handleMute);
      socket.on("huddle:unmute",       handleUnmute);
      socket.on("huddle:camera-off",   handleCameraOff);
      socket.on("huddle:camera-on",    handleCameraOn);
      socket.on("huddle:screen-start", handleScreenStart);
      socket.on("huddle:screen-stop",  handleScreenStop);
      socket.on("huddle:muted",        handleMuted);
      socket.on("huddle:subtitle",     handleSubtitle);

      cleanup = () => {
        socket.off("huddle:user-joined",  handleUserJoined);
        socket.off("huddle:participants", handleParticipants);
        socket.off("huddle:user-left",    handleUserLeft);
        socket.off("huddle:signal",       handleSignal);
        socket.off("huddle:mute",         handleMute);
        socket.off("huddle:unmute",       handleUnmute);
        socket.off("huddle:camera-off",   handleCameraOff);
        socket.off("huddle:camera-on",    handleCameraOn);
        socket.off("huddle:screen-start", handleScreenStart);
        socket.off("huddle:screen-stop",  handleScreenStop);
        socket.off("huddle:muted",        handleMuted);
        socket.off("huddle:subtitle",     handleSubtitle);
      };
    }

    const onAuthUpdated = () => setTimeout(attachSocketHandlers, 0);
    window.addEventListener("auth:updated", onAuthUpdated);
    attachSocketHandlers();

    return () => {
      window.removeEventListener("auth:updated", onAuthUpdated);
      cleanup();
    };
  }, [createPeerConnection, flushIceCandidates, initLocalMedia, removeRemotePeer, updateRemotePeerMeta, sendOffer]);

  // Network quality monitor
  useEffect(() => {
    const interval = setInterval(async () => {
      const peerEntries = Object.entries(peerConnectionsRef.current);
      if (!peerEntries.length) return;
      try {
        const [samplePeerId, samplePc] = peerEntries[0];
        const stats = await samplePc.getStats();
        recordSelectedCandidatePair(samplePeerId, getSelectedCandidatePairDiagnostic(stats));
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const rtt = report.currentRoundTripTime || 0;
            if (rtt > 0.6) setNetworkQuality("poor");
            else if (rtt > 0.3) setNetworkQuality("ok");
            else setNetworkQuality("good");
          }
        });
      } catch { /* Keep the existing best-effort network quality probe behavior. */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [recordSelectedCandidatePair]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      remoteStreamsRef.current = {};
      iceCandidateQueueRef.current = {};
      Object.values(peerDisconnectTimersRef.current).forEach((timer) => clearTimeout(timer));
      peerDisconnectTimersRef.current = {};
      iceDiagnosticsRef.current = { peers: {} };
      selectedPairLogKeyRef.current = {};
      if (blackTrackRef.current) { blackTrackRef.current.track.stop(); blackTrackRef.current = null; }
      if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current = null; }
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      cameraVideoTrackRef.current = null;
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    };
  }, []);

  return {
    inCall,
    connecting,
    localStream,
    remotePeers,
    micEnabled,
    camEnabled,
    screenSharing,
    screenShareSupported: browserSupportsScreenShare(),
    subtitlesSupported: browserSupportsSpeechRecognition(),
    subtitlesEnabled,
    subtitles,
    startCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    setQualityMode: async () => ({
      ok: false,
      reason: "mesh_quality_mode_not_supported",
    }),
    toggleSubtitles,
    activeSpeakerId,
    networkQuality,
    qualityMode: "auto",
    error,
    mediaStateV2,
    diagnostics: mediaStateV2.diagnostics,
    startRecording,
    stopRecording,
    muteAll,
    setChannelId,
    setHuddleId,
  };
}
