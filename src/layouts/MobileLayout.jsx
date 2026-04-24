// src/layouts/MobileLayout.jsx
// Full mobile layout — shown instead of AppLayout on phones.
// Features:
//   • Compact top header (status + attendance actions)
//   • Bottom navigation (5 primary tabs + More drawer)
//   • Safe-area insets for notch / home bar
//   • Touch-optimized scrollable content area

import { useState, useEffect, useMemo, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import toast from "react-hot-toast";
import MobileBottomNav from "../components/MobileBottomNav";
import GlobalHuddleWindow from "../huddle/GlobalHuddleWindow";
import HuddleIncomingCall from "../components/HuddleIncomingCall";
import { useHuddle } from "../context/HuddleContext";
import { Avatar, Badge, Button } from "../components/ui";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { subscribeToUnreadCount } from "../notificationBus";
import { getSocket, initSocket } from "../socket";
import { cn } from "../utils/cn";

export default function MobileLayout() {
  const { auth, logout, updateUser } = useAuth();
  const { incomingHuddle, acceptHuddle, declineHuddle } = useHuddle();
  const navigate = useNavigate();
  const api = useApi();
  const user = auth?.user;

  // Fix Android soft-keyboard: when keyboard closes the layout can stay "shrunk".
  // Use visualViewport to keep the root div exactly the actual visible height.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--vh", `${vv.height * 0.01}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Handle push notification tap → navigate to correct route
  useEffect(() => {
    const handler = (e) => {
      const url = e.detail?.url;
      if (url) navigate(url);
    };
    window.addEventListener("push:navigate", handler);
    if (window.__PUSH_NAVIGATE__) {
      navigate(window.__PUSH_NAVIGATE__);
      window.__PUSH_NAVIGATE__ = null;
    }
    return () => window.removeEventListener("push:navigate", handler);
  }, [navigate]);

  // Refresh stale auth.user on mount
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!auth?.token || refreshedRef.current) return;
    refreshedRef.current = true;
    api.get("/users/me").then((res) => {
      if (res.data) updateUser(res.data);
    }).catch(() => {});
  }, [auth?.token]);

  // ── Attendance state ────────────────────────────────────
  const [attendanceStatus, setAttendanceStatus] = useState(() => {
    try { return localStorage.getItem("attendanceStatus") || "offline"; }
    catch { return "offline"; }
  });

  const [idleThresholdMs, setIdleThresholdMs] = useState(5 * 60 * 1000);
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [awsLoading, setAwsLoading] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  useEffect(() => {
    api.get("/settings/attendance").then((res) => {
      const m = Number(res.data?.idleThresholdMinutes);
      if (Number.isFinite(m) && m > 0) setIdleThresholdMs(m * 60 * 1000);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    try { localStorage.setItem("attendanceStatus", attendanceStatus); } catch {}
  }, [attendanceStatus]);

  // Idle tracker
  useEffect(() => {
    if (!auth?.token || attendanceStatus === "offline") return;
    const markActive = async () => {
      setLastActivityAt(Date.now());
      if (isIdle && attendanceStatus === "available") {
        setIsIdle(false);
        try { await api.post("/attendance/screen-on"); } catch {}
      }
    };
    const checkIdle = async () => {
      if (isIdle || attendanceStatus !== "available") return;
      if (Date.now() - lastActivityAt >= idleThresholdMs) {
        setIsIdle(true);
        try { await api.post("/attendance/screen-off"); } catch {}
      }
    };
    const events = ["touchstart", "touchmove", "keydown"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const timer = setInterval(checkIdle, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      clearInterval(timer);
    };
  }, [auth?.token, attendanceStatus, isIdle, lastActivityAt, idleThresholdMs]);

  const statusMeta = useMemo(() => {
    switch (attendanceStatus) {
      case "available": return { label: "Available", dot: "bg-green-500",  color: "success" };
      case "aws":       return { label: "AWS",       dot: "bg-yellow-500", color: "warning" };
      case "lunch":     return { label: "Lunch",     dot: "bg-orange-500", color: "warning" };
      default:          return { label: "Offline",   dot: "bg-gray-400",   color: "neutral" };
    }
  }, [attendanceStatus]);

  const handleToggleSign = async () => {
    try {
      setToggleLoading(true);
      setAttendanceOpen(false);
      if (attendanceStatus === "offline") {
        await api.post("/attendance/sign-in");
        setAttendanceStatus("available");
        toast.success("Signed in");
      } else {
        await api.post("/attendance/sign-off");
        setAttendanceStatus("offline");
        setIsIdle(false);
        toast.success("Signed off");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setToggleLoading(false);
    }
  };

  const sendAws = async (minutes) => {
    try {
      setAwsLoading(true);
      setAttendanceOpen(false);
      await api.post("/attendance/aws", { minutes });
      setAttendanceStatus("aws");
      toast.success(`AWS for ${minutes} min`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setAwsLoading(false);
    }
  };

  const handleLunch = async () => {
    try {
      setAttendanceOpen(false);
      await api.post("/attendance/lunch");
      setAttendanceStatus("lunch");
      toast.success("Lunch break started");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const handleAvailable = async () => {
    try {
      setAttendanceOpen(false);
      await api.post("/attendance/available");
      setAttendanceStatus("available");
      toast.success("Available");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  // ── Unread notifications count ──────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!auth?.token) return;
    api.get("/notifications").then((res) => {
      if (!cancelled) setUnreadCount((res.data || []).filter((n) => !n.is_read).length);
    }).catch(() => {});
    let socket = getSocket();
    if (!socket && auth.token) socket = initSocket(auth.token);
    let off = () => {};
    if (socket) {
      const onNotif = () => { if (!cancelled) setUnreadCount((p) => p + 1); };
      socket.on("notification", onNotif);
      off = () => socket.off("notification", onNotif);
    }
    const unsub = subscribeToUnreadCount((c) => { if (!cancelled) setUnreadCount(c); });
    return () => { cancelled = true; off(); unsub(); };
  }, [auth?.token]);

  return (
    <div
      className="flex flex-col theme-bg theme-text overflow-hidden mobile-root"
      style={{ height: "calc(var(--vh, 1svh) * 100)" }}
    >
      {incomingHuddle && (
        <HuddleIncomingCall
          invite={incomingHuddle}
          onAccept={acceptHuddle}
          onDecline={declineHuddle}
        />
      )}

      {/* ── Top header ────────────────────────────────────── */}
      <header
        className="theme-surface border-b theme-border flex items-center justify-between px-4 shrink-0"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          minHeight: "calc(56px + env(safe-area-inset-top))",
        }}
      >
        {/* Left: avatar + name + status */}
        <div className="flex items-center gap-2.5">
          <Avatar name={user?.username} src={user?.avatar_url} size="sm" />
          <div>
            <p className="text-sm font-semibold theme-text leading-tight">{user?.username}</p>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full shrink-0", statusMeta.dot)} />
              <span className="text-xs theme-text-muted">{statusMeta.label}</span>
            </div>
          </div>
        </div>

        {/* Right: attendance quick-action + theme */}
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />

          {/* Attendance tap area */}
          <div className="relative">
            <button
              onClick={() => setAttendanceOpen((p) => !p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                attendanceStatus === "offline"
                  ? "bg-green-500/15 text-green-600"
                  : "bg-red-500/15 text-red-500"
              )}
            >
              {attendanceStatus === "offline" ? "Sign in" : "Sign off"}
            </button>

            {/* Attendance quick panel */}
            {attendanceOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAttendanceOpen(false)} />
                <div className="absolute right-0 top-10 z-50 theme-surface border theme-border
                                rounded-xl shadow-xl w-52 overflow-hidden">
                  <div className="p-1">
                    <button
                      onClick={handleToggleSign}
                      disabled={toggleLoading}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        attendanceStatus === "offline"
                          ? "text-green-600 hover:bg-green-500/10"
                          : "text-red-500 hover:bg-red-500/10"
                      )}
                    >
                      {attendanceStatus === "offline" ? "Sign in" : "Sign off"}
                    </button>

                    {attendanceStatus === "available" && (
                      <>
                        <div className="h-px theme-border mx-2 my-1" />
                        <p className="px-4 pt-1 pb-1 text-xs theme-text-muted font-medium uppercase tracking-wide">
                          Away from system
                        </p>
                        {[15, 30, 60].map((m) => (
                          <button
                            key={m}
                            onClick={() => sendAws(m)}
                            className="w-full text-left px-4 py-2.5 rounded-lg text-sm theme-text hover:bg-[var(--surface-soft)] transition-colors"
                          >
                            AWS — {m} min
                          </button>
                        ))}
                        <div className="h-px theme-border mx-2 my-1" />
                        <button
                          onClick={handleLunch}
                          className="w-full text-left px-4 py-2.5 rounded-lg text-sm theme-text hover:bg-[var(--surface-soft)] transition-colors"
                        >
                          Lunch break
                        </button>
                      </>
                    )}

                    {(attendanceStatus === "aws" || attendanceStatus === "lunch") && (
                      <>
                        <div className="h-px theme-border mx-2 my-1" />
                        <button
                          onClick={handleAvailable}
                          className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-blue-500 hover:bg-blue-500/10 transition-colors"
                        >
                          Mark Available
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Scrollable page content ───────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden mobile-scroll"
            style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>
        <Outlet />
      </main>

      {/* GlobalHuddleWindow must be outside any overflow container so fixed
          positioning and z-index work correctly on Android WebView */}
      <GlobalHuddleWindow />

      {/* ── Bottom navigation ─────────────────────────────── */}
      <MobileBottomNav unreadCount={unreadCount} />
    </div>
  );
}
