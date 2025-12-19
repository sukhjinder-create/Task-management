// src/layout/AppLayout.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import toast from "react-hot-toast";
import GlobalHuddleWindow from "../huddle/GlobalHuddleWindow"; // ⬅ floating huddle UI

export default function AppLayout({ children }) {
  const { logout, auth } = useAuth();
  const navigate = useNavigate();
  const api = useApi();

  const user = auth?.user;

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

  const [awsOpen, setAwsOpen] = useState(false);
  const [awsLoading, setAwsLoading] = useState(false);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // 🖥️ Screen / system activity tracking
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  const statusMeta = useMemo(() => {
    switch (attendanceStatus) {
      case "available":
        return {
          label: "Available",
          dotClass: "bg-emerald-500",
          pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "aws":
        return {
          label: "AWS",
          dotClass: "bg-amber-500",
          pillClass: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "lunch":
        return {
          label: "Lunch break",
          dotClass: "bg-orange-500",
          pillClass: "bg-orange-50 text-orange-700 border-orange-200",
        };
      default:
        return {
          label: "Offline",
          dotClass: "bg-slate-400",
          pillClass: "bg-slate-50 text-slate-600 border-slate-200",
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
      setAwsOpen(false);
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

  const baseSmallBtn =
    "text-xs px-3 py-1 rounded-lg border shadow-sm hover:bg-opacity-90 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="ml-60 flex-1 bg-slate-100 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-semibold">
                  {user.username
                    ? user.username.charAt(0).toUpperCase()
                    : "U"}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-800">
                    {user.username}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full border text-[11px] ${statusMeta.pillClass}`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${statusMeta.dotClass}`}
              />
              <span>{statusMeta.label}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSign}
                disabled={toggleLoading}
                className={
                  baseSmallBtn +
                  " " +
                  (attendanceStatus === "offline"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100")
                }
              >
                {toggleLoading
                  ? "Updating..."
                  : attendanceStatus === "offline"
                  ? "Sign in"
                  : "Sign off"}
              </button>

              {attendanceStatus !== "offline" && (
                <>
                  {attendanceStatus === "available" && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAwsOpen((p) => !p)}
                        className={
                          baseSmallBtn +
                          " bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        }
                      >
                        {awsLoading ? "AWS..." : "AWS"}
                      </button>

                      {awsOpen && (
                        <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 text-xs">
                          <div className="px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-100">
                            Away from system
                          </div>
                          <button
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-50"
                            onClick={() => sendAws(15)}
                          >
                            15 minutes
                          </button>
                          <button
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-50"
                            onClick={() => sendAws(30)}
                          >
                            30 minutes
                          </button>
                          <button
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-50"
                            onClick={() => sendAws(60)}
                          >
                            60 minutes
                          </button>
                          <button
                            className="w-full px-3 py-1.5 text-left hover:bg-slate-50 border-t border-slate-100"
                            onClick={handleAwsCustom}
                          >
                            Custom…
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {attendanceStatus === "available" && (
                    <button
                      type="button"
                      onClick={handleLunchClick}
                      disabled={lunchLoading}
                      className={
                        baseSmallBtn +
                        " bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                      }
                    >
                      {lunchLoading ? "Lunch..." : "Lunch"}
                    </button>
                  )}

                  {(attendanceStatus === "aws" ||
                    attendanceStatus === "lunch") && (
                    <button
                      type="button"
                      onClick={handleAvailableClick}
                      disabled={availableLoading}
                      className={
                        baseSmallBtn +
                        " bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      }
                    >
                      {availableLoading ? "Updating..." : "Available"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            className="text-sm bg-red-100 text-red-600 px-4 py-1.5 rounded-lg hover:bg-red-200 border border-red-200"
          >
            Logout
          </button>
        </header>

        <main className="px-6 py-6 relative flex-1 overflow-y-auto">
          <Outlet />
          <GlobalHuddleWindow />
        </main>
      </div>
    </div>
  );
}
