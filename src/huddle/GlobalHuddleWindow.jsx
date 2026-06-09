// src/huddle/GlobalHuddleWindow.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useHuddle } from "../context/HuddleContext";
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Maximize2, Minimize2, VolumeX, Captions,
} from "lucide-react";

// ── Call timer ──────────────────────────────────────────────────────────────
function useCallTimer(startedAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const base = new Date(startedAt).getTime();
    setElapsed(Math.floor((Date.now() - base) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - base) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const h = Math.floor(elapsed / 3600);
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
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

function useMutedVideoRef(stream, shouldMute) {
  const ref = useRef(null);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  // Callback ref: fires whenever the element mounts / changes
  const setRef = useCallback((el) => {
    ref.current = el;
    if (!el) return;

    if (shouldMute) {
      el.setAttribute("muted", "");   // HTML attribute — required for Android autoplay
      el.muted = true;                // JS property — belt-and-suspenders
    }
    el.setAttribute("playsinline", "");
    el.setAttribute("autoplay", "");

    const s = streamRef.current;
    if (s && el.srcObject !== s) el.srcObject = s;
    el.play().catch(() => {});
  }, [shouldMute]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply srcObject when stream changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!stream) { el.srcObject = null; return; }
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  return { setRef, ref };
}

// ── Single video tile ────────────────────────────────────────────────────────
function VideoTile({ stream, name, isMuted = false, isCameraOff = false, isLocal = false, isActiveSpeaker = false, compact = false, connectionState = "connected" }) {
  const { setRef } = useMutedVideoRef(stream, isLocal);
  const initials = (name || "?")[0].toUpperCase();
  const showAvatar = !stream || isCameraOff;
  const reconnecting = connectionState === "reconnecting";

  return (
    <div
      className={`relative bg-[#1a1d27] overflow-hidden flex items-center justify-center w-full h-full transition-all ${
        isActiveSpeaker ? "ring-2 ring-green-400" : ""
      } ${compact ? "rounded-xl" : "rounded-xl"}`}
    >
      {/* Local video is mirrored (selfie-style); remote is natural */}
      <video
        ref={setRef}
        onCanPlay={(e) => { e.currentTarget.play().catch(() => {}); }}
        className="absolute inset-0 w-full h-full object-cover"
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
    isMobileViewport() ? getFullWindowLayout().pos : { x: 200, y: 120 }
  ));
  const [size, setSize] = useState(() => (
    isMobileViewport() ? getFullWindowLayout().size : { w: 620, h: 440 }
  ));
  const [pendingControl, setPendingControl] = useState(null);

  const runControl = useCallback(async (control, action) => {
    if (!action || pendingControl) return;
    setPendingControl(control);
    try {
      await Promise.resolve(action());
    } finally {
      setPendingControl(null);
    }
  }, [pendingControl]);

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
    ? { userId: remotePeers[0].userId, username: remotePeers[0].username || "User", stream: remotePeers[0].stream, isMuted: remotePeers[0].isMuted, isCameraOff: remotePeers[0].isCameraOff, connectionState: remotePeers[0].connectionState, isLocal: false }
    : null;

  // Grid layout for group calls
  const participants = [localParticipant, ...remotePeers.map((p) => ({ userId: p.userId, username: p.username || "User", stream: p.stream, isMuted: p.isMuted, isCameraOff: p.isCameraOff, connectionState: p.connectionState, isLocal: false }))];
  const count = participants.length;
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
      setPos(prev.pos ? clampWindowLayout(prev.pos, prev.size || { w: 620, h: 440 }, { reserveBottom: 40 }) : { x: 200, y: 120 });
      setSize(prev.size || { w: 620, h: 440 });
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
        {rtc?.error && (
          <div className="absolute top-2 left-2 right-2 z-30 rounded-md border border-red-400/40 bg-red-950/85 px-3 py-2 text-xs text-red-100 shadow-lg">
            {rtc.error}
          </div>
        )}
        {isOneOnOne ? (
          /* ── WhatsApp-style 1-on-1 ── */
          <>
            {/* Remote: full-screen background */}
            <div className="absolute inset-0">
              <VideoTile
                stream={remoteParticipant.stream}
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
            {participants.map((p) => (
              <VideoTile
                key={p.userId}
                stream={p.stream}
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
      {rtc?.subtitlesEnabled && rtc?.subtitles && (
        <div className="absolute bottom-2 left-0 right-0 z-30 flex flex-col items-center gap-1 px-4 pointer-events-none">
          {Object.entries(rtc.subtitles).map(([uid, entry]) => {
            if (!entry?.text || Date.now() - entry.at > 4000) return null;
            const name = uid === "local"
              ? (currentUser?.username || "You")
              : (remotePeers.find((p) => String(p.userId) === String(uid))?.username || "User");
            return (
              <div key={uid} className="bg-black/75 text-white text-sm px-3 py-1 rounded-lg max-w-[80%] text-center">
                <span className="text-slate-400 text-xs mr-1">{name}:</span>
                {entry.text}
              </div>
            );
          })}
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
