// src/webrtc/huddleRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket";

/**
 * EXTENSION ADDITIONS:
 * - persistent state so huddle stays alive across navigation
 * - prevent auto cleanup when Chat unmounts
 * - fullscreen support for video tile
 * - visibility + tab switching protections
 * - keep WebRTC alive globally (not tied to Chat.jsx mount)
 */

const HUDDLE_STATE_KEY = "activeHuddleState";

export default function useHuddleWebRTC({ channelId, user, activeHuddle }) {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnectionsRef = useRef({});
  const peerStreamsRef = useRef({});
  const localStreamRef = useRef(null);
  const displayStreamRef = useRef(null);

  const currentHuddleIdRef = useRef(null);

  // 🔵 Prevent destroying the huddle when component unmounts
  const preventCleanupRef = useRef(true);

  // 🔵 Fullscreen video target ref
  const fullscreenTargetRef = useRef(null);

  // ----------------------------
  // Persistent Huddle (load)
  // ----------------------------
  useEffect(() => {
    const saved = localStorage.getItem(HUDDLE_STATE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.huddleId && parsed.channelId) {
          currentHuddleIdRef.current = parsed.huddleId;
        }
      } catch {}
    }
  }, []);

  // ----------------------------
  // Save active huddle persistently
  // ----------------------------
  useEffect(() => {
    if (activeHuddle && activeHuddle.huddleId) {
      localStorage.setItem(
        HUDDLE_STATE_KEY,
        JSON.stringify({
          huddleId: activeHuddle.huddleId,
          channelId: activeHuddle.channelId,
          startedBy: activeHuddle.startedBy,
        })
      );
    } else {
      localStorage.removeItem(HUDDLE_STATE_KEY);
    }
  }, [activeHuddle]);

  // ----------------------------
  // BACKGROUND / TAB PROTECTION
  // ----------------------------
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // DO NOT stop media
        // Just inform browser we want to keep audio alive
        document.title = "Huddle in progress…";
      } else {
        document.title = "TaskManager";
      }
    };

    const handleBeforeUnload = (e) => {
      if (joined) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [joined]);

  // ----------------------------
  // Fullscreen support
  // ----------------------------
  const requestFullscreen = () => {
    if (!fullscreenTargetRef.current) return;
    const el = fullscreenTargetRef.current;
    if (el.requestFullscreen) el.requestFullscreen();
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // ----------------------------
  // Media helpers
  // ----------------------------
  async function ensureLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOff(false);
      return stream;
    } catch (e) {
      setError("Could not access camera/mic.");
      throw e;
    }
  }

  function cleanupPeer(peerId) {
    const pc = peerConnectionsRef.current[peerId];
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      delete peerConnectionsRef.current[peerId];
    }
    const stream = peerStreamsRef.current[peerId];
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      delete peerStreamsRef.current[peerId];
    }
    setRemotePeers((prev) => prev.filter((p) => p.userId !== peerId));
  }

  // ----------------------------
  // GLOBAL cleanup (only when truly required)
  // ----------------------------
  function cleanupAll() {
    if (preventCleanupRef.current) return; // 🔵 do NOT clean if global huddle active

    Object.keys(peerConnectionsRef.current).forEach((id) =>
      cleanupPeer(id)
    );

    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setRemotePeers([]);
    setLocalStream(null);
    setJoined(false);
    setConnecting(false);
    setIsScreenSharing(false);

    currentHuddleIdRef.current = null;
  }

  // ----------------------------
  // PeerConnection creation
  // ----------------------------
  async function createPeerConnection(peerId, huddleId, isInitiator) {
    let pc = peerConnectionsRef.current[peerId];
    if (pc) return pc;

    const socket = getSocket();
    if (!socket) return;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnectionsRef.current[peerId] = pc;

    const signalChannel =
      (activeHuddle && activeHuddle.channelId) || channelId;

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit("huddle:signal", {
        channelId: signalChannel,
        huddleId,
        toUserId: peerId,
        data: {
          type: "candidate",
          fromUserId: user.id,
          candidate: event.candidate,
        },
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      peerStreamsRef.current[peerId] = stream;

      setRemotePeers((prev) => {
        const exists = prev.find((p) => p.userId === peerId);
        if (exists) {
          return prev.map((p) =>
            p.userId === peerId ? { ...p, stream } : p
          );
        }
        return [...prev, { userId: peerId, username: `User ${peerId}`, stream }];
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        cleanupPeer(peerId);
      }
    };

    const local = await ensureLocalStream();
    local.getTracks().forEach((t) => pc.addTrack(t, local));

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("huddle:signal", {
        channelId: signalChannel,
        huddleId,
        toUserId: peerId,
        data: {
          type: "offer",
          fromUserId: user.id,
          sdp: offer,
        },
      });
    }

    return pc;
  }

  // ----------------------------
  // Public
  // ----------------------------
  async function joinHuddle() {
    if (!activeHuddle || !activeHuddle.huddleId) return;

    setConnecting(true);
    preventCleanupRef.current = true;

    try {
      await ensureLocalStream();
      setJoined(true);
    } catch {}
    finally {
      setConnecting(false);
    }
  }

  function leaveHuddle() {
    preventCleanupRef.current = false; // allow cleanup for leave
    cleanupAll();
    localStorage.removeItem(HUDDLE_STATE_KEY);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setIsMuted(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isCameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setIsCameraOff(next);
  }

  async function startScreenShare() {
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
      displayStreamRef.current = ds;
      setIsScreenSharing(true);

      const track = ds.getVideoTracks()[0];

      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(track);
      });

      setLocalStream(ds);

      track.onended = stopScreenShare;
    } catch {
      setError("Screen share failed.");
    }
  }

  function stopScreenShare() {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }

    const local = localStreamRef.current;
    if (!local) return;

    const videoTrack = local.getVideoTracks()[0];
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender && videoTrack) sender.replaceTrack(videoTrack);
    });

    setIsScreenSharing(false);
    setLocalStream(localStreamRef.current);
  }

  // ----------------------------
  // Signaling listener
  // ----------------------------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handle = async (payload) => {
      const { channelId: ch, huddleId, fromUserId, toUserId, data } = payload;
      if (!data) return;

      const expectedChannel =
        (activeHuddle && activeHuddle.channelId) || channelId;

      if (ch !== expectedChannel) return;

      if (toUserId && String(toUserId) !== String(user.id)) return;

      const peerId = fromUserId;
      if (!peerId || String(peerId) === String(user.id)) return;

      try {
        if (data.type === "offer") {
          await ensureLocalStream();
          const pc =
            peerConnectionsRef.current[peerId] ||
            (await createPeerConnection(peerId, huddleId, false));

          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("huddle:signal", {
            channelId: expectedChannel,
            huddleId,
            toUserId: peerId,
            data: {
              type: "answer",
              fromUserId: user.id,
              sdp: answer,
            },
          });
        }

        if (data.type === "answer") {
          const pc = peerConnectionsRef.current[peerId];
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }

        if (data.type === "candidate") {
          const pc = peerConnectionsRef.current[peerId];
          if (!pc) return;
          if (data.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      } catch (err) {
        console.error("Signaling error:", err);
        setError("Connection problem.");
      }
    };

    socket.on("huddle:signal", handle);

    return () => {
      socket.off("huddle:signal", handle);
      // ❗ DON'T CLEAN STREAMS HERE — huddle must persist globally
    };
  }, [channelId, activeHuddle, user.id, joined]);

  // ----------------------------
  // Return API
  // ----------------------------
  return {
    joined,
    connecting,
    error,
    localStream,
    remotePeers,
    isMuted,
    isCameraOff,
    isScreenSharing,

    joinHuddle,
    leaveHuddle,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,

    requestFullscreen,
    exitFullscreen,

    fullscreenTargetRef,
  };
}
