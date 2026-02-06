// src/hooks/useHuddleCall.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "../socket";
import "@mediapipe/selfie_segmentation";

// Simple STUN config (works fine for dev/small usage)
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

export function useHuddleCall({ channelId, currentUser }) {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]); // [{ userId, username, stream, isMuted, isScreenSharing }]

  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState("good");
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  // refs to avoid stale closures
  const peerConnectionsRef = useRef({}); // userId -> RTCPeerConnection
  const remoteStreamsRef = useRef({});   // userId -> MediaStream
  const localStreamRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  // ---- Recording (local only, hook-safe) ----
const startRecording = useCallback(() => {
  if (!localStreamRef.current) {
    console.warn("No local stream to record");
    return;
  }

  const recorder = new MediaRecorder(localStreamRef.current, {
    mimeType: "video/webm",
  });

  mediaRecorderRef.current = recorder;

  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    console.log("Recording finished:", blob);
    // later → upload blob
  };

  recorder.start();
}, []);

const stopRecording = useCallback(() => {
  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
  }
}, []);

  const channelIdRef = useRef(null);
  const setChannelId = useCallback((id) => {
  channelIdRef.current = id;
}, []);
  const userRef = useRef(currentUser);
  useEffect(() => {
    userRef.current = currentUser;
  }, [currentUser]);

  const getSocketSafe = () => {
    const socket = getSocket();
    if (!socket) {
      console.warn("Socket not initialized for huddle");
    }
    return socket;
  };

  // ---- Helpers to update remote peers state ----
  const updateRemotePeerStream = useCallback((userId, stream) => {
    remoteStreamsRef.current[userId] = stream;
    setRemotePeers((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        return prev.map((p) =>
          p.userId === userId ? { ...p, stream } : p
        );
      }
      return [
        ...prev,
        {
          userId,
          username: "", // will get set when user joins
          stream,
          isMuted: false,
          isScreenSharing: false,
        },
      ];
    });
  }, []);

  const muteAll = () => {
  const socket = getSocketSafe();
  if (!socket || !channelIdRef.current) return;

  socket.emit("huddle:mute-all", {
    channelId: channelIdRef.current,
  });
};

  const updateRemotePeerMeta = useCallback((userId, meta) => {
    setRemotePeers((prev) =>
      prev.map((p) =>
        p.userId === userId ? { ...p, ...meta } : p
      )
    );
  }, []);

  const removeRemotePeer = useCallback((userId) => {
    setRemotePeers((prev) => prev.filter((p) => p.userId !== userId));
    const pc = peerConnectionsRef.current[userId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[userId];
    }
    delete remoteStreamsRef.current[userId];
  }, []);

  // ---- Create RTCPeerConnection per remote user ----
  const createPeerConnection = useCallback(
    (remoteUserId) => {
      const socket = getSocketSafe();
      if (!socket) return null;

      let pc = peerConnectionsRef.current[remoteUserId];
      if (pc) return pc;

      pc = new RTCPeerConnection(RTC_CONFIG);

      // Send ICE candidates to the remote user (we use userId as "to")
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("huddle:signal", {
            channelId: channelIdRef.current,
            to: remoteUserId,
            data: {
              type: "candidate",
              candidate: event.candidate,
            },
          });
        }
      };

      // Remote track received
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          updateRemotePeerStream(remoteUserId, stream);
        }
      };

      // Add local tracks if available
      const local = localStreamRef.current;
      if (local) {
        local.getTracks().forEach((track) => {
          pc.addTrack(track, local);
        });
      }

      peerConnectionsRef.current[remoteUserId] = pc;
      return pc;
    },
    [updateRemotePeerStream]
  );

  // ---- Start local media (mic + cam) ----
  const initLocalMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
const applyBackgroundBlur = async () => {
  if (!localStreamRef.current) return;

  const videoTrack = cameraVideoTrackRef.current;
  if (!videoTrack) return;

  console.warn("Background blur hook ready (pipeline not yet attached)");
};
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 60 },
},
    });

    localStreamRef.current = stream;
    setLocalStream(stream);

    const videoTrack = stream.getVideoTracks()[0] || null;
    cameraVideoTrackRef.current = videoTrack;
    const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
const source = audioCtx.createMediaStreamSource(stream);

analyser.fftSize = 256;
source.connect(analyser);

const data = new Uint8Array(analyser.frequencyBinCount);

const detect = () => {
  analyser.getByteFrequencyData(data);
  const volume = data.reduce((a, b) => a + b, 0) / data.length;

  if (volume > 25) {
    setActiveSpeakerId(userRef.current.id);
  }

  requestAnimationFrame(detect);
};

detect();

    return stream;
  }, []);

  // ---- Start / Join the call ----
  const startCall = useCallback(async () => {
    if (!channelIdRef.current || !userRef.current) return;
    if (inCall || connecting) return;

    const socket = getSocketSafe();
    if (!socket) return;

    try {
      setConnecting(true);

      await initLocalMedia();

      // Tell backend we join the huddle room
      socket.emit("huddle:joinCall", {
        channelId: channelIdRef.current,
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
      socket.emit("huddle:leaveCall", {
        channelId: channelIdRef.current,
      });
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    remoteStreamsRef.current = {};
    setRemotePeers([]);

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
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
    local.getAudioTracks().forEach((track) => {
      track.enabled = newValue;
    });
    setMicEnabled(newValue);

    const socket = getSocketSafe();
    if (!socket || !channelIdRef.current) return;

    socket.emit(newValue ? "huddle:unmute" : "huddle:mute", {
      channelId: channelIdRef.current,
    });
  }, [micEnabled]);

  // ---- Toggle camera ----
  const toggleCamera = useCallback(() => {
    const local = localStreamRef.current;
    if (!local) return;

    const newValue = !camEnabled;
    local.getVideoTracks().forEach((track) => {
      track.enabled = newValue;
    });
    setCamEnabled(newValue);
  }, [camEnabled]);

  // ---- Screen share ----
  const startScreenShare = useCallback(async () => {
    if (screenSharing) return;

    const socket = getSocketSafe();
    if (!socket) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenTrackRef.current = screenTrack;

      // Replace video track in each sender
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Update local preview
      const local = localStreamRef.current;
      if (local) {
        // Remove old video tracks from local stream
        local.getVideoTracks().forEach((t) => local.removeTrack(t));
        local.addTrack(screenTrack);
        setLocalStream(local);
      }

      setScreenSharing(true);

      screenTrack.onended = () => {
        stopScreenShare();
      };

      if (channelIdRef.current) {
        socket.emit("huddle:screen-start", {
          channelId: channelIdRef.current,
        });
      }
    } catch (err) {
      console.error("startScreenShare error:", err);
    }
  }, [screenSharing]);

  const stopScreenShare = useCallback(() => {
    const socket = getSocketSafe();
    if (!socket) return;

    const cameraTrack = cameraVideoTrackRef.current;
    const screenTrack = screenTrackRef.current;

    if (!cameraTrack || !localStreamRef.current) {
      setScreenSharing(false);
      if (channelIdRef.current) {
        socket.emit("huddle:screen-stop", {
          channelId: channelIdRef.current,
        });
      }
      return;
    }

    // Replace back to camera track
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(cameraTrack);
      }
    });

    const local = localStreamRef.current;
    // Remove current video tracks
    local.getVideoTracks().forEach((t) => local.removeTrack(t));
    local.addTrack(cameraTrack);
    setLocalStream(local);

    if (screenTrack) {
      screenTrack.stop();
    }
    screenTrackRef.current = null;

    setScreenSharing(false);

    if (channelIdRef.current) {
      socket.emit("huddle:screen-stop", {
        channelId: channelIdRef.current,
      });
    }
  }, []);

  // ---- Handle incoming socket events ----
  useEffect(() => {
    const socket = getSocketSafe();
    if (!socket) return;

    const handleUserJoined = async ({ channelId, userId, username }) => {
      // Ignore if not our channel
      if (channelId !== channelIdRef.current) return;

      // If it's us, just update state (we already called joinCall)
      if (String(userId) === String(userRef.current.id)) {
        setRemotePeers((prev) => prev); // no-op, but keeps mental model clear
        return;
      }

      // Existing participant creates offer to new user
      if (!inCall) return; // we're not in call yet

      try {
        await initLocalMedia();
        const pc = createPeerConnection(userId);
        if (!pc) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("huddle:signal", {
          channelId: channelIdRef.current,
          to: userId,
          data: {
            type: "offer",
            sdp: offer.sdp,
          },
        });

        // ensure username stored
        setRemotePeers((prev) => {
          const existing = prev.find((p) => p.userId === userId);
          if (existing) return prev.map((p) =>
            p.userId === userId ? { ...p, username } : p
          );
          return [
            ...prev,
            {
              userId,
              username,
              stream: remoteStreamsRef.current[userId] || null,
              isMuted: false,
              isScreenSharing: false,
            },
          ];
        });
      } catch (err) {
        console.error("handleUserJoined error:", err);
      }
    };

    const handleUserLeft = ({ channelId, userId }) => {
      if (channelId !== channelIdRef.current) return;
      removeRemotePeer(userId);
    };

    const handleSignal = async ({ from, data, channelId }) => {
      if (channelId !== channelIdRef.current) return;
      if (String(from) === String(userRef.current.id)) return;

      const { type } = data;

      try {
        const pc = createPeerConnection(from);
        if (!pc) return;

        if (type === "offer") {
          await initLocalMedia();

          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: "offer",
              sdp: data.sdp,
            })
          );

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("huddle:signal", {
            channelId: channelIdRef.current,
            to: from,
            data: {
              type: "answer",
              sdp: answer.sdp,
            },
          });
        } else if (type === "answer") {
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: "answer",
              sdp: data.sdp,
            })
          );
        } else if (type === "candidate" && data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error("Error adding ICE candidate", e);
          }
        }
      } catch (err) {
        console.error("handleSignal error:", err);
      }
    };

    const handleMute = ({ userId }) => {
      updateRemotePeerMeta(userId, { isMuted: true });
    };

    const handleUnmute = ({ userId }) => {
      updateRemotePeerMeta(userId, { isMuted: false });
    };

    const handleScreenStart = ({ userId }) => {
      updateRemotePeerMeta(userId, { isScreenSharing: true });
    };

    const handleScreenStop = ({ userId }) => {
      updateRemotePeerMeta(userId, { isScreenSharing: false });
    };

    socket.on("huddle:user-joined", handleUserJoined);
    socket.on("huddle:user-left", handleUserLeft);
    socket.on("huddle:signal", handleSignal);
    socket.on("huddle:mute", handleMute);
    socket.on("huddle:unmute", handleUnmute);
    socket.on("huddle:screen-start", handleScreenStart);
    socket.on("huddle:screen-stop", handleScreenStop);

    return () => {
      socket.off("huddle:user-joined", handleUserJoined);
      socket.off("huddle:user-left", handleUserLeft);
      socket.off("huddle:signal", handleSignal);
      socket.off("huddle:mute", handleMute);
      socket.off("huddle:unmute", handleUnmute);
      socket.off("huddle:screen-start", handleScreenStart);
      socket.off("huddle:screen-stop", handleScreenStop);
    };
  }, [createPeerConnection, initLocalMedia, inCall, removeRemotePeer, updateRemotePeerMeta, updateRemotePeerStream]);

  useEffect(() => {
  const interval = setInterval(async () => {
    const pcs = Object.values(peerConnectionsRef.current);
    if (!pcs.length) return;

    const stats = await pcs[0].getStats();
    stats.forEach(report => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        const rtt = report.currentRoundTripTime || 0;

        if (rtt > 0.6) setNetworkQuality("poor");
        else if (rtt > 0.3) setNetworkQuality("ok");
        else setNetworkQuality("good");
      }
    });
  }, 3000);

  return () => clearInterval(interval);
}, []);

  // Clean up when unmounting or channel changes
  useEffect(() => {
    return () => {
      // full cleanup
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      remoteStreamsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
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
  };
}
