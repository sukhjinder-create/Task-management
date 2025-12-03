// src/huddle/GlobalHuddleWindow.jsx
import { useState, useEffect, useRef } from "react";
import { useHuddle } from "../context/HuddleContext";

export default function GlobalHuddleWindow() {
  const {
    activeHuddle,
    rtc: {
      joined,
      connecting,
      localStream,
      remotePeers,
      toggleMute,
      toggleCamera,
      startScreenShare,
      stopScreenShare,
      isMuted,
      isCameraOff,
      isScreenSharing,
      requestFullscreen,
      fullscreenTargetRef,
      leaveHuddle,
      joinHuddle,
    },
  } = useHuddle() || {};

  // If provider didn't load yet → render nothing
  if (!useHuddle()) return null;

  if (!activeHuddle) return null;

  // -----------------------------
  // Floating Window Dragging
  // -----------------------------
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("huddleWindowPos"));
      return saved || { x: 20, y: 20 };
    } catch {
      return { x: 20, y: 20 };
    }
  });

  const [size, setSize] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("huddleWindowSize"));
      return saved || { width: 350, height: 260 };
    } catch {
      return { width: 350, height: 260 };
    }
  });

  const draggingRef = useRef(false);
  const resizingRef = useRef(false);

  const lastMouse = useRef({ x: 0, y: 0 });

  const startDrag = (e) => {
    draggingRef.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const stopDrag = () => {
    draggingRef.current = false;
    resizingRef.current = false;
  };

  const startResize = (e) => {
    e.stopPropagation();
    resizingRef.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (draggingRef.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      setPos((prev) => {
        const updated = { x: prev.x + dx, y: prev.y + dy };
        localStorage.setItem("huddleWindowPos", JSON.stringify(updated));
        return updated;
      });
    }

    if (resizingRef.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      setSize((prev) => {
        const updated = {
          width: Math.max(280, prev.width + dx),
          height: Math.max(200, prev.height + dy),
        };
        localStorage.setItem("huddleWindowSize", JSON.stringify(updated));
        return updated;
      });
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, []);

  // -----------------------------

  return (
    <div
      className="fixed bg-white shadow-2xl border rounded-xl z-[99999]"
      style={{
        top: pos.y,
        left: pos.x,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Header (draggable) */}
      <div
        className="cursor-move bg-slate-800 text-white px-3 py-2 rounded-t-xl flex justify-between items-center"
        onMouseDown={startDrag}
      >
        <span className="text-sm font-medium">
          Huddle – {activeHuddle?.channelId}
        </span>

        <div className="flex items-center gap-2">
          {/* Fullscreen */}
          <button
            className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600"
            onClick={requestFullscreen}
          >
            Fullscreen
          </button>

          {/* Close */}
          <button
            className="text-xs bg-red-500 px-2 py-1 rounded hover:bg-red-600"
            onClick={leaveHuddle}
          >
            End
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div
        className="relative bg-black rounded-b-xl overflow-hidden"
        ref={fullscreenTargetRef}
        style={{
          width: "100%",
          height: size.height - 48,
        }}
      >
        {/* MAIN VIDEO GRID */}
        <div className="w-full h-full grid grid-cols-2 gap-1 p-1">
          {/* Local Stream */}
          {localStream && (
            <video
              className="bg-black rounded object-cover w-full h-full"
              ref={(el) => el && (el.srcObject = localStream)}
              autoPlay
              muted
            />
          )}

          {/* Remote Streams */}
          {remotePeers.map((peer) => (
            <video
              key={peer.userId}
              className="bg-black rounded object-cover w-full h-full"
              ref={(el) => el && (el.srcObject = peer.stream)}
              autoPlay
            />
          ))}

          {remotePeers.length === 0 && !localStream && (
            <div className="text-white text-xs flex items-center justify-center opacity-40">
              Waiting for video…
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-3 bg-slate-900 bg-opacity-70 px-4 py-2 rounded-full">
          <button
            className={`px-3 py-1 rounded ${
              isMuted ? "bg-red-600" : "bg-slate-700"
            } text-white`}
            onClick={toggleMute}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>

          <button
            className={`px-3 py-1 rounded ${
              isCameraOff ? "bg-red-600" : "bg-slate-700"
            } text-white`}
            onClick={toggleCamera}
          >
            {isCameraOff ? "Camera Off" : "Camera On"}
          </button>

          {!isScreenSharing ? (
            <button
              className="px-3 py-1 rounded bg-slate-700 text-white"
              onClick={startScreenShare}
            >
              Share Screen
            </button>
          ) : (
            <button
              className="px-3 py-1 rounded bg-red-600 text-white"
              onClick={stopScreenShare}
            >
              Stop Sharing
            </button>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 w-4 h-4 bg-slate-700 cursor-se-resize rounded-tr-lg"
        ></div>
      </div>
    </div>
  );
}
