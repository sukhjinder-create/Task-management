// src/components/Sidebar.jsx
import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import { getSocket, initSocket } from "../socket";
import { subscribeToUnreadCount } from "../notificationBus";

export default function Sidebar() {
  const { auth } = useAuth();
  const role = auth.user?.role;
  const api = useApi();

  // Dynamic label for tasks tab
  const tasksLabel = role === "user" ? "My Tasks" : "Tasks";

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isUser = role === "user";

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // FIX: guard - don't call API when no token (prevents 401 noise)
    if (!auth?.token) {
      // still subscribe to unread bus, because some other component may publish counts
      const unsubscribeBus = subscribeToUnreadCount((count) => {
        if (!cancelled) {
          setUnreadCount(count);
        }
      });

      return () => {
        cancelled = true;
        unsubscribeBus();
      };
    }

    async function loadNotificationsCount() {
      try {
        const res = await api.get("/notifications");
        if (cancelled) return;
        const list = res.data || [];
        const unread = list.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error("Failed to load notifications for sidebar:", err);
        // no toast: avoid noise on every app load
      }
    }

    loadNotificationsCount();

    // Socket: listen for new notifications and bump the counter
    let socket = getSocket();
    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }

    let offSocket = () => {};

    if (socket) {
      const onNotification = () => {
        if (cancelled) return;
        setUnreadCount((prev) => prev + 1);
      };
      socket.on("notification", onNotification);
      offSocket = () => socket.off("notification", onNotification);
    }

    // Subscribe to global unread-count changes coming from Notifications page
    const unsubscribeBus = subscribeToUnreadCount((count) => {
      if (!cancelled) {
        setUnreadCount(count);
      }
    });

    return () => {
      cancelled = true;
      offSocket();
      unsubscribeBus();
    };
  }, [api, auth.token]);

  return (
    <div className="w-60 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 px-4 py-6 flex flex-col">
      <h1 className="text-xl font-bold mb-6 text-slate-800">TaskManager</h1>

      <nav className="flex-1 space-y-1">
        {(isAdmin || isManager) && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm ${
                isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
              }`
            }
          >
            Dashboard
          </NavLink>
        )}

        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          Projects
        </NavLink>

        {/* Same route as before, only label is dynamic */}
        <NavLink
          to="/my-tasks"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          {tasksLabel}
        </NavLink>

        {/* NEW: Team Chat (we will wire /chat route later) */}
        <NavLink
          to="/chat"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          Team Chat
        </NavLink>

        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          <div className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                {unreadCount}
              </span>
            )}
          </div>
        </NavLink>

        {/* Optional: explicit Profile nav item */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm ${
              isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
            }`
          }
        >
          Profile
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm ${
                isActive ? "bg-blue-100 text-blue-700" : "text-slate-700"
              }`
            }
          >
            Admin Panel
          </NavLink>
        )}
      </nav>

      {/* FOOTER with explicit profile link */}
      <div className="text-xs text-slate-500 border-t border-slate-200 pt-4">
        Logged in as <b>{auth.user?.username}</b> ({auth.user?.role}){" "}
        <Link
          to="/profile"
          className="ml-1 text-blue-600 underline font-semibold"
        >
          View profile
        </Link>
      </div>
    </div>
  );
}
