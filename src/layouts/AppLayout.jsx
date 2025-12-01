// src/layout/AppLayout.jsx
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function AppLayout({ children }) {
  const { logout, auth } = useAuth();
  const navigate = useNavigate();
  const api = useApi();

  // attendanceStatus can be:
  // "offline" | "available" | "aws" | "lunch"
  const [attendanceStatus, setAttendanceStatus] = useState(() => {
    try {
      return localStorage.getItem("attendanceStatus") || "offline";
    } catch {
      return "offline";
    }
  });

  useEffect(() => {
    localStorage.setItem("attendanceStatus", attendanceStatus);
  }, [attendanceStatus]);

  const [awsOpen, setAwsOpen] = useState(false);
  const [awsLoading, setAwsLoading] = useState(false);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // ───────────────────────────────────────────
  // SIGN IN / SIGN OFF TOGGLE
  // ───────────────────────────────────────────
  const handleToggleSign = async () => {
    try {
      setToggleLoading(true);

      if (attendanceStatus === "offline") {
        // SIGN IN
        await api.post("/attendance/sign-in");
        setAttendanceStatus("available");
        toast.success("Signed in. Slack updated.");
      } else {
        // SIGN OFF
        await api.post("/attendance/sign-off");
        setAttendanceStatus("offline");
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

  // ───────────────────────────────────────────
  // AWS
  // ───────────────────────────────────────────
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
    if (value) sendAws(Number(value));
  };

  // ───────────────────────────────────────────
  // LUNCH
  // ───────────────────────────────────────────
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

  // ───────────────────────────────────────────
  // AVAILABLE (after AWS or lunch)
  // ───────────────────────────────────────────
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

  return (
    <div className="flex">
      <Sidebar />

      <div className="ml-60 w-full min-h-screen bg-slate-100">
        {/* HEADER */}
        <header className="relative bg-white border-b border-slate-200 px-6 py-3 flex justify-end items-center gap-3">

          {/* ► Toggle SIGN IN / SIGN OFF button */}
          <button
            onClick={handleToggleSign}
            disabled={toggleLoading}
            className={`text-xs px-3 py-1 rounded-lg border shadow-sm 
              ${
                attendanceStatus === "offline"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
              }
              disabled:opacity-60`}
          >
            {toggleLoading
              ? "Updating..."
              : attendanceStatus === "offline"
              ? "Sign in"
              : "Sign off"}
          </button>

          {/* Show AWS + Lunch ONLY when signed in */}
          {attendanceStatus !== "offline" && (
            <>
              {/* AWS Button */}
              {attendanceStatus === "available" && (
                <div className="relative">
                  <button
                    onClick={() => setAwsOpen((p) => !p)}
                    className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-200 hover:bg-amber-100"
                  >
                    AWS
                  </button>

                  {awsOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-20 text-xs">
                      <button
                        className="w-full px-3 py-1.5 hover:bg-slate-50"
                        onClick={() => sendAws(15)}
                      >
                        15 minutes
                      </button>
                      <button
                        className="w-full px-3 py-1.5 hover:bg-slate-50"
                        onClick={() => sendAws(30)}
                      >
                        30 minutes
                      </button>
                      <button
                        className="w-full px-3 py-1.5 hover:bg-slate-50"
                        onClick={() => sendAws(60)}
                      >
                        60 minutes
                      </button>

                      <button
                        className="w-full px-3 py-1.5 hover:bg-slate-50 border-t border-slate-100"
                        onClick={handleAwsCustom}
                      >
                        Custom…
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Lunch Button */}
              {attendanceStatus === "available" && (
                <button
                  onClick={handleLunchClick}
                  disabled={lunchLoading}
                  className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-200 hover:bg-orange-100"
                >
                  {lunchLoading ? "Lunch..." : "Lunch"}
                </button>
              )}

              {/* Available Button (for AWS & lunch modes) */}
              {(attendanceStatus === "aws" ||
                attendanceStatus === "lunch") && (
                <button
                  onClick={handleAvailableClick}
                  disabled={availableLoading}
                  className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-100"
                >
                  {availableLoading ? "Updating..." : "Available"}
                </button>
              )}
            </>
          )}

          {/* Logout button */}
          <button
            onClick={logout}
            className="text-sm bg-red-100 text-red-600 px-4 py-1 rounded-lg hover:bg-red-200"
          >
            Logout
          </button>
        </header>

        {/* MAIN PAGE */}
        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
