// src/hooks/useHuddleCall.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../socket";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

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

  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const localStreamRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const channelIdRef = useRef(null);
  const huddleIdRef = useRef(null);
  const userRef = useRef(currentUser);

  useEffect(() => { userRef.current = currentUser; }, [currentUser]);

  const setChannelId = useCallback((id) => { channelIdRef.current = id; }, []);
  const setHuddleId = useCallback((id) => { huddleIdRef.current = id; }, []);

  const getSocketSafe = () => {
    const socket = getSocket();
    if (!socket) console.warn("Socket not initialized for huddle");
    return socket;
  };

  // ---- Recording ----
  const startRecording = useCallback(() => {
    if (!localStreamRef.current) return;
    const recorder = new MediaRecorder(localStreamRef.current, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      console.log("Recording finished:", blob);
    };
    recorder.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  // ---- Remote peer helpers ----
  const updateRemotePeerStream = useCallback((userId, stream) => {
    remoteStreamsRef.current[userId] = stream;
    setRemotePeers((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) return prev.map((p) => p.userId === userId ? { ...p, stream } : p);
      return [...prev, { userId, username: "", stream, isMuted: false, isScreenSharing: false }];
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
  }, []);

  // ---- Create RTCPeerConnection ----
  const createPeerConnection = useCallback((remoteUserId) => {
    const socket = getSocketSafe();
    if (!socket) return null;

    let pc = peerConnectionsRef.current[remoteUserId];
    if (pc) return pc;

    pc = new RTCPeerConnection(RTC_CONFIG);

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

  // ---- Init local media ----
  const initLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } },
    });

    localStreamRef.current = stream;
    setLocalStream(stream);

    const videoTrack = stream.getVideoTracks()[0] || null;
    cameraVideoTrackRef.current = videoTrack;

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
      console.warn("Audio analyser init failed:", e);
    }

    return stream;
  }, []);

  // ---- Start call ----
  const startCall = useCallback(async () => {
    if (!channelIdRef.current || !userRef.current) return;
    if (inCall || connecting) return;

    const socket = getSocketSafe();
    if (!socket) return;

    try {
      setConnecting(true);
      await initLocalMedia();

      socket.emit("huddle:join", {
        channelId: channelIdRef.current,
        huddleId: huddleIdRef.current,
      });

      setInCall(true);
      setConnecting(false);
    } catch (err) {
      console.error("startCall error:", err);
      setConnecting(false);
    }
  }, [connecting, inCall, initLocalMedia]);

  // ---- Leave call ----
  const leaveCall = useCallback(() => {
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
    setRemotePeers([]);

    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    cameraVideoTrackRef.current = null;
    screenTrackRef.current = null;
    setScreenSharing(false);
    setInCall(false);
  }, []);

  // ---- Toggle mic ----
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

  // ---- Toggle camera ----
  const toggleCamera = useCallback(() => {
    const local = localStreamRef.current;
    if (!local) return;
    const newValue = !camEnabled;
    local.getVideoTracks().forEach((track) => { track.enabled = newValue; });
    setCamEnabled(newValue);
  }, [camEnabled]);

  // ---- Screen share ----
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
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
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
      console.error("startScreenShare error:", err);
    }
  }, [screenSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopScreenShare = useCallback(() => {
    const socket = getSocketSafe();
    const cameraTrack = cameraVideoTrackRef.current;
    const screenTrack = screenTrackRef.current;

    if (screenTrack) screenTrack.stop();
    screenTrackRef.current = null;

    if (cameraTrack && localStreamRef.current) {
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
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

  // ---- Mute all ----
  const muteAll = useCallback(() => {
    const socket = getSocketSafe();
    if (!socket || !channelIdRef.current) return;
    socket.emit("huddle:mute-all", { channelId: channelIdRef.current });
  }, []);

  // ---- Socket event handlers ----
  useEffect(() => {
    const socket = getSocketSafe();
    if (!socket) return;

    const handleUserJoined = async ({ channelId, userId, username }) => {
      if (channelId !== channelIdRef.current) return;
      if (String(userId) === String(userRef.current?.id)) return;
      if (!inCall) return;

      try {
        await initLocalMedia();
        const pc = createPeerConnection(userId);
        if (!pc) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("huddle:signal", {
          channelId: channelIdRef.current,
          targetUserId: userId,
          huddleId: huddleIdRef.current,
          data: { type: "offer", sdp: offer.sdp },
        });

        setRemotePeers((prev) => {
          const existing = prev.find((p) => p.userId === userId);
          if (existing) return prev.map((p) => p.userId === userId ? { ...p, username } : p);
          return [...prev, { userId, username, stream: remoteStreamsRef.current[userId] || null, isMuted: false, isScreenSharing: false }];
        });
      } catch (err) {
        console.error("handleUserJoined error:", err);
      }
    };

    const handleUserLeft = ({ channelId, userId }) => {
      if (channelId !== channelIdRef.current) return;
      removeRemotePeer(userId);
    };

    const handleSignal = async ({ fromUserId, data, channelId }) => {
      if (channelId !== channelIdRef.current) return;
      if (String(fromUserId) === String(userRef.current?.id)) return;

      const { type } = data;

      try {
        const pc = createPeerConnection(fromUserId);
        if (!pc) return;

        if (type === "offer") {
          await initLocalMedia();
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
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
        } else if (type === "candidate" && data.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { /* ignore stale candidates */ }
        }
      } catch (err) {
        console.error("handleSignal error:", err);
      }
    };

    const handleMute = ({ userId }) => updateRemotePeerMeta(userId, { isMuted: true });
    const handleUnmute = ({ userId }) => updateRemotePeerMeta(userId, { isMuted: false });
    const handleScreenStart = ({ userId }) => updateRemotePeerMeta(userId, { isScreenSharing: true });
    const handleScreenStop = ({ userId }) => updateRemotePeerMeta(userId, { isScreenSharing: false });

    // Forced mute by host
    const handleMuted = () => {
      const local = localStreamRef.current;
      if (!local) return;
      local.getAudioTracks().forEach((track) => { track.enabled = false; });
      setMicEnabled(false);
    };

    socket.on("huddle:user-joined", handleUserJoined);
    socket.on("huddle:user-left", handleUserLeft);
    socket.on("huddle:signal", handleSignal);
    socket.on("huddle:mute", handleMute);
    socket.on("huddle:unmute", handleUnmute);
    socket.on("huddle:screen-start", handleScreenStart);
    socket.on("huddle:screen-stop", handleScreenStop);
    socket.on("huddle:muted", handleMuted);

    return () => {
      socket.off("huddle:user-joined", handleUserJoined);
      socket.off("huddle:user-left", handleUserLeft);
      socket.off("huddle:signal", handleSignal);
      socket.off("huddle:mute", handleMute);
      socket.off("huddle:unmute", handleUnmute);
      socket.off("huddle:screen-start", handleScreenStart);
      socket.off("huddle:screen-stop", handleScreenStop);
      socket.off("huddle:muted", handleMuted);
    };
  }, [createPeerConnection, initLocalMedia, inCall, removeRemotePeer, updateRemotePeerMeta]);

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
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      cameraVideoTrackRef.current = null;
      screenTrackRef.current = null;
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
    startCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    activeSpeakerId,
    networkQuality,
    startRecording,
    stopRecording,
    muteAll,
    setChannelId,
    setHuddleId,
  };
}
