// src/pages/Notifications.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { getSocket, initSocket } from "../socket";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

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
    default:
      return type;
  }
}

export default function Notifications() {
  const api = useApi();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true);
      try {
        const res = await api.get("/notifications");
        setNotifications(res.data || []);
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
  }, []);

  useEffect(() => {
    let socket = getSocket();
    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }
    if (!socket) return;

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    const handler = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      toast(`🔔 ${notif.message}`, { duration: 4000 });
    };

    socket.on("notification", handler);

    return () => {
      socket.off("notification", handler);
    };
  }, [auth.token]);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
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
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = async (notif) => {
    if (!notif.is_read) {
      await handleMarkOneRead(notif.id);
    }

    if (notif.task_id) {
      // we don't have dedicated task detail page, so just go to project page
      if (notif.project_id) {
        navigate(`/projects/${notif.project_id}`);
      } else {
        navigate("/my-tasks");
      }
    } else if (notif.project_id) {
      navigate(`/projects/${notif.project_id}`);
    } else {
      navigate("/");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">Notifications</h1>
          <p className="text-xs text-slate-500">
            You have {unreadCount} unread notification
            {unreadCount === 1 ? "" : "s"}. Socket:{" "}
            <span
              className={
                socketConnected ? "text-green-600" : "text-red-600"
              }
            >
              {socketConnected ? "Connected" : "Disconnected"}
            </span>
          </p>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={marking}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {marking ? "Marking..." : "Mark all as read"}
        </button>
      </section>

      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">Recent notifications</h2>

        {loading && (
          <div className="text-sm text-slate-500">Loading...</div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="text-sm text-slate-500">
            No notifications yet.
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleOpen(n)}
              className={`w-full text-left border rounded-lg px-3 py-2 text-xs flex justify-between items-start ${
                n.is_read
                  ? "border-slate-100 bg-white"
                  : "border-blue-200 bg-blue-50"
              } hover:bg-slate-50`}
            >
              <div>
                <div className="text-[11px] font-semibold mb-1">
                  {formatType(n.type)}
                </div>
                <div className="text-[11px] text-slate-800">
                  {n.message}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {n.created_at
                    ? new Date(n.created_at).toLocaleString()
                    : ""}
                </div>
              </div>
              {!n.is_read && (
                <span className="text-[9px] text-blue-700 border border-blue-300 bg-blue-50 rounded px-1">
                  New
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
