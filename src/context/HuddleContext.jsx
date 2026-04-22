// src/context/HuddleContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useHuddleCall } from "../hooks/useHuddleCall";
import { getSocket } from "../socket";
import { useAuth } from "./AuthContext";

const HuddleContext = createContext(null);

const HUDDLE_STATE_KEY = "activeHuddleState";

export function HuddleProvider({ children }) {
  const { auth } = useAuth();
  const user = auth?.user;

  const [activeHuddle, setActiveHuddle] = useState(null);
  const [incomingHuddle, setIncomingHuddle] = useState(null); // pending invite

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
  // Decline incoming huddle invite
  // ---------------------------
  const declineHuddle = useCallback(() => {
    setIncomingHuddle(null);
  }, []);

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
  // SOCKET: listen for huddle start/end
  // ---------------------------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

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
      if (String(startedById) === String(user?.id)) {
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
