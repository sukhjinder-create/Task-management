// src/layout/AppLayout.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import toast from "react-hot-toast";
import GlobalHuddleWindow from "../huddle/GlobalHuddleWindow";
import { Avatar, Badge, Button, Dropdown } from "../components/ui";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { cn } from "../utils/cn";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileLayout from "./MobileLayout";

const SIDEBAR_KEY = "sidebarCollapsed";

export default function AppLayout({ children }) {
  const isMobile = useIsMobile();
  // On mobile, hand off entirely to MobileLayout
  if (isMobile) return <MobileLayout />;

  const { logout, auth, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();

  const user = auth?.user;

  // Refresh stale auth.user from server on mount (avatar_url etc. may have changed since last login)
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!auth?.token || refreshedRef.current) return;
    refreshedRef.current = true;
    api.get("/users/me").then((res) => {
      if (res.data) updateUser(res.data);
    }).catch(() => {/* silent — stale data is acceptable fallback */});
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

  const [idleThresholdMs, setIdleThresholdMs] = useState(
    5 * 60 * 1000
  );

  useEffect(() => {
    let mounted = true;

    const loadAttendanceSettings = async () => {
      try {
        const res = await api.get("/settings/attendance");
        const minutes = Number(res.data?.idleThresholdMinutes);

        if (mounted && Number.isFinite(minutes) && minutes > 0) {
          setIdleThresholdMs(minutes * 60 * 1000);
        }
      } catch {
        // silent fallback
      }
    };

    loadAttendanceSettings();

    return () => {
      mounted = false;
    };
  }, [api]);

  useEffect(() => {
    try {
      localStorage.setItem("attendanceStatus", attendanceStatus);
    } catch {}
  }, [attendanceStatus]);

  const [awsLoading, setAwsLoading] = useState(false);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const isChatRoute = location.pathname.startsWith("/chat");

  // 🖥️ Screen / system activity tracking
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  const statusMeta = useMemo(() => {
    switch (attendanceStatus) {
      case "available":
        return {
          label: "Available",
          dotClass: "bg-success-500",
          color: "success",
        };
      case "aws":
        return {
          label: "AWS",
          dotClass: "bg-warning-500",
          color: "warning",
        };
      case "lunch":
        return {
          label: "Lunch break",
          dotClass: "bg-warning-600",
          color: "warning",
        };
      default:
        return {
          label: "Offline",
          dotClass: "bg-gray-400",
          color: "neutral",
        };
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
        setIsIdle(false); // ✅ reset idle
        toast.success("Signed off. Slack updated.");
      }
    } catch (err) {
      const msg =
        err.response?.data?.error || "Failed to update attendance";
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
      const msg =
        err.response?.data?.error || "Failed to record AWS";
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
      const msg =
        err.response?.data?.error || "Failed to start lunch break";
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
      const msg =
        err.response?.data?.error || "Failed to update availability";
      toast.error(msg);
    } finally {
      setAvailableLoading(false);
    }
  };

  // ✅ FIXED IDLE / SCREEN TRACKING
  useEffect(() => {
    if (!auth?.token) return;
    if (attendanceStatus === "offline") return;

    let idleTimer;

    const markActive = async () => {
      setLastActivityAt(Date.now());

      if (isIdle && attendanceStatus === "available") {
        setIsIdle(false);
        try {
          await api.post("/attendance/screen-on");
        } catch {}
      }
    };

    const checkIdle = async () => {
      if (isIdle) return; // ✅ prevent duplicate screen-off
      if (attendanceStatus !== "available") return;

      const now = Date.now();
      if (now - lastActivityAt >= idleThresholdMs) {
        setIsIdle(true);
        try {
          await api.post("/attendance/screen-off");
        } catch {}
      }
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive));

    idleTimer = setInterval(checkIdle, 30 * 1000);

    return () => {
      events.forEach((e) =>
        window.removeEventListener(e, markActive)
      );
      clearInterval(idleTimer);
    };
  }, [
    auth?.token,
    attendanceStatus,
    isIdle,
    lastActivityAt,
    idleThresholdMs,
    api,
  ]);

  return (
    <div className="flex h-screen overflow-hidden theme-bg theme-text">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div
        className={cn(
          "flex-1 theme-bg flex flex-col overflow-hidden transition-[margin-left] duration-200 ease-in-out",
          sidebarCollapsed ? "ml-16" : "ml-60"
        )}
      >
        {/* Enhanced Header */}
        <header className="h-16 theme-surface border-b theme-border px-6 flex justify-between items-center">
          {/* Left side: User info and status */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <Avatar name={user.username} src={user.avatar_url} size="md" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold theme-text">
                    {user.username}
                  </span>
                  <span className="text-xs theme-text-muted capitalize">
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            {/* Status Badge */}
            <Badge color={statusMeta.color} size="md" variant="subtle">
              <span className={cn("inline-block w-2 h-2 rounded-full", statusMeta.dotClass)} />
              {statusMeta.label}
            </Badge>

            {/* Attendance Actions */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleToggleSign}
                disabled={toggleLoading}
                loading={toggleLoading}
                variant={attendanceStatus === "offline" ? "success" : "danger"}
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
                              className="bg-warning-50 text-warning-700 border-warning-200 hover:bg-warning-100"
                            >
                              AWS
                            </Button>
                          </Dropdown.Trigger>
                          <Dropdown.Menu isOpen={isOpen} align="left">
                            <div className="px-3 py-2 text-xs font-medium theme-text-muted border-b theme-border">
                              Away from system
                            </div>
                            <Dropdown.Item onClick={() => sendAws(15)}>
                              15 minutes
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => sendAws(30)}>
                              30 minutes
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => sendAws(60)}>
                              60 minutes
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item onClick={handleAwsCustom}>
                              Custom…
                            </Dropdown.Item>
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
                      className="bg-warning-50 text-warning-700 border-warning-200 hover:bg-warning-100"
                    >
                      Lunch
                    </Button>
                  )}

                  {(attendanceStatus === "aws" || attendanceStatus === "lunch") && (
                    <Button
                      onClick={handleAvailableClick}
                      disabled={availableLoading}
                      loading={availableLoading}
                      variant="secondary"
                      size="sm"
                      className="bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100"
                    >
                      Available
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right side: Logout */}
          <div className="flex items-center gap-3">
            <ThemeSwitcher compact />
            <Button onClick={logout} variant="danger" size="sm" leftIcon={<LogOut className="w-4 h-4" />}>
              Logout
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main
          className={cn(
            "p-4 relative flex-1",
            isChatRoute ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          {isChatRoute ? (
            <Outlet />
          ) : (
            <div className="min-h-full rounded-2xl border theme-border theme-surface shadow-lg p-3 md:p-4">
              <Outlet />
            </div>
          )}
          <GlobalHuddleWindow />
        </main>
      </div>
    </div>
  );
}
