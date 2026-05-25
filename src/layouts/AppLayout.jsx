// src/layout/AppLayout.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { LogOut, Search, Command, ChevronDown } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import toast from "react-hot-toast";
import GlobalHuddleWindow from "../huddle/GlobalHuddleWindow";
import { Avatar, Button, Dropdown } from "../components/ui";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { usePlan } from "../context/PlanContext";
import { cn } from "../utils/cn";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileLayout from "./MobileLayout";
import { useAppUpdate } from "../hooks/useAppUpdate";
import AppUpdateModal from "../components/AppUpdateModal";
import HuddleIncomingCall from "../components/HuddleIncomingCall";
import { useHuddle } from "../context/HuddleContext";

const SIDEBAR_KEY = "sidebarCollapsed";

export default function AppLayout({ children }) {
  const isMobile = useIsMobile();
  const { updateInfo, dismissUpdate } = useAppUpdate();
  const { incomingHuddle, acceptHuddle, declineHuddle } = useHuddle();
  if (isMobile) return <MobileLayout />;

  const { logout, auth, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const { onTrial, trialEndsAt, trialExpired } = usePlan();

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000))
    : 0;

  const user = auth?.user;

  // Push notification tap → route
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

  // Refresh stale auth.user from server on mount
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!auth?.token || refreshedRef.current) return;
    refreshedRef.current = true;
    api.get("/users/me").then((res) => {
      if (res.data) updateUser(res.data);
    }).catch(() => {});
  }, [auth?.token]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "true"
  );
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const [attendanceStatus, setAttendanceStatus] = useState(() => {
    try {
      return localStorage.getItem("attendanceStatus") || "offline";
    } catch {
      return "offline";
    }
  });

  const [idleThresholdMs, setIdleThresholdMs] = useState(5 * 60 * 1000);

  useEffect(() => {
    let mounted = true;
    const loadAttendanceSettings = async () => {
      try {
        const res = await api.get("/settings/attendance");
        const minutes = Number(res.data?.idleThresholdMinutes);
        if (mounted && Number.isFinite(minutes) && minutes > 0) {
          setIdleThresholdMs(minutes * 60 * 1000);
        }
      } catch {}
    };
    loadAttendanceSettings();
    return () => { mounted = false; };
  }, [api]);

  useEffect(() => {
    try { localStorage.setItem("attendanceStatus", attendanceStatus); } catch {}
  }, [attendanceStatus]);

  const [awsLoading, setAwsLoading] = useState(false);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const isChatRoute = location.pathname.startsWith("/chat");

  // Idle tracking
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  const statusMeta = useMemo(() => {
    switch (attendanceStatus) {
      case "available":
        return { label: "Available", dot: "bg-[color:var(--score-good)]", tone: "good" };
      case "aws":
        return { label: "AWS",       dot: "brand-orange-bg", tone: "warn" };
      case "lunch":
        return { label: "Lunch",     dot: "brand-orange-bg", tone: "warn" };
      default:
        return { label: "Offline",   dot: "bg-[color:var(--text-soft)]", tone: "neutral" };
    }
  }, [attendanceStatus]);

  const handleToggleSign = async () => {
    try {
      setToggleLoading(true);
      if (attendanceStatus === "offline") {
        await api.post("/attendance/sign-in");
        setAttendanceStatus("available");
        toast.success("Signed in. Slack updated.");
      } else {
        await api.post("/attendance/sign-off");
        setAttendanceStatus("offline");
        setIsIdle(false);
        toast.success("Signed off. Slack updated.");
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to update attendance";
      toast.error(msg);
    } finally {
      setToggleLoading(false);
    }
  };

  const sendAws = async (minutes) => {
    try {
      setAwsLoading(true);
      await api.post("/attendance/aws", { minutes });
      setAttendanceStatus("aws");
      toast.success(`AWS for ${minutes} minutes.`);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to record AWS";
      toast.error(msg);
    } finally {
      setAwsLoading(false);
    }
  };

  const handleAwsCustom = () => {
    const value = window.prompt("AWS minutes?", "30");
    if (!value) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Please enter a valid number of minutes.");
      return;
    }
    sendAws(num);
  };

  const handleLunchClick = async () => {
    try {
      setLunchLoading(true);
      await api.post("/attendance/lunch");
      setAttendanceStatus("lunch");
      toast.success("Lunch break started.");
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to start lunch break";
      toast.error(msg);
    } finally {
      setLunchLoading(false);
    }
  };

  const handleAvailableClick = async () => {
    try {
      setAvailableLoading(true);
      await api.post("/attendance/available");
      setAttendanceStatus("available");
      toast.success("You are available again.");
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to update availability";
      toast.error(msg);
    } finally {
      setAvailableLoading(false);
    }
  };

  // Idle / screen-on / screen-off tracking
  useEffect(() => {
    if (!auth?.token) return;
    if (attendanceStatus === "offline") return;
    let idleTimer;
    const markActive = async () => {
      setLastActivityAt(Date.now());
      if (isIdle && attendanceStatus === "available") {
        setIsIdle(false);
        try { await api.post("/attendance/screen-on"); } catch {}
      }
    };
    const checkIdle = async () => {
      if (isIdle) return;
      if (attendanceStatus !== "available") return;
      const now = Date.now();
      if (now - lastActivityAt >= idleThresholdMs) {
        setIsIdle(true);
        try { await api.post("/attendance/screen-off"); } catch {}
      }
    };
    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive));
    idleTimer = setInterval(checkIdle, 30 * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      clearInterval(idleTimer);
    };
  }, [auth?.token, attendanceStatus, isIdle, lastActivityAt, idleThresholdMs, api]);

  return (
    <div className="flex h-screen overflow-hidden theme-bg theme-text">
      {updateInfo && (
        <AppUpdateModal
          version={updateInfo.version}
          apkUrl={updateInfo.apkUrl}
          onDismiss={dismissUpdate}
        />
      )}
      {incomingHuddle && (
        <HuddleIncomingCall
          invite={incomingHuddle}
          onAccept={acceptHuddle}
          onDecline={declineHuddle}
        />
      )}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden theme-bg",
          "transition-[margin-left] duration-200 ease-out",
          sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"
        )}
      >
        {/* ── Topbar ─────────────────────────────────────────────────
            Dense, deliberate. Identity + status + attendance on the
            left, command bar + global controls on the right.
        */}
        <header
          className={cn(
            "h-[52px] shrink-0 flex items-center justify-between gap-4",
            "border-b border-[color:var(--border)] bg-[var(--app-bg)] px-4"
          )}
        >
          {/* LEFT — identity + attendance */}
          <div className="flex items-center gap-3 min-w-0">
            {user && (
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  name={user.username}
                  src={user.avatar_url}
                  size="sm"
                />
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-[13px] font-medium text-[color:var(--text)] truncate">
                    {user.username}
                  </span>
                  <span className="text-[10.5px] text-[color:var(--text-soft)] capitalize tracking-wide">
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            <span className="h-5 w-px bg-[color:var(--border)] mx-1" />

            {/* Status pill */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2 h-7 rounded-[6px]",
                "border border-[color:var(--border)] bg-[var(--surface-soft)]",
                "text-[11.5px] font-medium tracking-tight",
                statusMeta.tone === "good"    && "text-[color:var(--score-good)]",
                statusMeta.tone === "warn"    && "brand-orange-text",
                statusMeta.tone === "neutral" && "text-[color:var(--text-muted)]"
              )}
            >
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
              {statusMeta.label}
              {isIdle && attendanceStatus === "available" && (
                <span className="ml-1 text-[10px] text-[color:var(--text-soft)]">· idle</span>
              )}
            </div>

            {/* Attendance actions */}
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleToggleSign}
                disabled={toggleLoading}
                loading={toggleLoading}
                variant={attendanceStatus === "offline" ? "primary" : "secondary"}
                size="sm"
              >
                {attendanceStatus === "offline" ? "Sign in" : "Sign off"}
              </Button>

              {attendanceStatus !== "offline" && (
                <>
                  {attendanceStatus === "available" && (
                    <Dropdown>
                      {({ isOpen, setIsOpen }) => (
                        <>
                          <Dropdown.Trigger onClick={() => setIsOpen(!isOpen)}>
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={awsLoading}
                              rightIcon={<ChevronDown className="w-3.5 h-3.5" />}
                            >
                              AWS
                            </Button>
                          </Dropdown.Trigger>
                          <Dropdown.Menu isOpen={isOpen} align="left">
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)] border-b border-[color:var(--border)]">
                              Away from system
                            </div>
                            <Dropdown.Item onClick={() => sendAws(15)}>15 minutes</Dropdown.Item>
                            <Dropdown.Item onClick={() => sendAws(30)}>30 minutes</Dropdown.Item>
                            <Dropdown.Item onClick={() => sendAws(60)}>60 minutes</Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item onClick={handleAwsCustom}>Custom…</Dropdown.Item>
                          </Dropdown.Menu>
                        </>
                      )}
                    </Dropdown>
                  )}

                  {attendanceStatus === "available" && (
                    <Button
                      onClick={handleLunchClick}
                      disabled={lunchLoading}
                      loading={lunchLoading}
                      variant="secondary"
                      size="sm"
                    >
                      Lunch
                    </Button>
                  )}

                  {(attendanceStatus === "aws" || attendanceStatus === "lunch") && (
                    <Button
                      onClick={handleAvailableClick}
                      disabled={availableLoading}
                      loading={availableLoading}
                      variant="primary"
                      size="sm"
                    >
                      Resume
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT — global controls */}
          <div className="flex items-center gap-2">
            {/* Search hint — pure UI hint, opens nothing yet (preserves current product behavior) */}
            <div className="hidden md:inline-flex items-center gap-2 px-2.5 h-7 rounded-[6px] border border-[color:var(--border)] bg-[var(--surface-soft)] text-[color:var(--text-soft)] text-[11.5px]">
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
              <span className="inline-flex items-center gap-0.5 ml-1">
                <kbd className="kbd"><Command className="w-2.5 h-2.5" /></kbd>
                <kbd className="kbd">K</kbd>
              </span>
            </div>

            <ThemeSwitcher compact />

            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              className="text-[color:var(--score-danger)] hover:bg-[color:var(--score-danger-bg)]"
            >
              Logout
            </Button>
          </div>
        </header>

        {/* Trial Banner — flat, dense, scannable */}
        {(onTrial || trialExpired) && (
          <div
            className={cn(
              "px-4 py-1.5 text-[11.5px] font-medium flex items-center justify-center gap-2 border-b",
              trialExpired
                ? "bg-[color:var(--score-danger-bg)] text-[color:var(--score-danger)] border-[color:var(--score-danger-border)]"
                : trialDaysLeft <= 2
                ? "bg-[color:var(--score-warning-bg)] text-[color:var(--score-warning)] border-[color:var(--score-warning-border)]"
                : "bg-[var(--primary-soft)] text-[color:var(--primary)] border-[color:color-mix(in_srgb,var(--primary)_28%,var(--border))]"
            )}
          >
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", trialExpired ? "bg-[color:var(--score-danger)]" : trialDaysLeft <= 2 ? "bg-[color:var(--score-warning)]" : "bg-[color:var(--primary)]")} />
            {trialExpired
              ? "Free trial has expired. Contact your administrator to upgrade the workspace plan."
              : `Free trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining. Full access to all features.`}
          </div>
        )}

        {/* Main content — flat on canvas */}
        <main
          className={cn(
            "relative flex-1 theme-bg",
            isChatRoute ? "overflow-hidden" : "overflow-y-auto",
            isChatRoute ? "" : "px-6 py-5"
          )}
        >
          <Outlet />
        </main>
      </div>

      <GlobalHuddleWindow />
    </div>
  );
}
