// src/huddle/GlobalHuddleWindow.jsx
import { useEffect, useState, useRef } from "react";
import { useHuddle } from "../context/HuddleContext";

// Small helper component for remote peer video
function RemotePeerVideo({ peer }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!peer || !peer.stream) {
      if (video.srcObject) video.srcObject = null;
      return;
    }

    if (video.srcObject !== peer.stream) {
      video.srcObject = peer.stream;
    }

    const play = () => {
      video.play().catch(() => {
        /* ignore autoplay errors */
      });
    };

    if (video.readyState >= 2) {
      play();
    } else {
      video.onloadedmetadata = play;
    }
  }, [peer]);

  return (
  <div className="absolute bottom-3 right-3">
    <video
      ref={videoRef}
      playsInline
      className="w-32 h-24 object-cover rounded-lg border border-white/20 shadow-lg"
    />
    <div className="absolute bottom-0 left-0 right-0 text-[10px] text-white bg-black/60 px-1 rounded-b">
      {peer.username || "User"}
    </div>
  </div>
);}

export default function GlobalHuddleWindow() {
  const huddleCtx = useHuddle();
  const activeHuddle = huddleCtx?.activeHuddle || null;
  const isHost =
  activeHuddle?.startedBy?.userId === huddleCtx?.currentUser?.id;
  const rtc = huddleCtx?.rtc || null;
  const activeSpeakerId = rtc?.activeSpeakerId;

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Default size for floating window
  const [pos, setPos] = useState({ x: 200, y: 120 });
  const [size, setSize] = useState({ w: 540, h: 400 }); // a bit bigger by default

  const windowRef = useRef(null);
  const localVideoRef = useRef(null);

  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ w: 0, h: 0, x: 0, y: 0 });

  // -------------------------
  // Attach local video stream (no blinking)
  // -------------------------
  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    // If rtc is not ready yet, clear stream & bail
    if (!rtc || !rtc.localStream) {
      if (video.srcObject) video.srcObject = null;
      return;
    }

    if (video.srcObject !== rtc.localStream) {
      video.srcObject = rtc.localStream;
    }

    video.muted = true;

    const play = () => {
      video.play().catch(() => {
        /* ignore autoplay errors */
      });
    };

    if (video.readyState >= 2) {
      play();
    } else {
      video.onloadedmetadata = play;
    }
  }, [rtc]);

  // -------------------------
  // Dragging
  // -------------------------
  const onMouseDownDrag = (e) => {
    if (isFullscreen) return;
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  };

  const onMouseMove = (e) => {
    if (dragging.current) {
      const nextX = e.clientX - dragOffset.current.x;
      const nextY = e.clientY - dragOffset.current.y;

      const maxX = Math.max(0, window.innerWidth - size.w);
      const maxY = Math.max(0, window.innerHeight - size.h - 40);

      setPos({
        x: Math.min(Math.max(0, nextX), maxX),
        y: Math.min(Math.max(0, nextY), maxY),
      });
    }
    if (resizing.current) {
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      const minW = 380;
      const minH = 280;

      const nextW = Math.max(minW, resizeStart.current.w + dx);
      const nextH = Math.max(minH, resizeStart.current.h + dy);

      setSize({
        w: nextW,
        h: nextH,
      });
    }
  };

  const onMouseUp = () => {
    dragging.current = false;
    resizing.current = false;
  };

  // -------------------------
  // Resizing
  // -------------------------
  const onMouseDownResize = (e) => {
    if (isFullscreen) return;
    e.stopPropagation();
    resizing.current = true;
    resizeStart.current = {
      w: size.w,
      h: size.h,
      x: e.clientX,
      y: e.clientY,
    };
  };

  // -------------------------
  // Fullscreen toggle
  // -------------------------
  const toggleFullscreen = () => {
    if (!rtc) return;

    if (!isFullscreen) {
      setPos({ x: 0, y: 0 });
      setSize({ w: window.innerWidth, h: window.innerHeight });
      setIsFullscreen(true);
      if (typeof rtc.requestFullscreen === "function") {
        rtc.requestFullscreen();
      }
    } else {
      setSize({ w: 540, h: 400 });
      setPos({ x: 200, y: 120 });
      setIsFullscreen(false);
      if (typeof rtc.exitFullscreen === "function") {
        rtc.exitFullscreen();
      }
    }
  };

  // Keep fullscreen window in sync with viewport resize
  useEffect(() => {
    if (!isFullscreen) return;

    const handleResize = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight });
      setPos({ x: 0, y: 0 });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isFullscreen]);

  // -------------------------
  // Close / Leave Huddle
  // -------------------------
  const leave = () => {
    if (!rtc) return;
    if (typeof rtc.leaveHuddle === "function") {
      rtc.leaveHuddle();
    }
  };

  // -------------------------
  // Global mouse events for drag / resize
  // -------------------------
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If no active huddle or no rtc, hide window completely
  if (!activeHuddle || !rtc) return null;

  const remotePeers = Array.isArray(rtc.remotePeers) ? rtc.remotePeers : [];

  return (
    <div
      ref={windowRef}
      className="fixed bg-[#0f111a] text-white shadow-2xl rounded-xl border border-slate-800 z-[999999]"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        transition: isFullscreen ? "all 0.2s ease" : "none",
      }}
    >
      {/* ██████████████ TOP BAR ██████████████ */}
      <div
        onMouseDown={onMouseDownDrag}
        className="w-full px-3 py-2 bg-[#1b1e27] cursor-move rounded-t-xl flex justify-between items-center select-none"
      >
        <div className="font-semibold text-sm">
          Huddle – {activeHuddle.startedBy?.username || "Huddle"}
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>

          {/* Single End Button (for this window) */}
          <button
            type="button"
            onClick={leave}
            className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500"
          >
            End
          </button>
        </div>
      </div>

      {/* ██████████████ VIDEO AREA ██████████████ */}
      <div
        className="relative w-full bg-black overflow-hidden"
        style={{ height: size.h - 110 }}
      >
        <div
          ref={rtc.fullscreenTargetRef}
          className="w-full h-full flex items-center justify-center bg-black"
        >
          {/* Local video */}
          {rtc.localStream ? (
            <video
  ref={localVideoRef}
  muted
  playsInline
  className={`w-full h-full object-cover rounded-lg ${
  activeSpeakerId === "local"
    ? "ring-4 ring-green-400"
    : ""
}`}
/>
          ) : (
            <div className="text-gray-400 text-sm">Connecting camera…</div>
          )}
          <div className="absolute top-2 right-2 bg-black/70 rounded-lg p-2 text-[11px]">
  <div className="font-semibold mb-1">Participants</div>

  <div className="space-y-1">
    <div>You (You)</div>
    {remotePeers.map(p => (
      <div key={p.userId}>
        {p.isMuted ? "🔇" : "🎤"} {p.username || "User"}
      </div>
    ))}
  </div>
</div>
        </div>
        {/* Remote videos */}
        {remotePeers.map((peer) => (
          <RemotePeerVideo key={peer.userId || peer.id} peer={peer} />
        ))}
      </div>

      {/* ██████████████ CONTROL BAR ██████████████ */}
      <div className="w-full bg-[#1b1e27] py-3 px-6 flex justify-center gap-6 rounded-b-xl">
        {/* MUTE */}
        <button
          type="button"
          onClick={() => rtc.toggleMute && rtc.toggleMute()}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600"
        >
          {rtc.isMuted ? "🔇" : "🎤"}
        </button>

        {/* CAMERA */}
        <button
          type="button"
          onClick={() => rtc.toggleCamera && rtc.toggleCamera()}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600"
        >
          {rtc.isCameraOff ? "📷❌" : "📷"}
        </button>

        {/* SCREEN SHARE */}
        <button
          type="button"
          onClick={() =>
            rtc.isScreenSharing
              ? rtc.stopScreenShare && rtc.stopScreenShare()
              : rtc.startScreenShare && rtc.startScreenShare()
          }
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600"
        >
          {rtc.isScreenSharing ? "🛑" : "🖥️"}
        </button>

        {isHost && (
  <button
    type="button"
    onClick={() => rtc.muteAll?.()}
    className="w-12 h-12 flex items-center justify-center rounded-full bg-red-700 hover:bg-red-600"
    title="Mute all"
  >
    🔇
  </button>
)}

      </div>

      {/* Resize handle */}
      {!isFullscreen && (
        <div
          onMouseDown={onMouseDownResize}
          className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize bg-slate-500 rounded"
        />
      )}
    </div>
  );
}
