// src/components/Sidebar.jsx
import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  MessageSquare,
  Bell,
  User,
  Clock,
  Users,
  Brain,
  Bot,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import { getSocket, initSocket } from "../socket";
import { subscribeToUnreadCount } from "../notificationBus";
import { Avatar, Badge } from "./ui";
import { cn } from "../utils/cn";

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

    // Guard - don't call API when no token (prevents 401 noise)
    if (!auth?.token) {
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

  // Navigation items configuration
  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/projects", label: "Projects", icon: FolderKanban, show: true },
    { to: "/my-tasks", label: tasksLabel, icon: CheckSquare, show: true },
    { to: "/reports", label: "Reports", icon: FileText, show: true },
    { to: "/intelligence", label: "Intelligence", icon: Brain, show: true },
    { to: "/chat", label: "Team Chat", icon: MessageSquare, show: true },
    { to: "/notifications", label: "Notifications", icon: Bell, show: true, badge: unreadCount },
  ];


  const adminItems = [
    { to: "/autopilot", label: "AI Autopilot", icon: Bot, show: isAdmin || isManager },
    { to: "/admin/attendance", label: "Attendance", icon: Clock, show: isAdmin },
    { to: "/admin/users", label: "Admin Panel", icon: Users, show: isAdmin },
  ];

  return (
    <div className="w-60 theme-surface border-r theme-border h-screen fixed left-0 top-0 flex flex-col">
      {/* Logo/Brand */}
      <div className="px-4 py-5 border-b theme-border">
        <h1 className="text-xl font-bold theme-text">TaskManager</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.show).map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600 -ml-[2px] pl-[10px]'
                  : 'theme-text-muted hover:bg-[var(--surface-soft)]'
              )
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge > 0 && (
              <Badge color="danger" size="sm" variant="solid">
                {badge}
              </Badge>
            )}
          </NavLink>
        ))}

        {/* Profile Section */}
        <div className="pt-4 pb-2">
          <div className="h-px bg-gray-200" />
        </div>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600 -ml-[2px] pl-[10px]'
                : 'theme-text-muted hover:bg-[var(--surface-soft)]'
            )
          }
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="flex-1">Profile</span>
        </NavLink>

        {/* Admin Section */}
        {adminItems.some(item => item.show) && (
          <>
            <div className="pt-4 pb-2">
              <div className="h-px theme-border" />
            </div>
            <div className="px-3 pt-2 pb-1">
              <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider">
                Admin
              </p>
            </div>
            {adminItems.filter(item => item.show).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-l-2 border-primary-600 -ml-[2px] pl-[10px]'
                      : 'theme-text-muted hover:bg-[var(--surface-soft)]'
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User Profile Card */}
      <div className="p-4 border-t theme-border">
        <Link
          to="/profile"
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-soft)] transition-colors"
        >
          <Avatar name={auth.user?.username} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium theme-text truncate">
              {auth.user?.username}
            </p>
            <p className="text-xs theme-text-muted truncate capitalize">
              {auth.user?.role}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
