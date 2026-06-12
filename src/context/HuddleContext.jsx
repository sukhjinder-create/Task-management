// src/context/HuddleContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useHuddleCall } from "../hooks/useHuddleCall";
import { getSocket, joinHuddle as emitJoinHuddle } from "../socket";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

const HuddleContext = createContext(null);
const ACTIVE_HUDDLE_STORAGE_KEY = "asystence.activeHuddle.v1";
const ACTIVE_HUDDLE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const HUDDLE_PROVIDER_LIVEKIT = "livekit";
const HUDDLE_PROVIDER_MESH = "mesh";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function providerFromProviderLock(providerLock = {}) {
  const lock = providerLock || {};
  const provider = safeString(
    lock.effectiveProvider ||
    lock.lockedProvider ||
    lock.providerType ||
    lock.selectedProvider ||
    lock.provider
  ).toLowerCase();
  return provider === HUDDLE_PROVIDER_LIVEKIT || provider === HUDDLE_PROVIDER_MESH
    ? provider
    : null;
}

function normalizeHuddleProvider(value) {
  const provider = safeString(value).toLowerCase();
  return provider === HUDDLE_PROVIDER_LIVEKIT || provider === HUDDLE_PROVIDER_MESH
    ? provider
    : null;
}

function providerJoinOptions(huddle = {}) {
  const provider = normalizeHuddleProvider(huddle.provider);
  return provider ? { provider } : {};
}

function readStoredActiveHuddle(userId) {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_HUDDLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.huddle?.huddleId || !parsed?.huddle?.channelId) return null;
    if (parsed.participantUserId && String(parsed.participantUserId) !== String(userId)) return null;
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > ACTIVE_HUDDLE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(ACTIVE_HUDDLE_STORAGE_KEY);
      return null;
    }
    return parsed.huddle;
  } catch {
    return null;
  }
}

function writeStoredActiveHuddle(huddle, userId) {
  if (typeof window === "undefined") return;
  try {
    if (!huddle?.huddleId || !huddle?.channelId || !userId) {
      window.sessionStorage.removeItem(ACTIVE_HUDDLE_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(ACTIVE_HUDDLE_STORAGE_KEY, JSON.stringify({
      huddle,
      participantUserId: userId,
      savedAt: Date.now(),
    }));
  } catch {
    // Best-effort refresh continuity only.
  }
}

export function HuddleProvider({ children }) {
  const { auth } = useAuth();
  const user = auth?.user;

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [activeHuddle, setActiveHuddle] = useState(() => readStoredActiveHuddle(user?.id));
  const [incomingHuddle, setIncomingHuddle] = useState(() => {
    if (window.__PENDING_HUDDLE_INVITE__) {
      const invite = window.__PENDING_HUDDLE_INVITE__;
      window.__PENDING_HUDDLE_INVITE__ = null;
      return invite;
    }
    return null;
  });

  // Keep refs in sync so socket handlers always see the latest state
  // (avoids stale closures and race conditions between state update and next event)
  const activeHuddleRef = useRef(null);
  useEffect(() => { activeHuddleRef.current = activeHuddle; }, [activeHuddle]);

  const incomingHuddleRef = useRef(incomingHuddle);
  useEffect(() => { incomingHuddleRef.current = incomingHuddle; }, [incomingHuddle]);

  // ---------------------------
  // WebRTC Hook
  // ---------------------------
  const call = useHuddleCall({ currentUser: user });

  const publishActiveHuddle = useCallback((next) => {
    const resolved = typeof next === "function"
      ? next(activeHuddleRef.current)
      : next;
    activeHuddleRef.current = resolved || null;
    if (resolved?.channelId) call.setChannelId(resolved.channelId);
    if (resolved?.huddleId) call.setHuddleId(resolved.huddleId);
    writeStoredActiveHuddle(resolved, userRef.current?.id);
    setActiveHuddle(resolved || null);
  }, [call.setChannelId, call.setHuddleId]);

  useEffect(() => {
    if (!user?.id || activeHuddleRef.current) return;
    const stored = readStoredActiveHuddle(user.id);
    if (stored) publishActiveHuddle(stored);
  }, [user?.id, publishActiveHuddle]);

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
    call.startCall({
      channelId: activeHuddle.channelId,
      huddleId: activeHuddle.huddleId,
      sessionId: activeHuddle.sessionId || activeHuddle.huddleId,
      ...providerJoinOptions(activeHuddle),
    });
  }, [activeHuddle?.huddleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // 45-second ring timeout: auto-end if no one joins
  // ---------------------------
  const ringTimeoutRef = useRef(null);
  const answeredHuddleRef = useRef(null);
  useEffect(() => {
    if (!activeHuddle?.huddleId) {
      answeredHuddleRef.current = null;
      return;
    }
    if (call.remotePeers.length > 0) {
      answeredHuddleRef.current = activeHuddle.huddleId;
    }
  }, [activeHuddle?.huddleId, call.remotePeers.length]);

  useEffect(() => {
    clearTimeout(ringTimeoutRef.current);
    if (!call.inCall || call.remotePeers.length > 0) return;
    if (answeredHuddleRef.current === activeHuddleRef.current?.huddleId) return;

    ringTimeoutRef.current = setTimeout(() => {
      const huddle = activeHuddleRef.current;
      if (huddle && call.remotePeers.length === 0 && answeredHuddleRef.current !== huddle.huddleId) {
        toast.error("No one answered the call");
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit("huddle:end", { channelId: huddle.channelId, huddleId: huddle.huddleId });
        }
        activeHuddleRef.current = null;
        writeStoredActiveHuddle(null, userRef.current?.id);
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
    if (activeHuddleRef.current) {
      call.leaveCall();
    }
    // Immediately update refs so any concurrent socket events see correct state
    if (incomingHuddle.channelId) call.setChannelId(incomingHuddle.channelId);
    if (incomingHuddle.huddleId) call.setHuddleId(incomingHuddle.huddleId);
    activeHuddleRef.current = incomingHuddle;
    incomingHuddleRef.current = null;
    publishActiveHuddle(incomingHuddle);
    setIncomingHuddle(null);
  }, [incomingHuddle, call, publishActiveHuddle]);

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
      incomingHuddleRef.current = null;
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
    activeHuddleRef.current = null;
    writeStoredActiveHuddle(null, userRef.current?.id);
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
        activeHuddleRef.current = null;
        writeStoredActiveHuddle(null, userRef.current?.id);
        setActiveHuddle(null);
        call.leaveCall();
      }
    };
    socket.on("huddle:declined", onDeclined);
    return () => socket.off("huddle:declined", onDeclined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // Memoized rtc object exposed to UI — stable reference reduces re-renders
  // ---------------------------
  const rtc = useMemo(() => ({
    localStream: call.localStream,
    remotePeers: call.remotePeers,
    isMuted: !call.micEnabled,
    isCameraOff: !call.camEnabled,
    isScreenSharing: call.screenSharing,
    screenShareSupported: call.screenShareSupported !== false,
    backgroundEffectsSupported: call.backgroundEffectsSupported === true,
    backgroundEffectSupport: call.backgroundEffectSupport || null,
    backgroundEffect: call.backgroundEffect || { mode: "off", active: false },
    activeSpeakerId: call.activeSpeakerId,
    networkQuality: call.networkQuality,
    qualityMode: call.qualityMode || "auto",
    joined: call.inCall,
    connecting: call.connecting,
    error: call.error || "",
    toggleMute: call.toggleMic,
    toggleCamera: call.toggleCamera,
    startScreenShare: call.startScreenShare,
    stopScreenShare: call.stopScreenShare,
    setBackgroundEffect: call.setBackgroundEffect,
    setQualityMode: call.setQualityMode,
    joinHuddle: call.startCall,
    leaveHuddle: call.leaveCall,
    muteAll: call.muteAll,
    endHuddleForAll,
    subtitlesSupported: call.subtitlesSupported !== false,
    subtitlesEnabled: call.subtitlesEnabled,
    subtitles: call.subtitles,
    captionFeed: call.captionFeed || [],
    captionStatus: call.captionStatus || "idle",
    toggleSubtitles: call.toggleSubtitles,
  }), [
    call.localStream, call.remotePeers,
    call.micEnabled, call.camEnabled, call.screenSharing, call.screenShareSupported,
    call.backgroundEffectsSupported, call.backgroundEffectSupport, call.backgroundEffect,
    call.activeSpeakerId, call.networkQuality, call.qualityMode,
    call.inCall, call.connecting,
    call.toggleMic, call.toggleCamera,
    call.startScreenShare, call.stopScreenShare, call.setBackgroundEffect, call.setQualityMode,
    call.startCall, call.leaveCall, call.muteAll,
    call.subtitlesSupported, call.subtitlesEnabled, call.subtitles, call.captionFeed, call.captionStatus, call.toggleSubtitles,
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
      // Skip if we're already in this exact huddle or already showing this invite
      if (data.huddleId === activeHuddleRef.current?.huddleId) return;
      if (data.huddleId === incomingHuddleRef.current?.huddleId) return;
      const invite = {
        huddleId: data.huddleId,
        channelId: data.channelId,
        startedByName: data.startedByName || "Someone",
        startedBy: { userId: data.startedBy, username: data.startedByName || "Someone" },
      };
      incomingHuddleRef.current = invite;
      setIncomingHuddle(invite);
    };
    window.addEventListener("huddle:incoming", handler);
    return () => window.removeEventListener("huddle:incoming", handler);
  }, [user?.id]);

  // ---------------------------
  // SOCKET: listen for huddle start/end + chat notifications + huddle:sync on reconnect
  // Re-attaches on every auth:updated so a replaced socket is never orphaned.
  // ---------------------------
  useEffect(() => {
    let cleanup = () => {};

    function attach() {
      const socket = getSocket();
      // Clean up previous socket's listeners before attaching to the new one
      cleanup();
      cleanup = () => {};
      if (!socket) return;

      const onStarted = (payload) => {
        const startedById = payload.startedBy?.userId || payload.startedBy;
        const startedByName = payload.startedBy?.username || payload.startedByName || "Someone";
        const huddleData = {
          huddleId: payload.huddleId,
          channelId: payload.channelId,
          sessionId: payload.sessionId || payload.mediaSessionId || payload.huddleSessionId || payload.huddleId,
          provider: providerFromProviderLock(payload.providerLock) || normalizeHuddleProvider(payload.provider),
          providerLock: payload.providerLock || null,
          startedBy: { userId: startedById, username: startedByName },
          at: payload.at,
        };

        // Keep the active Huddle fresh across reconnect/sync events.
        if (huddleData.huddleId === activeHuddleRef.current?.huddleId) {
          publishActiveHuddle((prev) => ({ ...(prev || {}), ...huddleData }));
          return;
        }
        if (huddleData.huddleId === incomingHuddleRef.current?.huddleId) return;

        if (startedById && String(startedById) === String(userRef.current?.id)) {
          // We started this call — show video tiles
          publishActiveHuddle(huddleData);
        } else if (!activeHuddleRef.current) {
          // Someone else started — show invitation modal
          incomingHuddleRef.current = { ...huddleData, startedByName };
          setIncomingHuddle({ ...huddleData, startedByName });
        }
      };

      const onEnded = (payload) => {
        setActiveHuddle((prev) => {
          if (prev && payload.huddleId === prev.huddleId) {
            // Immediately clear the ref so subsequent onStarted events aren't blocked
            activeHuddleRef.current = null;
            writeStoredActiveHuddle(null, userRef.current?.id);
            call.leaveCall();
            return null;
          }
          return prev;
        });
        setIncomingHuddle((prev) => {
          if (prev && payload.huddleId === prev.huddleId) {
            incomingHuddleRef.current = null;
            return null;
          }
          return prev;
        });
      };

      const onError = (payload = {}) => {
        if (payload.action !== "huddle:start" && payload.action !== "huddle:join") return;

        const matches = (huddle) => (
          huddle &&
          (!payload.huddleId || payload.huddleId === huddle.huddleId) &&
          (!payload.channelId || payload.channelId === huddle.channelId)
        );

        if (matches(activeHuddleRef.current)) {
          activeHuddleRef.current = null;
          joinedHuddleRef.current = null;
          writeStoredActiveHuddle(null, userRef.current?.id);
          setActiveHuddle(null);
          call.leaveCall();
        }

        if (matches(incomingHuddleRef.current)) {
          incomingHuddleRef.current = null;
          setIncomingHuddle(null);
        }
      };

      // Emit huddle:sync immediately (backend will re-send any active invitation)
      const syncHuddle = () => {
        if (!socket.connected) return;
        socket.emit("huddle:sync");
        const huddle = activeHuddleRef.current;
        if (huddle?.channelId && huddle?.huddleId) {
          emitJoinHuddle(huddle.channelId, huddle.huddleId, providerJoinOptions(huddle));
        }
      };
      syncHuddle();
      socket.on("connect", syncHuddle);

      socket.on("huddle:started", onStarted);
      socket.on("huddle:ended", onEnded);
      socket.on("huddle:error", onError);

      cleanup = () => {
        socket.off("connect", syncHuddle);
        socket.off("huddle:started", onStarted);
        socket.off("huddle:ended", onEnded);
        socket.off("huddle:error", onError);
      };
    }

    // Re-attach every time auth:updated fires (socket.js replaces the socket instance)
    const onAuthUpdated = () => setTimeout(attach, 0);
    window.addEventListener("auth:updated", onAuthUpdated);
    attach(); // attach immediately for the current socket

    return () => {
      window.removeEventListener("auth:updated", onAuthUpdated);
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------
  // PROVIDER VALUE
  // ---------------------------
  return (
    <HuddleContext.Provider
      value={{
        activeHuddle,
        setActiveHuddle: publishActiveHuddle,
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
