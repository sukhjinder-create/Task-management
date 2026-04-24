// src/context/HuddleContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useHuddleCall } from "../hooks/useHuddleCall";
import { getSocket } from "../socket";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

const HuddleContext = createContext(null);

export function HuddleProvider({ children }) {
  const { auth } = useAuth();
  const user = auth?.user;

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [activeHuddle, setActiveHuddle] = useState(null);
  const [incomingHuddle, setIncomingHuddle] = useState(() => {
    if (window.__PENDING_HUDDLE_INVITE__) {
      const invite = window.__PENDING_HUDDLE_INVITE__;
      window.__PENDING_HUDDLE_INVITE__ = null;
      return invite;
    }
    return null;
  });

  // Track active huddle in a ref so socket handlers always see the current value
  const activeHuddleRef = useRef(null);
  useEffect(() => { activeHuddleRef.current = activeHuddle; }, [activeHuddle]);

  // ---------------------------
  // WebRTC Hook
  // ---------------------------
  const call = useHuddleCall({ currentUser: user });

  // Keep channelId and huddleId refs in sync with active huddle
  useEffect(() => {
    if (activeHuddle?.channelId) call.setChannelId(activeHuddle.channelId);
    if (activeHuddle?.huddleId) call.setHuddleId(activeHuddle.huddleId);
  }, [activeHuddle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Join call when a huddle becomes active — only once per huddleId
  const joinedHuddleRef = useRef(null);
  useEffect(() => {
    if (!activeHuddle?.huddleId) {
      joinedHuddleRef.current = null;
      return;
    }
    if (joinedHuddleRef.current === activeHuddle.huddleId) return;
    joinedHuddleRef.current = activeHuddle.huddleId;
    call.startCall();
  }, [activeHuddle?.huddleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // 45-second ring timeout: auto-end if no one joins
  // ---------------------------
  const ringTimeoutRef = useRef(null);
  useEffect(() => {
    clearTimeout(ringTimeoutRef.current);
    if (!call.inCall || call.remotePeers.length > 0) return;

    ringTimeoutRef.current = setTimeout(() => {
      const huddle = activeHuddleRef.current;
      if (huddle && call.remotePeers.length === 0) {
        toast.error("No one answered the call");
        // Properly end the huddle in DB so the next call can start
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit("huddle:end", { channelId: huddle.channelId, huddleId: huddle.huddleId });
        }
        setActiveHuddle(null);
        call.leaveCall();
      }
    }, 45000);

    return () => clearTimeout(ringTimeoutRef.current);
  }, [call.inCall, call.remotePeers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // Accept incoming huddle invite
  // ---------------------------
  const acceptHuddle = useCallback(() => {
    if (!incomingHuddle) return;
    // Leave any existing active huddle before joining a new one
    if (activeHuddleRef.current) {
      call.leaveCall();
    }
    setActiveHuddle(incomingHuddle);
    setIncomingHuddle(null);
  }, [incomingHuddle, call]);

  // ---------------------------
  // Decline incoming huddle invite — notify initiator via socket
  // ---------------------------
  const declineHuddle = useCallback(() => {
    if (incomingHuddle) {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit("huddle:decline", {
          channelId: incomingHuddle.channelId,
          huddleId: incomingHuddle.huddleId,
          initiatorUserId: incomingHuddle.startedBy?.userId || incomingHuddle.startedBy,
        });
      }
    }
    setIncomingHuddle(null);
  }, [incomingHuddle]);

  // ---------------------------
  // End huddle for all (host action)
  // ---------------------------
  const endHuddleForAll = useCallback(() => {
    const socket = getSocket();
    const huddle = activeHuddleRef.current;
    if (!socket || !huddle) return;
    socket.emit("huddle:end", {
      channelId: huddle.channelId,
      huddleId: huddle.huddleId,
    });
    setActiveHuddle(null);
    call.leaveCall();
  }, [call]);

  // ---------------------------
  // Stable ref for remotePeers count — avoids stale closures in socket handlers
  // ---------------------------
  const remotePeersLengthRef = useRef(0);
  useEffect(() => { remotePeersLengthRef.current = call.remotePeers.length; }, [call.remotePeers.length]);

  // ---------------------------
  // Listen for huddle:declined — the person we called declined the invite
  // ---------------------------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onDeclined = (payload) => {
      const name = payload.declinedBy?.username || "Someone";
      toast.error(`${name} declined the call`);
      if (remotePeersLengthRef.current === 0) {
        setActiveHuddle(null);
        call.leaveCall();
      }
    };
    socket.on("huddle:declined", onDeclined);
    return () => socket.off("huddle:declined", onDeclined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // Auto-end 1-on-1: when the last remote peer leaves, close for self too
  // ---------------------------
  const hadPeersRef = useRef(false);
  useEffect(() => {
    if (!call.inCall) { hadPeersRef.current = false; return; }
    if (call.remotePeers.length > 0) { hadPeersRef.current = true; return; }
    if (hadPeersRef.current) {
      hadPeersRef.current = false;
      // Emit huddle:end so the DB record is cleared (prevents stale huddle on next start)
      const huddle = activeHuddleRef.current;
      const socket = getSocket();
      if (huddle && socket?.connected) {
        socket.emit("huddle:end", { channelId: huddle.channelId, huddleId: huddle.huddleId });
      }
      setActiveHuddle(null);
      call.leaveCall();
    }
  }, [call.inCall, call.remotePeers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // Memoized rtc object exposed to UI — stable reference reduces re-renders
  // ---------------------------
  const rtc = useMemo(() => ({
    localStream: call.localStream,
    remotePeers: call.remotePeers,
    isMuted: !call.micEnabled,
    isCameraOff: !call.camEnabled,
    isScreenSharing: call.screenSharing,
    activeSpeakerId: call.activeSpeakerId,
    networkQuality: call.networkQuality,
    // Legacy Chat.jsx fields
    joined: call.inCall,
    connecting: call.connecting,
    error: "",
    toggleMute: call.toggleMic,
    toggleCamera: call.toggleCamera,
    startScreenShare: call.startScreenShare,
    stopScreenShare: call.stopScreenShare,
    joinHuddle: call.startCall,
    leaveHuddle: call.leaveCall,
    muteAll: call.muteAll,
    endHuddleForAll,
    // Subtitles
    subtitlesEnabled: call.subtitlesEnabled,
    subtitles: call.subtitles,
    toggleSubtitles: call.toggleSubtitles,
  }), [
    call.localStream, call.remotePeers,
    call.micEnabled, call.camEnabled, call.screenSharing,
    call.activeSpeakerId, call.networkQuality,
    call.inCall, call.connecting,
    call.toggleMic, call.toggleCamera,
    call.startScreenShare, call.stopScreenShare,
    call.startCall, call.leaveCall, call.muteAll,
    call.subtitlesEnabled, call.subtitles, call.toggleSubtitles,
    endHuddleForAll,
  ]);

  // ---------------------------
  // Listen for huddle:incoming from push notification (foreground/background)
  // ---------------------------
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (!data?.huddleId || !data?.channelId) return;
      if (String(data.startedBy) === String(userRef.current?.id)) return;
      setIncomingHuddle({
        huddleId: data.huddleId,
        channelId: data.channelId,
        startedByName: data.startedByName || "Someone",
        startedBy: { userId: data.startedBy, username: data.startedByName || "Someone" },
      });
    };
    window.addEventListener("huddle:incoming", handler);
    return () => window.removeEventListener("huddle:incoming", handler);
  }, [user?.id]);

  // ---------------------------
  // SOCKET: listen for huddle start/end
  // ---------------------------
  useEffect(() => {
    let detach = null;
    let authUpdatedListener = null;

    function attach(socket) {
      const onStarted = (payload) => {
        const startedById = payload.startedBy?.userId || payload.startedBy;
        const startedByName = payload.startedBy?.username || payload.startedByName || "Someone";
        const huddleData = {
          huddleId: payload.huddleId,
          channelId: payload.channelId,
          startedBy: { userId: startedById, username: startedByName },
          at: payload.at,
        };

        if (String(startedById) === String(userRef.current?.id)) {
          setActiveHuddle(huddleData);
        } else if (!activeHuddleRef.current) {
          setIncomingHuddle({ ...huddleData, startedByName: startedByName });
        }
      };

      const onEnded = (payload) => {
        setActiveHuddle((prev) => {
          if (prev && payload.huddleId === prev.huddleId) {
            call.leaveCall();
            return null;
          }
          return prev;
        });
        setIncomingHuddle((prev) => {
          if (prev && payload.huddleId === prev.huddleId) return null;
          return prev;
        });
      };

      socket.on("huddle:started", onStarted);
      socket.on("huddle:ended", onEnded);

      return () => {
        socket.off("huddle:started", onStarted);
        socket.off("huddle:ended", onEnded);
      };
    }

    function tryAttach() {
      const socket = getSocket();
      if (!socket || detach) return;
      detach = attach(socket);
      if (authUpdatedListener) {
        window.removeEventListener("auth:updated", authUpdatedListener);
        authUpdatedListener = null;
      }
    }

    tryAttach();
    if (!detach) {
      authUpdatedListener = () => tryAttach();
      window.addEventListener("auth:updated", authUpdatedListener);
    }

    return () => {
      if (authUpdatedListener) window.removeEventListener("auth:updated", authUpdatedListener);
      if (detach) detach();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // PROVIDER VALUE
  // ---------------------------
  return (
    <HuddleContext.Provider
      value={{
        activeHuddle,
        setActiveHuddle,
        incomingHuddle,
        acceptHuddle,
        declineHuddle,
        rtc,
        currentUser: user,
      }}
    >
      {children}
    </HuddleContext.Provider>
  );
}

export function useHuddle() {
  return useContext(HuddleContext);
}
