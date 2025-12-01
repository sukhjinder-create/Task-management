// src/pages/Notifications.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { getSocket, initSocket } from "../socket";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { publishUnreadCount } from "../notificationBus";

function formatType(type) {
  switch (type) {
    case "project_assigned":
      return "Project assigned";
    case "task_assigned":
      return "Task assigned";
    case "task_updated":
      return "Task updated";
    case "task_deleted":
      return "Task deleted";
    case "comment_added":
      return "New comment";
    case "comment_mention":
      return "Mention in comment";
    default:
      return type;
  }
}

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "project_assigned", label: "Project assigned" },
  { value: "task_assigned", label: "Task assigned" },
  { value: "task_updated", label: "Task updated" },
  { value: "task_deleted", label: "Task deleted" },
  { value: "comment_added", label: "New comment" },
  { value: "comment_mention", label: "Mention in comment" },
];

export default function Notifications() {
  const api = useApi();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  // UI filters
  const [tab, setTab] = useState("all"); // "all" | "unread"
  const [typeFilter, setTypeFilter] = useState("all");

  // Helper: compute unread and broadcast to sidebar
  const updateUnreadCount = (list) => {
    const unread = (list || []).filter((n) => !n.is_read).length;
    publishUnreadCount(unread);
  };

  // Initial load
  useEffect(() => {
    async function loadNotifications() {
      setLoading(true);
      try {
        const res = await api.get("/notifications");
        const list = res.data || [];
        setNotifications(list);
        updateUnreadCount(list);
      } catch (err) {
        console.error(err);
        const msg =
          err.response?.data?.error || "Failed to load notifications";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket realtime updates
  useEffect(() => {
    let socket = getSocket();
    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }
    if (!socket) return;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    const handler = (notif) => {
      setNotifications((prev) => {
        const next = [notif, ...prev];
        updateUnreadCount(next);
        return next;
      });
      toast(`🔔 ${notif.message}`, { duration: 4000 });
    };

    socket.on("notification", handler);

    return () => {
      socket.off("notification", handler);
    };
  }, [auth.token]);

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    setMarking(true);
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => {
        const next = prev.map((n) => ({ ...n, is_read: true }));
        updateUnreadCount(next);
        return next;
      });
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.error || "Failed to mark notifications as read";
      toast.error(msg);
    } finally {
      setMarking(false);
    }
  };

  const handleMarkOneRead = async (id) => {
    try {
      const res = await api.post(`/notifications/${id}/read`);
      const updated = res.data;
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === updated.id ? updated : n));
        updateUnreadCount(next);
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = async (notif) => {
    if (!notif.is_read) {
      await handleMarkOneRead(notif.id);
    }

    if (notif.task_id) {
      // deep-link: open project page and auto-open task modal (+ optional comment)
      if (notif.project_id) {
        const params = new URLSearchParams();
        params.set("task", notif.task_id);
        if (notif.comment_id) {
          params.set("comment", notif.comment_id);
        }
        navigate(`/projects/${notif.project_id}?${params.toString()}`);
      } else {
        // fallback if we ever have task without project
        navigate(`/my-tasks?task=${notif.task_id}`);
      }
    } else if (notif.project_id) {
      navigate(`/projects/${notif.project_id}`);
    } else {
      navigate("/");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // === Derived: filtered list for UI ===
  const filteredNotifications = notifications.filter((n) => {
    if (tab === "unread" && n.is_read) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-[2px] text-[10px] font-medium text-blue-700 border border-blue-100">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Stay in sync with project and task changes in real time.
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-medium border">
              <span
                className={
                  socketConnected ? "text-green-600" : "text-red-600"
                }
              >
                ●
              </span>
              <span>
                {socketConnected ? "Realtime: connected" : "Realtime: offline"}
              </span>
            </span>
          </div>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={marking || unreadCount === 0}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {marking ? "Marking..." : "Mark all as read"}
        </button>
      </section>

      {/* FILTER BAR + LIST */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold">Recent notifications</h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Tab buttons: All / Unread */}
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={`px-3 py-[3px] rounded-full ${
                  tab === "all"
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-500"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTab("unread")}
                className={`px-3 py-[3px] rounded-full ${
                  tab === "unread"
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Unread
              </button>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-[3px] text-[11px] bg-white"
              >
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-slate-500">Loading...</div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-sm text-slate-500">
            You’re all caught up. No notifications yet.
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <>
            {filteredNotifications.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No notifications match your current filters.
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredNotifications.map((n) => {
                  const isUnread = !n.is_read;
                  const createdAt = n.created_at
                    ? new Date(n.created_at).toLocaleString()
                    : "";

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpen(n)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-xs flex gap-3 items-stretch border transition hover:shadow-sm ${
                        isUnread
                          ? "bg-blue-50 border-blue-100 hover:bg-blue-100/70"
                          : "bg-white border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      {/* Unread dot */}
                      <div className="pt-1">
                        {isUnread && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        {/* Type + meta badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-[10px] font-medium text-slate-700">
                            {formatType(n.type)}
                          </span>

                          {n.project_id && (
                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-[1px] text-[10px] text-slate-600 border border-slate-200">
                              Project
                            </span>
                          )}

                          {n.task_id && (
                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-[1px] text-[10px] text-slate-600 border border-slate-200">
                              Task
                            </span>
                          )}
                        </div>

                        {/* Message */}
                        <div className="text-[11px] text-slate-800 break-words">
                          {n.message}
                        </div>

                        {/* Footer row: time */}
                        <div className="mt-1 text-[10px] text-slate-500">
                          {createdAt}
                        </div>
                      </div>

                      {/* "New" pill on the right */}
                      {isUnread && (
                        <div className="flex items-start">
                          <span className="text-[9px] text-blue-700 border border-blue-300 bg-white/80 rounded px-1.5 py-[1px]">
                            New
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
