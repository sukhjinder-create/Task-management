// src/webrtc/huddleRTC.js
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket";

/**
 * useHuddleWebRTC (global-safe)
 *
 * - Stable getUserMedia (no camera blinking)
 * - Proper cleanup of PeerConnections + media tracks
 * - Screen share support
 * - Fullscreen support (for outer UI to use)
 * - "End" behaviour: ends huddle for EVERYONE (Option 1)
 */

const HUDDLE_STATE_KEY = "activeHuddleState";

export default function useHuddleWebRTC({ channelId, user, activeHuddle }) {
  // ------------------------
  // FIX: null-safety variables (avoid direct user.id access when user is null)
  // ------------------------
  const safeUserId = user?.id ?? null; // FIX: null-safety
  const safeUsername = user?.username ?? null; // FIX: null-safety
  const safeActiveChannel = activeHuddle?.channelId ?? null; // FIX
  const safeActiveHuddleId = activeHuddle?.huddleId ?? null; // FIX

  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState([]); // [{ userId, username, stream }]

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnectionsRef = useRef({});
  const peerStreamsRef = useRef({});
  const localStreamRef = useRef(null); // always the *camera* stream when available
  const displayStreamRef = useRef(null); // screen-share stream

  const currentHuddleIdRef = useRef(null);

  // Fullscreen DOM target (outer UI will attach this to the video container)
  const fullscreenTargetRef = useRef(null);

  // ───────────────────────────────────────────
  // Persist basic huddle info (for possible rejoin UX)
  // ───────────────────────────────────────────
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
      currentHuddleIdRef.current = activeHuddle.huddleId;
    } else {
      localStorage.removeItem(HUDDLE_STATE_KEY);
      currentHuddleIdRef.current = null;
    }
  }, [activeHuddle]);

  // ───────────────────────────────────────────
  // Tab / visibility helpers (no media stop)
  // ───────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && joined) {
        document.title = "Huddle in progress…";
      } else {
        document.title = "TaskManager";
      }
    };

    const handleBeforeUnload = (e) => {
      if (joined) {
        // Warn user if they try to close / refresh while in huddle
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

  // ───────────────────────────────────────────
  // Fullscreen helpers
  // ───────────────────────────────────────────
  const requestFullscreen = () => {
    const el = fullscreenTargetRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // ───────────────────────────────────────────
  // Media helpers
  // ───────────────────────────────────────────

  /**
   * Ensure we have a single, stable camera+mic stream.
   * We only re-acquire if:
   * - there is no stream, or
   * - all video tracks are ended.
   */
  async function ensureLocalStream() {
    const existing = localStreamRef.current;

    if (existing) {
      const hasLiveVideo = existing
        .getVideoTracks()
        .some((t) => t.readyState === "live");
      const hasLiveAudio = existing
        .getAudioTracks()
        .some((t) => t.readyState === "live");

      if (hasLiveVideo || hasLiveAudio) {
        // reuse existing stream, NO blinking
        setLocalStream(existing);
        return existing;
      }
    }

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
      console.error("getUserMedia failed", e);
      setError("Could not access camera/mic. Check permissions.");
      throw e;
    }
  }

  function cleanupPeer(peerId) {
    const pc = peerConnectionsRef.current[peerId];
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try {
        pc.close();
      } catch (e) {
        console.warn("Error closing peerConnection", e);
      }
      delete peerConnectionsRef.current[peerId];
    }

    const stream = peerStreamsRef.current[peerId];
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      delete peerStreamsRef.current[peerId];
    }

    setRemotePeers((prev) => prev.filter((p) => p.userId !== peerId));
  }

  function cleanupAll() {
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
    setIsMuted(false);
    setIsCameraOff(false);

    currentHuddleIdRef.current = null;
  }

  // ───────────────────────────────────────────
  // PeerConnection creation
  // ───────────────────────────────────────────
  async function createPeerConnection(peerId, huddleId, isInitiator) {
    let pc = peerConnectionsRef.current[peerId];
    if (pc) return pc;

    const socket = getSocket();
    if (!socket) return null;

    pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnectionsRef.current[peerId] = pc;

    // FIX: use safe channel (avoid referencing activeHuddle.channelId directly)
    const signalChannel =
      safeActiveChannel || channelId;

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      if (!signalChannel) return;

      socket.emit("huddle:signal", {
        channelId: signalChannel,
        huddleId,
        toUserId: peerId,
        data: {
          type: "candidate",
          fromUserId: safeUserId, // FIX: use safeUserId
          candidate: event.candidate,
        },
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      peerStreamsRef.current[peerId] = stream;

      setRemotePeers((prev) => {
        const existing = prev.find((p) => p.userId === peerId);
        if (existing) {
          return prev.map((p) =>
            p.userId === peerId ? { ...p, stream } : p
          );
        }
        return [
          ...prev,
          { userId: peerId, username: `User ${peerId}`, stream },
        ];
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "disconnected") {
        cleanupPeer(peerId);
      }
    };

    // Attach local tracks ONCE
    const local = await ensureLocalStream();
    local.getTracks().forEach((track) => {
      pc.addTrack(track, local);
    });

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (!signalChannel) return pc;

      socket.emit("huddle:signal", {
        channelId: signalChannel,
        huddleId,
        toUserId: peerId,
        data: {
          type: "offer",
          fromUserId: safeUserId, // FIX
          sdp: offer,
        },
      });
    }

    return pc;
  }

  // ───────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────
  async function joinHuddle() {
    if (!activeHuddle || !activeHuddle.huddleId) return;
    if (joined || connecting) return;

    setError("");
    setConnecting(true);
    currentHuddleIdRef.current = activeHuddle.huddleId;

    try {
      await ensureLocalStream();
      setJoined(true);
    } catch {
      // error already set in ensureLocalStream
    } finally {
      setConnecting(false);
    }
  }

  /**
   * Leave + END huddle for EVERYONE (Option 1)
   * - emits "huddle:end" to server
   * - server should broadcast "huddle:ended"
   * - HuddleContext listens to that and clears activeHuddle
   */
  function leaveHuddle() {
    const socket = getSocket();
    if (socket && activeHuddle && activeHuddle.huddleId) {
      socket.emit("huddle:end", {
        channelId: activeHuddle.channelId || channelId,
        huddleId: activeHuddle.huddleId,
        endedBy: { userId: safeUserId, username: safeUsername }, // FIX
      });
    }

    cleanupAll();
    localStorage.removeItem(HUDDLE_STATE_KEY);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !isCameraOff;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !nextOff;
    });
    setIsCameraOff(nextOff);
  }

  async function startScreenShare() {
    if (!joined) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      displayStreamRef.current = displayStream;
      setIsScreenSharing(true);

      const screenTrack = displayStream.getVideoTracks()[0];

      // Replace outgoing video track with screen
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender && screenTrack) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Show screen in local preview
      setLocalStream(displayStream);

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (e) {
      console.error("Screen share failed", e);
      setError("Screen share failed or was cancelled.");
    }
  }

  function stopScreenShare() {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }

    const cameraStream = localStreamRef.current;
    if (!cameraStream) {
      setIsScreenSharing(false);
      return;
    }

    const videoTrack = cameraStream.getVideoTracks()[0];
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    });

    // Show camera in local preview again
    setLocalStream(cameraStream);
    setIsScreenSharing(false);
  }

  // ───────────────────────────────────────────
  // Signaling listener
  // ───────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSignal = async (payload = {}) => {
      const { channelId: ch, huddleId, fromUserId, toUserId, data } =
        payload;
      if (!data) return;

      const expectedChannel =
        (activeHuddle && activeHuddle.channelId) || channelId;
      if (!expectedChannel || ch !== expectedChannel) return;

      // FIX: compare using safeUserId to avoid reading user.id when user is null
      if (toUserId && String(toUserId) !== String(safeUserId)) return;

      const peerId = fromUserId;
      if (!peerId || String(peerId) === String(safeUserId)) return;

      try {
        if (data.type === "offer") {
          await ensureLocalStream();

          const pc =
            peerConnectionsRef.current[peerId] ||
            (await createPeerConnection(
              peerId,
              huddleId || currentHuddleIdRef.current,
              false
            ));

          if (!pc) return;

          await pc.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("huddle:signal", {
            channelId: expectedChannel,
            huddleId: huddleId || currentHuddleIdRef.current,
            toUserId: peerId,
            data: {
              type: "answer",
              fromUserId: safeUserId, // FIX
              sdp: answer,
            },
          });
        } else if (data.type === "answer") {
          const pc = peerConnectionsRef.current[peerId];
          if (!pc) return;
          await pc.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
        } else if (data.type === "candidate") {
          const pc = peerConnectionsRef.current[peerId];
          if (!pc) return;
          if (data.candidate) {
            await pc.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          }
        }
      } catch (e) {
        console.error("Signaling error", e);
        setError("Connection problem in huddle.");
      }
    };

    socket.on("huddle:signal", handleSignal);

    return () => {
      socket.off("huddle:signal", handleSignal);
      // cleanupAll is NOT called here; HuddleProvider is global.
    };
  // FIX: use safeUserId in dependencies instead of user.id
  }, [channelId, activeHuddle, safeUserId]);

  // ───────────────────────────────────────────
  // Return API
  // ───────────────────────────────────────────
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
    leaveHuddle, // ends huddle for everyone (Option 1)
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,

    requestFullscreen,
    exitFullscreen,
    fullscreenTargetRef,
  };
}
