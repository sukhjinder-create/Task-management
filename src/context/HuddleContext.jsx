// src/context/HuddleContext.jsx
import { createContext, useContext, useState, useEffect, useRef } from "react";
import useHuddleWebRTC from "../webrtc/huddleRTC";
import { getSocket } from "../socket";
import { useAuth } from "./AuthContext";

const HuddleContext = createContext(null);

// KEY for saved ongoing huddle (restores even after refresh)
const HUDDLE_STATE_KEY = "activeHuddleState";

export function HuddleProvider({ children }) {
  const { auth } = useAuth();
  const user = auth?.user;

  const [activeHuddle, setActiveHuddle] = useState(null);

  // Stores the REAL channel used by WebRTC (because you may navigate anywhere)
  const currentChannelIdRef = useRef(null);

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
          currentChannelIdRef.current = parsed.channelId;
        }
      }
    } catch (e) {
      console.error("Failed to restore huddle:", e);
    }
  }, []);

  // ---------------------------
  // WebRTC Hook — completely global
  // ---------------------------
  const rtc = useHuddleWebRTC({
    channelId: currentChannelIdRef.current,
    user,
    activeHuddle,
  });

  // ---------------------------
  // Persist huddle state always
  // ---------------------------
  useEffect(() => {
    if (activeHuddle?.huddleId) {
      localStorage.setItem(HUDDLE_STATE_KEY, JSON.stringify(activeHuddle));
    } else {
      localStorage.removeItem(HUDDLE_STATE_KEY);
    }
  }, [activeHuddle]);

  // ---------------------------
  // SOCKET: listen for huddle start/end
  // ---------------------------
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // When someone starts a huddle
    const onStarted = (payload) => {
      setActiveHuddle({
        huddleId: payload.huddleId,
        channelId: payload.channelId,
        startedBy: payload.startedBy,
        at: payload.at,
      });
      currentChannelIdRef.current = payload.channelId;
    };

    // When someone ends a huddle
    const onEnded = (payload) => {
      if (!activeHuddle) return;

      if (payload.huddleId === activeHuddle.huddleId) {
        setActiveHuddle(null);
        rtc.leaveHuddle();
      }
    };

    socket.on("huddle:started", onStarted);
    socket.on("huddle:ended", onEnded);

    return () => {
      socket.off("huddle:started", onStarted);
      socket.off("huddle:ended", onEnded);
    };
  }, [activeHuddle, rtc]);

  // ---------------------------
  // Chat page tells us which channel we are focusing
  // ---------------------------
  const setChannelForHuddle = (channelId) => {
    currentChannelIdRef.current = channelId;
  };

  // ---------------------------
  // PROVIDER VALUE
  // ---------------------------
  return (
    <HuddleContext.Provider
      value={{
        activeHuddle,
        setActiveHuddle,
        rtc,
        setChannelForHuddle,
      }}
    >
      {children}
    </HuddleContext.Provider>
  );
}

export function useHuddle() {
  return useContext(HuddleContext);
}
