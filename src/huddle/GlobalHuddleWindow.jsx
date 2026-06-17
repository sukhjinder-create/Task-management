// src/huddle/GlobalHuddleWindow.jsx
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useHuddle } from "../context/HuddleContext";
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Maximize2, Minimize2, VolumeX, Captions,
  BookOpenText, Gauge, Image, Sparkles, X, ArrowDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../api";
import { preloadBackgroundEffects } from "./media/BackgroundEffects";
import {
  clearLiveKitRenderTarget,
  updateLiveKitRenderTarget,
} from "./media/LiveKitRenderTarget";

const CURATED_HUDDLE_BACKGROUNDS = [
  {
    label: "Modern office",
    path: "/huddle-backgrounds/office-premium.jpg",
  },
  {
    label: "Conference room",
    path: "/huddle-backgrounds/conference-room-premium.jpg",
  },
  {
    label: "Executive office",
    path: "/huddle-backgrounds/executive-office-premium.jpg",
  },
  {
    label: "Enterprise abstract",
    path: "/huddle-backgrounds/enterprise-abstract-premium.jpg",
  },
];

// ── Call timer ──────────────────────────────────────────────────────────────
function useCallTimer(startedAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const base = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - base) / 1000));
    const initial = window.setTimeout(update, 0);
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [startedAt]);
  const h = Math.floor(elapsed / 3600);
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function captionTime(value) {
  const timestamp = value ? new Date(value) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) return "";
  return timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanSpeakerLabel(value) {
  const label = String(value || "").trim();
  if (!label || /^participant(?:\s+\d+)?$/i.test(label)) return "";
  return label;
}

// ── Build a video ref that forces the muted HTML attribute ───────────────────
// React has a known bug: <video muted={true}> sets video.muted = true (JS
// property) but does NOT add the `muted` HTML attribute to the DOM. Android
// WebView checks the HTML attribute specifically when deciding whether to allow
// autoplay — without it the video is treated as unmuted → autoplay blocked.
// Viewport helpers keep the mobile call window and controls inside the screen.
function getViewportSize() {
  if (typeof window === "undefined") return { w: 390, h: 844 };
  const visualViewport = window.visualViewport;
  return {
    w: Math.round(visualViewport?.width || window.innerWidth || 390),
    h: Math.round(visualViewport?.height || window.innerHeight || 844),
  };
}

function isMobileViewport() {
  return getViewportSize().w < 768;
}

function getFullWindowLayout() {
  const viewport = getViewportSize();
  return { pos: { x: 0, y: 0 }, size: { w: viewport.w, h: viewport.h } };
}

function getDesktopDefaultLayout() {
  const viewport = getViewportSize();
  const maxW = Math.max(720, viewport.w - 32);
  const maxH = Math.max(420, viewport.h - 56);
  const w = Math.min(Math.max(880, Math.round(viewport.w * 0.72)), maxW);
  const h = Math.min(Math.max(560, Math.round(viewport.h * 0.72)), maxH);
  const size = {
    w,
    h,
  };
  return {
    pos: {
      x: Math.max(16, Math.round((viewport.w - size.w) / 2)),
      y: Math.max(16, Math.round((viewport.h - size.h) / 2)),
    },
    size,
  };
}

function getMobileCompactLayout() {
  const viewport = getViewportSize();
  const w = Math.min(Math.max(300, viewport.w - 16), 380);
  const h = Math.min(Math.max(280, Math.round(viewport.h * 0.42)), viewport.h - 16);
  return {
    pos: {
      x: Math.max(8, viewport.w - w - 8),
      y: Math.max(8, viewport.h - h - 8),
    },
    size: { w, h },
  };
}

function clampWindowLayout(pos, size, { reserveBottom = 8 } = {}) {
  const viewport = getViewportSize();
  const maxX = Math.max(0, viewport.w - size.w);
  const maxY = Math.max(0, viewport.h - size.h - reserveBottom);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

function useVideoMediaRef(stream, liveKitTrack, shouldMute) {
  const ref = useRef(null);
  const setRef = useCallback((el) => {
    ref.current = el;
    if (!el) return;

    if (shouldMute) {
      el.setAttribute("muted", "");   // HTML attribute — required for Android autoplay
      el.muted = true;                // JS property — belt-and-suspenders
    }
    el.setAttribute("playsinline", "");
    el.setAttribute("autoplay", "");

  }, [shouldMute]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (liveKitTrack && typeof liveKitTrack.attach === "function") {
      el.setAttribute("muted", "");
      el.muted = true;
      el.srcObject = null;
      liveKitTrack.attach(el);
      el.play().catch(() => {});
      return () => {
        try {
          liveKitTrack.detach(el);
        } catch {
          el.srcObject = null;
        }
      };
    }

    if (!stream) {
      el.srcObject = null;
      return;
    }
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
    return () => {
      if (el.srcObject === stream) el.srcObject = null;
    };
  }, [liveKitTrack, stream]);

  return { setRef, ref };
}

function RemoteAudioTrack({ track }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !track || typeof track.attach !== "function") return;
    element.setAttribute("playsinline", "");
    element.setAttribute("autoplay", "");
    track.attach(element);
    element.play().catch(() => {});
    return () => {
      try {
        track.detach(element);
      } catch {
        element.srcObject = null;
      }
    };
  }, [track]);

  return <audio ref={ref} className="hidden" aria-hidden="true" />;
}

// ── Single video tile ────────────────────────────────────────────────────────
function VideoTile({
  stream,
  liveKitTrack = null,
  liveKitPublication = null,
  videoSource = "camera",
  name,
  isMuted = false,
  isCameraOff = false,
  isLocal = false,
  isActiveSpeaker = false,
  compact = false,
  connectionState = "connected",
}) {
  const { setRef } = useVideoMediaRef(stream, liveKitTrack, isLocal || Boolean(liveKitTrack));
  const tileRef = useRef(null);
  const [portraitVideo, setPortraitVideo] = useState(false);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const initials = (name || "?")[0].toUpperCase();
  const showAvatar = (!stream && !liveKitTrack) || isCameraOff;
  const reconnecting = connectionState === "reconnecting";
  const screenShare = videoSource === "screen" || videoSource === "screen_share";

  useEffect(() => {
    const tile = tileRef.current;
    if (!tile || !liveKitPublication || isLocal) return undefined;

    const update = () => {
      const rect = tile.getBoundingClientRect();
      updateLiveKitRenderTarget(liveKitPublication, {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        source: videoSource,
        mediaWidth: videoSize.width,
        mediaHeight: videoSize.height,
      });
    };
    update();
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(update)
      : null;
    observer?.observe(tile);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      clearLiveKitRenderTarget(liveKitPublication);
    };
  }, [isLocal, liveKitPublication, videoSize.height, videoSize.width, videoSource]);

  return (
    <div
      ref={tileRef}
      className={`relative bg-[#1a1d27] overflow-hidden flex items-center justify-center w-full h-full transition-all ${
        isActiveSpeaker ? "ring-2 ring-green-400" : ""
      } ${compact ? "rounded-xl" : "rounded-xl"}`}
    >
      {/* Local video is mirrored (selfie-style); remote is natural */}
      <video
        ref={setRef}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setPortraitVideo(video.videoHeight > video.videoWidth);
          setVideoSize({ width: video.videoWidth || 0, height: video.videoHeight || 0 });
        }}
        onResize={(event) => {
          const video = event.currentTarget;
          setPortraitVideo(video.videoHeight > video.videoWidth);
          setVideoSize({ width: video.videoWidth || 0, height: video.videoHeight || 0 });
        }}
        onCanPlay={(e) => { e.currentTarget.play().catch(() => {}); }}
        className={`absolute inset-0 h-full w-full ${
          screenShare || portraitVideo ? "object-contain bg-black" : "object-cover"
        }`}
        style={isLocal ? { transform: "scaleX(-1)" } : undefined}
      />

      {showAvatar && (
        <div className="absolute inset-0 bg-[#1a1d27] flex flex-col items-center justify-center gap-2 select-none z-10">
          <div className={`rounded-full bg-slate-600 flex items-center justify-center font-semibold text-white ${compact ? "w-10 h-10 text-base" : "w-16 h-16 text-2xl"}`}>
            {initials}
          </div>
          {!compact && <span className="text-slate-400 text-xs">{reconnecting ? "Reconnecting..." : (name || "User")}</span>}
        </div>
      )}

      {!compact && (
        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5 text-[11px] text-white pointer-events-none">
          {isMuted
            ? <MicOff size={10} className="text-red-400 shrink-0" />
            : <Mic size={10} className="text-green-400 shrink-0" />
          }
          <span className="truncate max-w-[100px]">{isLocal ? `${name} (You)` : (name || "User")}</span>
        </div>
      )}
    </div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, title, active = false, danger = false, wide = false, disabled = false, children }) {
  const isMob = typeof window !== "undefined" && window.innerWidth < 768;
  let cls = "flex items-center justify-center rounded-full transition-colors font-medium ";
  if (wide) cls += `gap-2 ${isMob ? "h-12 px-3 text-sm min-w-0" : "h-11 px-5 text-sm"} `;
  else cls += isMob ? "w-12 h-12 shrink-0 " : "w-11 h-11 ";
  if (disabled) cls += "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60";
  else if (danger) cls += "bg-red-600 active:bg-red-500 text-white";
  else if (active) cls += "bg-blue-600 active:bg-blue-500 text-white";
  else cls += "bg-slate-700 active:bg-slate-600 text-white";

  return (
    <button type="button" onClick={onClick} title={title} className={cls} disabled={disabled}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GlobalHuddleWindow() {
  const api = useApi();
  const huddleCtx = useHuddle();
  const activeHuddle = huddleCtx?.activeHuddle || null;
  const incomingHuddle = huddleCtx?.incomingHuddle || null;
  const rtc = huddleCtx?.rtc || null;
  const currentUser = huddleCtx?.currentUser || null;

  const isHost = String(activeHuddle?.startedBy?.userId) === String(currentUser?.id);
  const callTimer = useCallTimer(activeHuddle?.at);
  const activeSpeakerId = rtc?.activeSpeakerId;
  const networkQuality = rtc?.networkQuality || "good";

  const [isMobileDevice, setIsMobileDevice] = useState(() => isMobileViewport());
  const [isMaximized, setIsMaximized] = useState(() => isMobileViewport());
  const [pos, setPos] = useState(() => (
    isMobileViewport() ? getFullWindowLayout().pos : getDesktopDefaultLayout().pos
  ));
  const [size, setSize] = useState(() => (
    isMobileViewport() ? getFullWindowLayout().size : getDesktopDefaultLayout().size
  ));
  const [pendingControl, setPendingControl] = useState(null);
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showMissedPanel, setShowMissedPanel] = useState(false);
  const [missedBrief, setMissedBrief] = useState(null);
  const [missedLoading, setMissedLoading] = useState(false);
  const [followLatestCaption, setFollowLatestCaption] = useState(true);
  const captionFeedRef = useRef(null);
  const replacementInputRef = useRef(null);
  const replacementUrlRef = useRef(null);
  const canonicalCaptionFeed = useMemo(
    () => (Array.isArray(rtc?.captionFeed) ? rtc.captionFeed : []),
    [rtc?.captionFeed]
  );

  const runControl = useCallback(async (control, action) => {
    if (!action || pendingControl) return;
    setPendingControl(control);
    try {
      await Promise.resolve(action());
    } finally {
      setPendingControl(null);
    }
  }, [pendingControl]);

  useEffect(() => () => {
    if (replacementUrlRef.current) {
      URL.revokeObjectURL(replacementUrlRef.current);
    }
  }, []);

  useEffect(() => {
    if (!rtc?.joined || !rtc?.backgroundEffectsSupported) return undefined;
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) {
      return undefined;
    }
    const preload = () => {
      void preloadBackgroundEffects({
        imagePaths: CURATED_HUDDLE_BACKGROUNDS.map((background) => background.path),
      });
    };
    const idleId = window.requestIdleCallback?.(preload, { timeout: 1200 });
    const timeout = idleId === undefined
      ? window.setTimeout(preload, 900)
      : null;
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [rtc?.backgroundEffectsSupported, rtc?.joined]);

  useEffect(() => {
    if (!showBackgroundMenu || !rtc?.backgroundEffectsSupported) return;
    void preloadBackgroundEffects({
      imagePaths: CURATED_HUDDLE_BACKGROUNDS.map((background) => background.path),
    });
  }, [rtc?.backgroundEffectsSupported, showBackgroundMenu]);

  const updateBackgroundEffect = useCallback(async (mode, imagePath = null) => {
    if (!rtc?.setBackgroundEffect) return;
    const result = await rtc.setBackgroundEffect({ mode, imagePath });
    if (!result?.ok) {
      toast.error(
        result?.reason === "background_effect_not_supported"
          ? "Background effects are unavailable in this browser"
          : "Background effect could not be applied"
      );
      return;
    }
    setShowBackgroundMenu(false);
    toast.success(
      mode === "off"
        ? "Background effect removed"
        : mode === "blur"
          ? "Background blurred"
          : "Background replaced"
    );
  }, [rtc]);

  const chooseReplacement = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (replacementUrlRef.current) URL.revokeObjectURL(replacementUrlRef.current);
    replacementUrlRef.current = URL.createObjectURL(file);
    void updateBackgroundEffect("replacement", replacementUrlRef.current);
    event.target.value = "";
  }, [updateBackgroundEffect]);

  const updateQualityMode = useCallback(async (mode) => {
    if (!rtc?.setQualityMode) return;
    const result = await rtc.setQualityMode(mode);
    if (!result?.ok) {
      toast.error("Video quality mode could not be changed");
      return;
    }
    setShowQualityMenu(false);
    toast.success(
      mode === "hd"
        ? "HD video requested"
        : mode === "standard"
          ? "Standard video selected"
          : "Automatic video quality selected"
    );
  }, [rtc]);

  const loadWhatDidIMiss = useCallback(async () => {
    const sessionId = activeHuddle?.sessionId;
    if (!sessionId) {
      toast.error("Meeting context is still connecting");
      return;
    }
    setShowMissedPanel(true);
    setMissedLoading(true);
    try {
      const response = await api.get(
        `/huddle/intelligence/sessions/${sessionId}/what-did-i-miss`
      );
      setMissedBrief(response.data.result);
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.reason || "Meeting brief could not be loaded"
      );
    } finally {
      setMissedLoading(false);
    }
  }, [activeHuddle?.sessionId, api]);

  useEffect(() => {
    if (!showMissedPanel || !activeHuddle?.sessionId) return undefined;
    const refresh = window.setInterval(async () => {
      try {
        const response = await api.get(
          `/huddle/intelligence/sessions/${activeHuddle.sessionId}/what-did-i-miss`
        );
        setMissedBrief(response.data.result);
      } catch {
        // Keep the latest successful brief visible during transient reconnects.
      }
    }, 6000);
    return () => window.clearInterval(refresh);
  }, [activeHuddle?.sessionId, api, showMissedPanel]);

  useEffect(() => {
    const sync = () => {
      const nextMobile = isMobileViewport();
      setIsMobileDevice(nextMobile);
      if (isMaximized) {
        const full = getFullWindowLayout();
        setPos(full.pos);
        setSize(full.size);
      } else if (nextMobile) {
        const compact = getMobileCompactLayout();
        setPos(compact.pos);
        setSize(compact.size);
      } else {
        setPos((current) => clampWindowLayout(current, size, { reserveBottom: 40 }));
      }
    };
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener?.("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener?.("resize", sync);
    };
  }, [isMaximized, size]);

  useEffect(() => {
    if (
      !rtc?.subtitlesEnabled ||
      !followLatestCaption ||
      !captionFeedRef.current
    ) return;
    captionFeedRef.current.scrollTop = captionFeedRef.current.scrollHeight;
  }, [canonicalCaptionFeed, followLatestCaption, rtc?.subtitlesEnabled]);

  const handleCaptionScroll = useCallback(() => {
    const element = captionFeedRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    setFollowLatestCaption(distanceFromBottom < 28);
  }, []);

  const jumpToLatestCaption = useCallback(() => {
    const element = captionFeedRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    setFollowLatestCaption(true);
  }, []);

  useEffect(() => {
    if (
      rtc?.backgroundEffect?.diagnostics?.reason ===
      "background_effect_automatically_disabled"
    ) {
      toast("Background effect was disabled to protect call quality.");
    } else if (
      rtc?.backgroundEffect?.diagnostics?.reason ===
      "background_replacement_degraded_to_blur"
    ) {
      toast("Background replacement was reduced to blur to protect call quality.");
    }
  }, [rtc?.backgroundEffect?.diagnostics?.reason]);

  const windowRef = useRef(null);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 });
  const prevSizeRef = useRef({ pos: null, size: null });

  const remotePeers = Array.isArray(rtc?.remotePeers) ? rtc.remotePeers : [];

  const localParticipant = {
    userId: "local",
    username: currentUser?.username || "You",
    stream: rtc?.localStream,
    isMuted: rtc?.isMuted,
    isCameraOff: rtc?.isCameraOff,
    isLocal: true,
  };

  // 1-on-1 mode: one remote peer — use WhatsApp-style layout
  const isOneOnOne = remotePeers.length === 1;
  const remoteParticipant = isOneOnOne
    ? { userId: remotePeers[0].userId, username: remotePeers[0].username || "User", stream: remotePeers[0].stream, videoTrack: remotePeers[0].videoTrack, videoPublication: remotePeers[0].videoPublication, selectedVideoSource: remotePeers[0].selectedVideoSource, isMuted: remotePeers[0].isMuted, isCameraOff: remotePeers[0].isCameraOff, connectionState: remotePeers[0].connectionState, isLocal: false }
    : null;

  // Grid layout for group calls
  const participants = [localParticipant, ...remotePeers.map((p) => ({ userId: p.userId, username: p.username || "User", stream: p.stream, videoTrack: p.videoTrack, videoPublication: p.videoPublication, selectedVideoSource: p.selectedVideoSource, isMuted: p.isMuted, isCameraOff: p.isCameraOff, connectionState: p.connectionState, isLocal: false }))];
  const captionItems = useMemo(() => {
    const remoteName = (id) => {
      const peer = remotePeers.find(
        (item) =>
          String(item.userId) === String(id) ||
          String(item.participantId) === String(id)
      );
      return cleanSpeakerLabel(peer?.username || peer?.name);
    };
    const resolveSpeaker = (caption, fallbackId) => {
      const speaker = caption?.speaker || {};
      return (
        cleanSpeakerLabel(speaker.label) ||
        (String(speaker.userId) === String(currentUser?.id)
          ? cleanSpeakerLabel(currentUser?.username || currentUser?.name) || "You"
          : "") ||
        remoteName(speaker.userId || speaker.participantId || caption?.speakerId || fallbackId) ||
        "Speaker"
      );
    };
    if (canonicalCaptionFeed.length > 0) {
      return canonicalCaptionFeed.map((caption) => ({
        key:
          caption.transcriptSegmentId ||
          caption.metadata?.sourceSegmentId ||
          caption.sourceSegmentId ||
          caption.id,
        speaker: resolveSpeaker(caption),
        text: caption.text,
        status: caption.status || (caption.isFinal ? "final" : "partial"),
        time: captionTime(caption.emittedAt || caption.createdAt || caption.at),
      }));
    }
    return Object.entries(rtc?.subtitles || {})
      .map(([uid, entry]) => {
        if (!entry?.text) return null;
        const speaker =
          uid === "local"
            ? cleanSpeakerLabel(currentUser?.username || currentUser?.name) || "You"
            : remoteName(uid) || "Speaker";
        return {
          key: uid,
          speaker,
          text: entry.text,
          status: entry.status || "partial",
          time: captionTime(entry.emittedAt || entry.at),
        };
      })
      .filter(Boolean);
  }, [
    canonicalCaptionFeed,
    currentUser?.id,
    currentUser?.name,
    currentUser?.username,
    remotePeers,
    rtc?.subtitles,
  ]);
  const captionStatusLabel =
    rtc?.captionStatus === "failed"
      ? "Unavailable"
      : rtc?.captionStatus === "reconnecting"
        ? "Reconnecting"
        : captionItems.length > 0
          ? "Live"
          : "Listening";
  const presentingParticipant = participants.find(
    (participant) =>
      !participant.isLocal &&
      (participant.selectedVideoSource === "screen" ||
        participant.selectedVideoSource === "screen_share")
  );
  const gridParticipants = presentingParticipant
    ? participants.filter((participant) => participant.userId !== presentingParticipant.userId)
    : participants;
  const count = gridParticipants.length;
  const gridCols = count <= 1 ? 1 : count <= 4 ? 2 : 3;

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onMouseDownDrag = (e) => {
    if (isMaximized) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const onMouseMove = useCallback((e) => {
    if (dragging.current) {
      setPos(clampWindowLayout(
        { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y },
        size,
        { reserveBottom: isMobileDevice ? 8 : 40 }
      ));
    }
    if (resizing.current && !isMobileDevice) {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      setSize({
        w: Math.max(420, resizeStart.current.w + dx),
        h: Math.max(320, resizeStart.current.h + dy),
      });
    }
  }, [isMobileDevice, size]);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    resizing.current = false;
  }, []);

  const onMouseDownResize = (e) => {
    if (isMaximized || isMobileDevice) return;
    e.stopPropagation();
    resizing.current = true;
    resizeStart.current = { w: size.w, h: size.h, x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Maximize ────────────────────────────────────────────────────────────────
  const toggleMaximize = () => {
    if (!isMaximized) {
      prevSizeRef.current = { pos: { ...pos }, size: { ...size } };
      const full = getFullWindowLayout();
      setPos(full.pos);
      setSize(full.size);
      setIsMaximized(true);
    } else {
      if (isMobileDevice) {
        const compact = getMobileCompactLayout();
        setPos(compact.pos);
        setSize(compact.size);
        setIsMaximized(false);
        return;
      }
      const prev = prevSizeRef.current;
      const fallback = getDesktopDefaultLayout();
      setPos(prev.pos ? clampWindowLayout(prev.pos, prev.size || fallback.size, { reserveBottom: 40 }) : fallback.pos);
      setSize(prev.size || fallback.size);
      setIsMaximized(false);
    }
  };

  useEffect(() => {
    if (!isMaximized) return;
    const onResize = () => {
      const full = getFullWindowLayout();
      setSize(full.size);
      setPos(full.pos);
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener?.("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener?.("resize", onResize);
    };
  }, [isMaximized]);

  // Don't show video tiles while there is a pending incoming call to accept/decline
  if (!activeHuddle || !rtc || incomingHuddle) return null;

  // Network quality badge
  const netColor = { good: "text-green-400", ok: "text-yellow-400", poor: "text-red-400" }[networkQuality];
  const netLabel = { good: "●", ok: "◑", poor: "○" }[networkQuality];

  const subtitlesSupported =
    rtc?.subtitlesSupported !== false &&
    typeof rtc?.toggleSubtitles === "function";
  const screenShareSupported =
    rtc?.screenShareSupported !== false &&
    typeof rtc?.startScreenShare === "function" &&
    typeof rtc?.stopScreenShare === "function";
  const videoAreaH = Math.max(120, size.h - (isMobileDevice ? 132 : 108));

  return (
    <div
      ref={windowRef}
      className="fixed bg-[#0f111a] text-white shadow-2xl z-[999999] flex flex-col select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        borderRadius: isMaximized ? 0 : "0.75rem",
        border: isMaximized ? "none" : "1px solid #1e293b",
        transition: isMaximized ? "all 0.18s ease" : "none",
      }}
    >
      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div
        onMouseDown={onMouseDownDrag}
        className="w-full px-4 py-2.5 bg-[#1b1e27] flex justify-between items-center shrink-0 cursor-move"
        style={{ borderRadius: isMaximized ? 0 : "0.75rem 0.75rem 0 0" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold text-sm truncate max-w-[180px]">
            {activeHuddle.startedBy?.username || "Huddle"}
          </span>
          <span className="font-mono text-xs text-slate-400">{callTimer}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold ${netColor}`} title={`Connection: ${networkQuality}`}>
            {netLabel} {networkQuality.charAt(0).toUpperCase() + networkQuality.slice(1)}
          </span>
          <span className="text-xs text-slate-500">{participants.length} participant{participants.length !== 1 ? "s" : ""}</span>
          <button
            type="button"
            onClick={toggleMaximize}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* ── VIDEO AREA ────────────────────────────────────────────────────── */}
      <div className="flex-1 relative bg-[#0f111a] overflow-hidden min-h-0" style={{ height: videoAreaH }}>
        {remotePeers.map((peer) => (
          <RemoteAudioTrack key={`audio:${peer.userId}`} track={peer.audioTrack} />
        ))}
        {rtc?.error && (
          <div className="absolute top-2 left-2 right-2 z-30 rounded-md border border-red-400/40 bg-red-950/85 px-3 py-2 text-xs text-red-100 shadow-lg">
            {rtc.error}
          </div>
        )}
        {presentingParticipant ? (
          <div className="flex h-full min-h-0 flex-col gap-2 p-2 lg:flex-row">
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black">
              <VideoTile
                stream={presentingParticipant.stream}
                liveKitTrack={presentingParticipant.videoTrack}
                liveKitPublication={presentingParticipant.videoPublication}
                videoSource={presentingParticipant.selectedVideoSource}
                name={`${presentingParticipant.username} is presenting`}
                isMuted={presentingParticipant.isMuted}
                isCameraOff={false}
                connectionState={presentingParticipant.connectionState}
              />
            </div>
            <div className="grid h-24 shrink-0 grid-flow-col auto-cols-[120px] gap-2 overflow-x-auto lg:h-full lg:w-36 lg:grid-flow-row lg:auto-rows-[100px] lg:grid-cols-1 lg:overflow-y-auto">
              {gridParticipants.map((participant) => (
                <VideoTile
                  key={`presenting:${participant.userId}`}
                  stream={participant.stream}
                  liveKitTrack={participant.videoTrack}
                  liveKitPublication={participant.videoPublication}
                  videoSource={participant.selectedVideoSource}
                  name={participant.username}
                  isMuted={participant.isMuted}
                  isCameraOff={participant.isCameraOff}
                  isLocal={participant.isLocal}
                  compact
                  connectionState={participant.connectionState}
                />
              ))}
            </div>
          </div>
        ) : isOneOnOne ? (
          /* ── WhatsApp-style 1-on-1 ── */
          <>
            {/* Remote: full-screen background */}
            <div className="absolute inset-0">
              <VideoTile
                stream={remoteParticipant.stream}
                liveKitTrack={remoteParticipant.videoTrack}
                liveKitPublication={remoteParticipant.videoPublication}
                videoSource={remoteParticipant.selectedVideoSource}
                name={remoteParticipant.username}
                isMuted={remoteParticipant.isMuted}
                isCameraOff={remoteParticipant.isCameraOff}
                isLocal={false}
                isActiveSpeaker={activeSpeakerId === remoteParticipant.userId}
                connectionState={remoteParticipant.connectionState}
              />
            </div>

            {/* Local: PIP corner (bottom-right, above controls) */}
            <div
              className="absolute z-20 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl"
              style={{ width: 100, height: 134, bottom: 12, right: 12 }}
            >
              <VideoTile
                stream={localParticipant.stream}
                name={localParticipant.username}
                isMuted={localParticipant.isMuted}
                isCameraOff={localParticipant.isCameraOff}
                isLocal={true}
                compact={true}
              />
            </div>
          </>
        ) : (
          /* ── Grid layout for group calls ── */
          <div
            className="w-full h-full p-2 gap-2"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${Math.ceil(count / gridCols)}, 1fr)`,
            }}
          >
            {gridParticipants.map((p) => (
              <VideoTile
                key={p.userId}
                stream={p.stream}
                liveKitTrack={p.videoTrack}
                liveKitPublication={p.videoPublication}
                videoSource={p.selectedVideoSource}
                name={p.username}
                isMuted={p.isMuted}
                isCameraOff={p.isCameraOff}
                isLocal={p.isLocal}
                isActiveSpeaker={activeSpeakerId === (p.isLocal ? "local" : p.userId)}
                connectionState={p.connectionState}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── SUBTITLE OVERLAY ─────────────────────────────────────────────── */}
      {rtc?.subtitlesEnabled && !showMissedPanel && (
        <section
          className={`absolute z-30 overflow-hidden border border-white/15 bg-[#0b1220]/95 shadow-2xl backdrop-blur-md ${
            isMobileDevice
              ? "inset-x-2 max-h-[50%]"
              : "right-3 w-[min(430px,50%)] max-h-[58%]"
          }`}
          style={{
            borderRadius: 8,
            bottom: isMobileDevice ? 132 : 88,
          }}
          aria-label="Live meeting transcript"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    rtc?.captionStatus === "failed"
                      ? "bg-red-400"
                      : rtc?.captionStatus === "reconnecting"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                />
                {captionStatusLabel}
              </div>
              <div className="truncate text-sm font-semibold text-white">Meeting transcript</div>
            </div>
            <div className="shrink-0 rounded border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-slate-300">
              {captionItems.length} line{captionItems.length === 1 ? "" : "s"}
            </div>
          </div>
          <div
            ref={captionFeedRef}
            onScroll={handleCaptionScroll}
            className="max-h-[inherit] overflow-y-auto px-3 py-3"
          >
            {captionItems.length > 0 ? (
              <div className="space-y-3">
                {captionItems.map((caption) => (
                  <div key={caption.key} className="grid grid-cols-[28px_1fr] gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400/15 text-[11px] font-semibold text-sky-200">
                      {caption.speaker.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[12px] font-semibold text-sky-200">{caption.speaker}</span>
                        {caption.time && <span className="text-[10px] text-slate-500">{caption.time}</span>}
                        {caption.status === "partial" && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                            live
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 text-sm leading-5 text-white ${caption.status === "partial" ? "opacity-80" : ""}`}>
                        {caption.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-5 text-center">
                <div className="text-sm font-medium text-slate-200">Listening for speech</div>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-400">
                  Captions from every speaker will appear here as the meeting continues.
                </p>
              </div>
            )}
          </div>
          {!followLatestCaption && (
            <button
              type="button"
              onClick={jumpToLatestCaption}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-sky-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-sky-400"
            >
              <ArrowDown size={13} /> Latest
            </button>
          )}
        </section>
      )}

      {showMissedPanel && (
        <section
          className={`absolute z-40 overflow-hidden border border-white/15 bg-[#111827]/95 shadow-xl ${
            isMobileDevice
              ? "inset-x-2 top-12"
              : "left-3 top-14 w-[min(430px,62%)]"
          }`}
          style={{ borderRadius: 8, bottom: isMobileDevice ? 132 : 88 }}
          aria-label="What did I miss"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div>
              <div className="text-sm font-semibold">What did I miss?</div>
              <div className="text-[11px] text-slate-400">Evidence from the live transcript</div>
            </div>
            <button type="button" onClick={() => setShowMissedPanel(false)} className="p-1.5 text-slate-300" title="Close">
              <X size={16} />
            </button>
          </div>
          <div className="h-full overflow-y-auto px-3 py-3 text-sm">
            {missedLoading ? (
              <div className="py-8 text-center text-slate-400">Preparing your meeting brief...</div>
            ) : (
              <>
                <p className="whitespace-pre-wrap leading-6 text-slate-100">
                  {missedBrief?.rollingSummary || "No finalized discussion is available yet."}
                </p>
                {(missedBrief?.decisions || []).length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase text-sky-300">Decisions so far</h3>
                    <ul className="mt-2 space-y-2">
                      {missedBrief.decisions.map((item) => (
                        <li key={item.id} className="leading-5 text-slate-200">{item.decision}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(missedBrief?.openQuestions || []).length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase text-amber-300">Open questions</h3>
                    <ul className="mt-2 space-y-2">
                      {missedBrief.openQuestions.map((item) => (
                        <li key={item.id} className="leading-5 text-slate-200">{item.question}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {showBackgroundMenu && (
        <div
          className="absolute z-50 w-72 border border-white/15 bg-[#1b1e27] p-2 shadow-xl"
          style={{ borderRadius: 8, bottom: isMobileDevice ? 126 : 82, left: "50%", transform: "translateX(-50%)" }}
        >
          <button type="button" onClick={() => updateBackgroundEffect("off")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-white/10">
            <Video size={15} /> No effect
          </button>
          <button type="button" onClick={() => updateBackgroundEffect("blur")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-white/10">
            <Sparkles size={15} /> Blur background
          </button>
          <button
            type="button"
            onClick={() => replacementInputRef.current?.click()}
            disabled={rtc?.backgroundEffectSupport?.replacementSupported === false}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            title={
              rtc?.backgroundEffectSupport?.replacementSupported === false
                ? "Background replacement is disabled on this device to protect call quality"
                : "Replace background"
            }
          >
            <Image size={15} /> Replace background
          </button>
          {rtc?.backgroundEffectSupport?.replacementSupported !== false && (
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase text-slate-400">
                Included backgrounds
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CURATED_HUDDLE_BACKGROUNDS.map((background) => (
                  <button
                    key={background.path}
                    type="button"
                    onClick={() =>
                      updateBackgroundEffect("replacement", background.path)
                    }
                    className="overflow-hidden rounded border border-white/10 text-left hover:border-sky-400"
                    title={background.label}
                  >
                    <img
                      src={background.path}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                    <span className="block truncate px-1.5 py-1 text-[10px] text-slate-300">
                      {background.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input ref={replacementInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={chooseReplacement} />
        </div>
      )}

      {showQualityMenu && (
        <div
          className="absolute z-50 w-52 border border-white/15 bg-[#1b1e27] p-2 shadow-xl"
          style={{ borderRadius: 8, bottom: isMobileDevice ? 126 : 82, right: 12 }}
        >
          {[
            ["auto", "Auto", "Adapts to network and tile size"],
            ["standard", "Standard", "Balances clarity and bandwidth"],
            ["hd", "HD", "Requests 720p and the high layer"],
          ].map(([mode, label, description]) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateQualityMode(mode)}
              className={`w-full rounded px-3 py-2 text-left hover:bg-white/10 ${
                rtc.qualityMode === mode ? "bg-white/10" : ""
              }`}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-slate-400">{description}</div>
            </button>
          ))}
        </div>
      )}

      {/* ── CONTROL BAR ───────────────────────────────────────────────────── */}
      <div
        className={`w-full bg-[#1b1e27] flex justify-center items-center shrink-0 ${
          isMobileDevice ? "py-3 px-3 gap-2 flex-wrap" : "py-4 px-6 gap-4"
        }`}
        style={{
          borderRadius: isMaximized ? 0 : "0 0 0.75rem 0.75rem",
          paddingBottom: isMobileDevice
            ? "calc(1rem + env(safe-area-inset-bottom))"
            : undefined,
        }}
      >
        {/* Mic */}
        <CtrlBtn
          onClick={() => runControl("mic", rtc.toggleMute)}
          title={rtc.isMuted ? "Unmute microphone" : "Mute microphone"}
          danger={rtc.isMuted}
          disabled={pendingControl === "mic"}
        >
          {rtc.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </CtrlBtn>

        {/* Camera */}
        <CtrlBtn
          onClick={() => runControl("camera", rtc?.toggleCamera)}
          title={rtc?.isCameraOff ? "Turn on camera" : "Turn off camera"}
          danger={rtc?.isCameraOff}
          disabled={pendingControl === "camera"}
        >
          {rtc.isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
        </CtrlBtn>

        {/* Screen share */}
        {(!isMobileDevice || isMaximized) && (
          <>
        <CtrlBtn
          onClick={() => runControl(
            "screen",
            rtc.isScreenSharing ? rtc.stopScreenShare : rtc.startScreenShare
          )}
          title={
            screenShareSupported
              ? (rtc.isScreenSharing ? "Stop sharing screen" : "Share your screen")
              : "Screen sharing is not available on this browser"
          }
          active={rtc.isScreenSharing}
          disabled={!screenShareSupported || pendingControl === "screen"}
        >
          {rtc.isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </CtrlBtn>

        {/* Background effects */}
        <CtrlBtn
          onClick={() => setShowBackgroundMenu((value) => !value)}
          title={
            rtc.backgroundEffectsSupported
              ? "Background effects"
              : "Background effects are unavailable in this browser"
          }
          active={rtc.backgroundEffect?.active}
          disabled={!rtc.backgroundEffectsSupported || pendingControl === "background"}
        >
          <Sparkles size={18} />
        </CtrlBtn>

        <CtrlBtn
          onClick={() => setShowQualityMenu((value) => !value)}
          title={`Video quality: ${rtc.qualityMode || "auto"}`}
          active={rtc.qualityMode === "hd"}
          disabled={typeof rtc.setQualityMode !== "function"}
        >
          <Gauge size={18} />
        </CtrlBtn>

        {/* CC / Live subtitles */}
        <CtrlBtn
          onClick={() => subtitlesSupported && runControl("subtitles", rtc?.toggleSubtitles)}
          title={
            subtitlesSupported
              ? (rtc?.subtitlesEnabled ? "Turn off subtitles" : "Turn on live subtitles")
              : "Live subtitles are not available for this call"
          }
          active={rtc?.subtitlesEnabled}
          disabled={!subtitlesSupported || pendingControl === "subtitles"}
        >
          <Captions size={18} />
        </CtrlBtn>

        {/* What did I miss */}
        <CtrlBtn
          onClick={loadWhatDidIMiss}
          title="What did I miss?"
          active={showMissedPanel}
          disabled={missedLoading}
        >
          <BookOpenText size={18} />
        </CtrlBtn>

        {/* Mute all — host only */}
        {isHost && (
          <CtrlBtn
            onClick={() => runControl("muteAll", rtc.muteAll)}
            title="Mute all participants"
            disabled={pendingControl === "muteAll"}
          >
            <VolumeX size={18} />
          </CtrlBtn>
        )}
          </>
        )}

        <div className="w-px h-7 bg-slate-600 mx-1" />

        {/* Leave / End for all */}
        {isHost ? (
          <CtrlBtn
            onClick={() => runControl("end", rtc.endHuddleForAll)}
            title="End call for everyone"
            danger
            wide
            disabled={pendingControl === "end"}
          >
            <PhoneOff size={16} />
            <span className="whitespace-nowrap">End for all</span>
          </CtrlBtn>
        ) : (
          <CtrlBtn
            onClick={() => runControl("leave", rtc.leaveHuddle)}
            title="Leave call"
            danger
            wide
            disabled={pendingControl === "leave"}
          >
            <PhoneOff size={16} />
            <span className="whitespace-nowrap">Leave</span>
          </CtrlBtn>
        )}
      </div>

      {/* ── RESIZE HANDLE ─────────────────────────────────────────────────── */}
      {!isMaximized && !isMobileDevice && (
        <div
          onMouseDown={onMouseDownResize}
          className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-80 transition-opacity"
          title="Resize"
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className="text-slate-400">
            <path d="M10 2L2 10M6 2L2 6M10 6L6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
