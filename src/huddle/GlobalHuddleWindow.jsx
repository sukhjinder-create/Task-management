// src/huddle/GlobalHuddleWindow.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useHuddle } from "../context/HuddleContext";
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Maximize2, Minimize2, VolumeX,
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

// ── Attach a stream to a <video> ref safely ─────────────────────────────────
function useVideoRef(stream, muted = false) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!stream) { video.srcObject = null; return; }
    if (video.srcObject !== stream) video.srcObject = stream;
    video.muted = muted;
    const play = () => video.play().catch(() => {});
    if (video.readyState >= 2) play();
    else video.onloadedmetadata = play;
  }, [stream, muted]);
  return ref;
}

// ── Single video tile ────────────────────────────────────────────────────────
function VideoTile({ stream, name, isMuted = false, isCameraOff = false, isLocal = false, isActiveSpeaker = false }) {
  const videoRef = useVideoRef(stream, isLocal);
  const initials = (name || "?")[0].toUpperCase();

  return (
    <div
      className={`relative bg-[#1a1d27] rounded-xl overflow-hidden flex items-center justify-center w-full h-full transition-all ${
        isActiveSpeaker ? "ring-2 ring-green-400 ring-offset-1 ring-offset-[#0f111a]" : ""
      }`}
    >
      {stream && !isCameraOff ? (
        <video ref={videoRef} playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 select-none">
          <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-2xl font-semibold text-white">
            {initials}
          </div>
          <span className="text-slate-400 text-xs">{name || "User"}</span>
        </div>
      )}

      {/* Bottom name bar */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5 text-[11px] text-white pointer-events-none">
        {isMuted
          ? <MicOff size={10} className="text-red-400 shrink-0" />
          : <Mic size={10} className="text-green-400 shrink-0" />
        }
        <span className="truncate max-w-[100px]">{isLocal ? `${name} (You)` : (name || "User")}</span>
      </div>
    </div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, title, active = false, danger = false, wide = false, children }) {
  let cls = "flex items-center justify-center rounded-full transition-colors font-medium ";
  if (wide) cls += "gap-2 px-4 h-11 text-sm ";
  else cls += "w-11 h-11 ";
  if (danger) cls += "bg-red-600 hover:bg-red-500 text-white";
  else if (active) cls += "bg-blue-600 hover:bg-blue-500 text-white";
  else cls += "bg-slate-700 hover:bg-slate-600 text-white";

  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GlobalHuddleWindow() {
  const huddleCtx = useHuddle();
  const activeHuddle = huddleCtx?.activeHuddle || null;
  const rtc = huddleCtx?.rtc || null;
  const currentUser = huddleCtx?.currentUser || null;

  const isHost = String(activeHuddle?.startedBy?.userId) === String(currentUser?.id);
  const callTimer = useCallTimer(activeHuddle?.at);
  const activeSpeakerId = rtc?.activeSpeakerId;
  const networkQuality = rtc?.networkQuality || "good";

  const [isMaximized, setIsMaximized] = useState(false);
  const [pos, setPos] = useState({ x: 200, y: 120 });
  const [size, setSize] = useState({ w: 620, h: 440 });

  const windowRef = useRef(null);
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 });
  const prevSizeRef = useRef({ pos: null, size: null });

  const remotePeers = Array.isArray(rtc?.remotePeers) ? rtc.remotePeers : [];

  // All participants: local first, then remotes
  const participants = [
    {
      userId: "local",
      username: currentUser?.username || "You",
      stream: rtc?.localStream,
      isMuted: rtc?.isMuted,
      isCameraOff: rtc?.isCameraOff,
      isLocal: true,
    },
    ...remotePeers.map((p) => ({
      userId: p.userId,
      username: p.username || "User",
      stream: p.stream,
      isMuted: p.isMuted,
      isCameraOff: false,
      isLocal: false,
    })),
  ];

  // Grid columns based on participant count
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
      const maxX = Math.max(0, window.innerWidth - size.w);
      const maxY = Math.max(0, window.innerHeight - size.h - 40);
      setPos({
        x: Math.min(Math.max(0, e.clientX - dragOffset.current.x), maxX),
        y: Math.min(Math.max(0, e.clientY - dragOffset.current.y), maxY),
      });
    }
    if (resizing.current) {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      setSize({
        w: Math.max(420, resizeStart.current.w + dx),
        h: Math.max(320, resizeStart.current.h + dy),
      });
    }
  }, [size.w, size.h]);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    resizing.current = false;
  }, []);

  const onMouseDownResize = (e) => {
    if (isMaximized) return;
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
      setPos({ x: 0, y: 0 });
      setSize({ w: window.innerWidth, h: window.innerHeight });
      setIsMaximized(true);
    } else {
      const prev = prevSizeRef.current;
      setPos(prev.pos || { x: 200, y: 120 });
      setSize(prev.size || { w: 620, h: 440 });
      setIsMaximized(false);
    }
  };

  useEffect(() => {
    if (!isMaximized) return;
    const onResize = () => { setSize({ w: window.innerWidth, h: window.innerHeight }); setPos({ x: 0, y: 0 }); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMaximized]);

  if (!activeHuddle || !rtc) return null;

  // Network quality badge
  const netColor = { good: "text-green-400", ok: "text-yellow-400", poor: "text-red-400" }[networkQuality];
  const netLabel = { good: "●", ok: "◑", poor: "○" }[networkQuality];

  const videoAreaH = size.h - 108; // header ~44px + controls ~64px

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

      {/* ── VIDEO GRID ────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-[#0f111a] p-2 overflow-hidden min-h-0" style={{ height: videoAreaH }}>
        <div
          className="w-full h-full gap-2"
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
            />
          ))}
        </div>
      </div>

      {/* ── CONTROL BAR ───────────────────────────────────────────────────── */}
      <div
        className="w-full bg-[#1b1e27] py-3 px-6 flex justify-center items-center gap-3 shrink-0"
        style={{ borderRadius: isMaximized ? 0 : "0 0 0.75rem 0.75rem" }}
      >
        {/* Mic */}
        <CtrlBtn
          onClick={() => rtc.toggleMute?.()}
          title={rtc.isMuted ? "Unmute microphone" : "Mute microphone"}
          danger={rtc.isMuted}
        >
          {rtc.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </CtrlBtn>

        {/* Camera */}
        <CtrlBtn
          onClick={() => rtc.toggleCamera?.()}
          title={rtc.isCameraOff ? "Turn on camera" : "Turn off camera"}
          danger={rtc.isCameraOff}
        >
          {rtc.isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
        </CtrlBtn>

        {/* Screen share */}
        <CtrlBtn
          onClick={() =>
            rtc.isScreenSharing
              ? rtc.stopScreenShare?.()
              : rtc.startScreenShare?.()
          }
          title={rtc.isScreenSharing ? "Stop sharing screen" : "Share your screen"}
          active={rtc.isScreenSharing}
        >
          {rtc.isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </CtrlBtn>

        {/* Mute all — host only */}
        {isHost && (
          <CtrlBtn onClick={() => rtc.muteAll?.()} title="Mute all participants">
            <VolumeX size={18} />
          </CtrlBtn>
        )}

        <div className="w-px h-7 bg-slate-600 mx-1" />

        {/* Leave / End for all */}
        {isHost ? (
          <CtrlBtn
            onClick={() => rtc.endHuddleForAll?.()}
            title="End call for everyone"
            danger
            wide
          >
            <PhoneOff size={16} />
            <span>End for all</span>
          </CtrlBtn>
        ) : (
          <CtrlBtn
            onClick={() => rtc.leaveHuddle?.()}
            title="Leave call"
            danger
            wide
          >
            <PhoneOff size={16} />
            <span>Leave</span>
          </CtrlBtn>
        )}
      </div>

      {/* ── RESIZE HANDLE ─────────────────────────────────────────────────── */}
      {!isMaximized && (
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
