// src/hooks/useHuddleCall.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../socket";

// TURN credentials via Vite env vars — set VITE_TURN_URL, VITE_TURN_USERNAME,
// VITE_TURN_CREDENTIAL in production for symmetric-NAT traversal.
function buildRTCConfig() {
  const u = import.meta.env?.VITE_TURN_USERNAME || "";
  const c = import.meta.env?.VITE_TURN_CREDENTIAL || "";
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
  ];
  if (u && c) {
    iceServers.push(
      { urls: "turn:global.relay.metered.ca:80", username: u, credential: c },
      { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: u, credential: c },
      { urls: "turn:global.relay.metered.ca:443", username: u, credential: c },
      { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: u, credential: c },
    );
  }
  return { iceServers };
}

const RTC_CONFIG = buildRTCConfig();

export function useHuddleCall({ currentUser }) {
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
  const [subtitles, setSubtitles] = useState({}); // { userId|"local": { text, at, isFinal } }

  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const localStreamRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const blackTrackRef = useRef(null);
  const iceCandidateQueueRef = useRef({}); // { [userId]: RTCIceCandidate[] }
  const recognitionRef = useRef(null);
  const subtitlesEnabledRef = useRef(false);

  const channelIdRef = useRef(null);
  const huddleIdRef = useRef(null);
  const userRef = useRef(currentUser);
  const inCallRef = useRef(false);
  const startingRef = useRef(false); // ref-based guard to prevent double startCall
  const initLocalMediaPromiseRef = useRef(null); // deduplicates concurrent getUserMedia calls

  useEffect(() => { userRef.current = currentUser; }, [currentUser]);
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);

  const setChannelId = useCallback((id) => { channelIdRef.current = id; }, []);
  const setHuddleId = useCallback((id) => { huddleIdRef.current = id; }, []);

  const getSocketSafe = () => {
    const socket = getSocket();
    if (!socket) console.warn("[huddle] Socket not initialized");
    return socket;
  };

  // ── Remote peer helpers ─────────────────────────────────────────────────────
  const updateRemotePeerStream = useCallback((userId, stream) => {
    remoteStreamsRef.current[userId] = stream;
    setRemotePeers((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) return prev.map((p) => p.userId === userId ? { ...p, stream } : p);
      return [...prev, { userId, username: "", stream, isMuted: false, isCameraOff: false, isScreenSharing: false }];
    });
  }, []);

  const updateRemotePeerMeta = useCallback((userId, meta) => {
    setRemotePeers((prev) => prev.map((p) => p.userId === userId ? { ...p, ...meta } : p));
  }, []);

  const removeRemotePeer = useCallback((userId) => {
    setRemotePeers((prev) => prev.filter((p) => p.userId !== userId));
    const pc = peerConnectionsRef.current[userId];
    if (pc) { pc.close(); delete peerConnectionsRef.current[userId]; }
    delete remoteStreamsRef.current[userId];
    delete iceCandidateQueueRef.current[userId];
  }, []);

  // ── Create RTCPeerConnection ────────────────────────────────────────────────
  const createPeerConnection = useCallback((remoteUserId) => {
    const socket = getSocketSafe();
    if (!socket) return null;

    const existing = peerConnectionsRef.current[remoteUserId];
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("huddle:signal", {
          channelId: channelIdRef.current,
          targetUserId: remoteUserId,
          huddleId: huddleIdRef.current,
          data: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) updateRemotePeerStream(remoteUserId, stream);
    };

    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((track) => pc.addTrack(track, local));

    peerConnectionsRef.current[remoteUserId] = pc;
    return pc;
  }, [updateRemotePeerStream]);

  // ── Init local media ────────────────────────────────────────────────────────
  const initLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    // Reuse in-flight promise to prevent concurrent getUserMedia calls
    if (initLocalMediaPromiseRef.current) return initLocalMediaPromiseRef.current;

    initLocalMediaPromiseRef.current = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      cameraVideoTrackRef.current = stream.getVideoTracks()[0] || null;

      // Active speaker detection via audio analyser
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
  const flushIceCandidates = useCallback(async (pc, remoteUserId) => {
    const queued = iceCandidateQueueRef.current[remoteUserId] || [];
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch (e) { /* stale, ignore */ }
    }
    delete iceCandidateQueueRef.current[remoteUserId];
  }, []);

  // ── Start call ──────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!channelIdRef.current || !userRef.current) return;
    // Use refs (not stale React state) to guard against double-calls
    if (inCallRef.current || startingRef.current) return;
    startingRef.current = true;

    const socket = getSocketSafe();
    if (!socket) { startingRef.current = false; return; }

    setConnecting(true);
    inCallRef.current = true;
    setInCall(true);

    // Emit join before acquiring media — WebRTC handshake can start immediately
    socket.emit("huddle:join", {
      channelId: channelIdRef.current,
      huddleId: huddleIdRef.current,
    });

    try {
      await initLocalMedia();
    } catch (err) {
      console.error("[huddle] media access failed:", err.message);
    }

    setConnecting(false);
    startingRef.current = false;
  }, [initLocalMedia]);

  // ── Leave call ──────────────────────────────────────────────────────────────
  const leaveCall = useCallback(() => {
    // Sync refs immediately — don't wait for React state batch
    inCallRef.current = false;
    startingRef.current = false;

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
    setRemotePeers([]);

    if (blackTrackRef.current) {
      blackTrackRef.current.track.stop();
      blackTrackRef.current = null;
    }
    // Stop screen share track so OS recording indicator disappears
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    cameraVideoTrackRef.current = null;

    // Reset media UI state so next call starts fresh
    setMicEnabled(true);
    setCamEnabled(true);
    setScreenSharing(false);
    setInCall(false);

    // Stop subtitles
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
  // Uses a black canvas track instead of track.enabled=false to prevent
  // Android WebView from pausing the <video> element when frames stop.
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

    // Camera ON
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

    // Camera track ended (some Android browsers stop it) — re-acquire
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
    if (screenSharing) return;
    const socket = getSocketSafe();
    if (!socket) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;
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
    } catch (err) {
      console.error("[huddle] startScreenShare error:", err);
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
      console.warn("[huddle] SpeechRecognition not supported in this browser");
      subtitlesEnabledRef.current = false;
      setSubtitlesEnabled(false);
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
      setSubtitles((prev) => ({ ...prev, local: { text: transcript, at: Date.now(), isFinal } }));
      const socket = getSocketSafe();
      if (socket && channelIdRef.current) {
        socket.emit("huddle:subtitle", {
          channelId: channelIdRef.current,
          text: transcript,
          isFinal,
        });
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        subtitlesEnabledRef.current = false;
        setSubtitlesEnabled(false);
      }
    };

    // Auto-restart on end for continuous recognition
    recognition.onend = () => {
      if (subtitlesEnabledRef.current && inCallRef.current) {
        try { recognition.start(); } catch (e) { /* ignore if already started */ }
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
    let socketHandlerCleanup = null;
    let authUpdatedListener = null;

    function attachSocketHandlers() {
      const socket = getSocket();
      if (!socket || socketHandlerCleanup) return; // already attached or no socket

    const handleUserJoined = async ({ channelId, userId, username }) => {
      if (channelId !== channelIdRef.current) return;
      if (String(userId) === String(userRef.current?.id)) return;
      if (!inCallRef.current) return;

      try {
        await initLocalMedia();
        const pc = createPeerConnection(userId);
        if (!pc) return;

        // Guard: only create offer when in stable state to prevent InvalidStateError
        if (pc.signalingState !== "stable") return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("huddle:signal", {
          channelId: channelIdRef.current,
          targetUserId: userId,
          huddleId: huddleIdRef.current,
          data: { type: "offer", sdp: offer.sdp, fromUsername: userRef.current?.username || "" },
        });

        setRemotePeers((prev) => {
          const existing = prev.find((p) => p.userId === userId);
          if (existing) return prev.map((p) => p.userId === userId ? { ...p, username } : p);
          return [...prev, { userId, username, stream: remoteStreamsRef.current[userId] || null, isMuted: false, isCameraOff: false, isScreenSharing: false }];
        });
      } catch (err) {
        console.error("[huddle] handleUserJoined error:", err);
      }
    };

    const handleUserLeft = ({ channelId, userId }) => {
      if (channelId !== channelIdRef.current) return;
      removeRemotePeer(userId);
      // Clear subtitles for this user
      setSubtitles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleSignal = async ({ fromUserId, data, channelId }) => {
      if (channelId !== channelIdRef.current) return;
      if (String(fromUserId) === String(userRef.current?.id)) return;

      const { type } = data;

      try {
        // Init local media BEFORE creating PC for offers so tracks are added immediately
        if (type === "offer") await initLocalMedia();

        const pc = createPeerConnection(fromUserId);
        if (!pc) return;

        if (type === "offer") {
          // Add the offering peer to the list immediately so their tile renders before stream arrives
          const fromUsername = data.fromUsername || "";
          setRemotePeers((prev) => {
            if (prev.find((p) => p.userId === fromUserId)) return prev;
            return [...prev, { userId: fromUserId, username: fromUsername, stream: remoteStreamsRef.current[fromUserId] || null, isMuted: false, isCameraOff: false, isScreenSharing: false }];
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
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
          await flushIceCandidates(pc, fromUserId);
        } else if (type === "candidate" && data.candidate) {
          const candidate = new RTCIceCandidate(data.candidate);
          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(candidate); } catch (e) { /* stale */ }
          } else {
            // Queue until remote description is ready
            if (!iceCandidateQueueRef.current[fromUserId]) iceCandidateQueueRef.current[fromUserId] = [];
            iceCandidateQueueRef.current[fromUserId].push(candidate);
          }
        }
      } catch (err) {
        console.error("[huddle] handleSignal error:", err);
      }
    };

    const handleMute = ({ userId }) => updateRemotePeerMeta(userId, { isMuted: true });
    const handleUnmute = ({ userId }) => updateRemotePeerMeta(userId, { isMuted: false });
    const handleCameraOff = ({ userId }) => updateRemotePeerMeta(userId, { isCameraOff: true });
    const handleCameraOn = ({ userId }) => updateRemotePeerMeta(userId, { isCameraOff: false });
    const handleScreenStart = ({ userId }) => updateRemotePeerMeta(userId, { isScreenSharing: true });
    const handleScreenStop = ({ userId }) => updateRemotePeerMeta(userId, { isScreenSharing: false });

    const handleMuted = () => {
      const local = localStreamRef.current;
      if (!local) return;
      local.getAudioTracks().forEach((track) => { track.enabled = false; });
      setMicEnabled(false);
    };

    const handleSubtitle = ({ fromUserId, text, isFinal }) => {
      setSubtitles((prev) => ({ ...prev, [fromUserId]: { text, at: Date.now(), isFinal } }));
    };

    socket.on("huddle:user-joined", handleUserJoined);
    socket.on("huddle:user-left", handleUserLeft);
    socket.on("huddle:signal", handleSignal);
    socket.on("huddle:mute", handleMute);
    socket.on("huddle:unmute", handleUnmute);
    socket.on("huddle:camera-off", handleCameraOff);
    socket.on("huddle:camera-on", handleCameraOn);
    socket.on("huddle:screen-start", handleScreenStart);
    socket.on("huddle:screen-stop", handleScreenStop);
    socket.on("huddle:muted", handleMuted);
    socket.on("huddle:subtitle", handleSubtitle);

    socketHandlerCleanup = () => {
      socket.off("huddle:user-joined", handleUserJoined);
      socket.off("huddle:user-left", handleUserLeft);
      socket.off("huddle:signal", handleSignal);
      socket.off("huddle:mute", handleMute);
      socket.off("huddle:unmute", handleUnmute);
      socket.off("huddle:camera-off", handleCameraOff);
      socket.off("huddle:camera-on", handleCameraOn);
      socket.off("huddle:screen-start", handleScreenStart);
      socket.off("huddle:screen-stop", handleScreenStop);
      socket.off("huddle:muted", handleMuted);
      socket.off("huddle:subtitle", handleSubtitle);
    };
    }

    // Try immediately; fall back to auth:updated event if socket not yet ready
    attachSocketHandlers();
    if (!socketHandlerCleanup) {
      authUpdatedListener = () => attachSocketHandlers();
      window.addEventListener("auth:updated", authUpdatedListener);
    }

    return () => {
      if (authUpdatedListener) window.removeEventListener("auth:updated", authUpdatedListener);
      if (socketHandlerCleanup) socketHandlerCleanup();
    };
  }, [createPeerConnection, flushIceCandidates, initLocalMedia, removeRemotePeer, updateRemotePeerMeta]);

  // Network quality monitor
  useEffect(() => {
    const interval = setInterval(async () => {
      const pcs = Object.values(peerConnectionsRef.current);
      if (!pcs.length) return;
      try {
        const stats = await pcs[0].getStats();
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const rtt = report.currentRoundTripTime || 0;
            if (rtt > 0.6) setNetworkQuality("poor");
            else if (rtt > 0.3) setNetworkQuality("ok");
            else setNetworkQuality("good");
          }
        });
      } catch (e) { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      remoteStreamsRef.current = {};
      iceCandidateQueueRef.current = {};
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
    subtitlesEnabled,
    subtitles,
    startCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    toggleSubtitles,
    activeSpeakerId,
    networkQuality,
    startRecording,
    stopRecording,
    muteAll,
    setChannelId,
    setHuddleId,
  };
}
