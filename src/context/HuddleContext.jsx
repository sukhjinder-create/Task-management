// src/context/HuddleContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useHuddleCall } from "../hooks/useHuddleCall";
import { getSocket } from "../socket";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

const HuddleContext = createContext(null);

const HUDDLE_STATE_KEY = "activeHuddleState";

export function HuddleProvider({ children }) {
  const { auth } = useAuth();
  const user = auth?.user;

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [activeHuddle, setActiveHuddle] = useState(null);
  const [incomingHuddle, setIncomingHuddle] = useState(() => {
    // Restore pending huddle invite if app was opened from a killed-state notification
    if (window.__PENDING_HUDDLE_INVITE__) {
      const invite = window.__PENDING_HUDDLE_INVITE__;
      window.__PENDING_HUDDLE_INVITE__ = null;
      return invite;
    }
    return null;
  });

  // ---------------------------
  // Load persistent huddle at startup
  // ---------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HUDDLE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.huddleId && parsed?.channelId) {
          setActiveHuddle(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to restore huddle:", e);
    }
  }, []);

  // ---------------------------
  // WebRTC Hook
  // ---------------------------
  const call = useHuddleCall({ currentUser: user });

  // Keep channelId and huddleId refs in sync with active huddle
  useEffect(() => {
    if (activeHuddle?.channelId) {
      call.setChannelId(activeHuddle.channelId);
    }
    if (activeHuddle?.huddleId) {
      call.setHuddleId(activeHuddle.huddleId);
    }
  }, [activeHuddle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Join call when a huddle becomes active — only once per huddleId
  const joinedHuddleRef = useRef(null);
  useEffect(() => {
    if (!activeHuddle?.huddleId) return;
    if (joinedHuddleRef.current === activeHuddle.huddleId) return;
    joinedHuddleRef.current = activeHuddle.huddleId;
    call.startCall();
  }, [activeHuddle?.huddleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // Persist huddle state
  // ---------------------------
  useEffect(() => {
    if (activeHuddle?.huddleId) {
      localStorage.setItem(HUDDLE_STATE_KEY, JSON.stringify(activeHuddle));
    } else {
      localStorage.removeItem(HUDDLE_STATE_KEY);
      joinedHuddleRef.current = null;
    }
  }, [activeHuddle]);

  // ---------------------------
  // Accept incoming huddle invite
  // ---------------------------
  const acceptHuddle = useCallback(() => {
    if (!incomingHuddle) return;
    setActiveHuddle(incomingHuddle);
    setIncomingHuddle(null);
  }, [incomingHuddle]);

  // ---------------------------
  // Decline incoming huddle invite — notify initiator via socket
  // ---------------------------
  const declineHuddle = useCallback(() => {
    if (incomingHuddle) {
      const socket = getSocket();
      socket?.emit("huddle:decline", {
        channelId: incomingHuddle.channelId,
        huddleId: incomingHuddle.huddleId,
        initiatorUserId: incomingHuddle.startedBy,
      });
    }
    setIncomingHuddle(null);
  }, [incomingHuddle]);

  // ---------------------------
  // End huddle for all (host action)
  // ---------------------------
  const endHuddleForAll = useCallback(() => {
    const socket = getSocket();
    if (!socket || !activeHuddle) return;
    socket.emit("huddle:end", {
      channelId: activeHuddle.channelId,
      huddleId: activeHuddle.huddleId,
    });
    setActiveHuddle(null);
    call.leaveCall();
  }, [activeHuddle, call]);

  // ---------------------------
  // Listen for huddle:declined — the person we called declined the invite.
  // Show a toast and, since this is a 1-on-1 (no other participants joined),
  // end the huddle for the initiator automatically.
  // ---------------------------
  useEffect(() => {
    let socket = getSocket();
    if (!socket) return;
    const onDeclined = (payload) => {
      const name = payload.declinedBy?.username || "Someone";
      toast.error(`${name} declined the call`);
      // If no remote peers have joined, end for self
      if (call.remotePeers.length === 0) {
        setActiveHuddle(null);
        call.leaveCall();
      }
    };
    socket.on("huddle:declined", onDeclined);
    return () => socket.off("huddle:declined", onDeclined);
  }, [call]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // Auto-end 1-on-1: when the last remote peer leaves, close for self too.
  // ---------------------------
  const hadPeersRef = useRef(false);
  useEffect(() => {
    if (!call.inCall) { hadPeersRef.current = false; return; }
    if (call.remotePeers.length > 0) { hadPeersRef.current = true; return; }
    if (hadPeersRef.current) {
      hadPeersRef.current = false;
      setActiveHuddle(null);
      call.leaveCall();
    }
  }, [call.inCall, call.remotePeers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // rtc object exposed to UI
  // ---------------------------
  const rtc = {
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
  };

  // ---------------------------
  // Listen for huddle:incoming from push notification (foreground/background)
  // ---------------------------
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (!data?.huddleId || !data?.channelId) return;
      if (String(data.startedBy) === String(userRef.current?.id)) return; // ignore self
      setIncomingHuddle({
        huddleId: data.huddleId,
        channelId: data.channelId,
        startedByName: data.startedByName || "Someone",
        startedBy: data.startedBy,
      });
    };
    window.addEventListener("huddle:incoming", handler);
    return () => window.removeEventListener("huddle:incoming", handler);
  }, [user?.id]);

  // ---------------------------
  // SOCKET: listen for huddle start/end
  // ---------------------------
  useEffect(() => {
    let socket = getSocket();
    // Retry if socket not ready yet (race with auth init)
    if (!socket) {
      const t = setTimeout(() => {
        socket = getSocket();
        if (socket) attach(socket);
      }, 1000);
      return () => clearTimeout(t);
    }
    return attach(socket);

    function attach(socket) {
    const onStarted = (payload) => {
      const startedById = payload.startedBy?.userId || payload.startedBy;
      const startedByName = payload.startedBy?.username || payload.startedByName || "Someone";
      const huddleData = {
        huddleId: payload.huddleId,
        channelId: payload.channelId,
        startedBy: startedById,
        startedByName,
        at: payload.at,
      };
      // If current user started it, join immediately; otherwise show invite
      if (String(startedById) === String(userRef.current?.id)) {
        setActiveHuddle(huddleData);
      } else {
        setIncomingHuddle(huddleData);
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
    };

    socket.on("huddle:started", onStarted);
    socket.on("huddle:ended", onEnded);

    return () => {
      socket.off("huddle:started", onStarted);
      socket.off("huddle:ended", onEnded);
    };
    } // end attach
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
