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
  ChevronLeft,
  ChevronRight,
  Hash,
  BookOpen,
  CalendarDays,
  Target,
  Star,
  Sparkles,
  Shield,
  CreditCard,
  Brain,
  Search,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFeature } from "../context/PlanContext";
import { useApi } from "../api";
import { getSocket, initSocket } from "../socket";
import { subscribeToUnreadCount } from "../notificationBus";
import { Avatar, Badge } from "./ui";
import { cn } from "../utils/cn";
import AppBrand from "./AppBrand";

const COLLAPSED_KEY = "sidebarCollapsed";

export default function Sidebar({ collapsed, onToggle }) {
  const { auth } = useAuth();
  const role = auth.user?.role;
  const api = useApi();

  const tasksLabel = role === "user" ? "My Tasks" : "Tasks";
  const isAdmin = role === "admin";

  // Plan feature gates — hide sidebar items the workspace plan doesn't include
  const hasWiki            = useFeature("wiki_docs");
  const hasLeave           = useFeature("leave_management");
  const hasGoals           = useFeature("okr_goals");
  const hasReviews         = useFeature("performance_reviews");
  const hasReports         = useFeature("basic_reporting");
  const hasChat            = useFeature("team_chat");
  const hasAiHub           = useFeature("ai_hub");
  const hasWsIntel         = useFeature("workspace_intelligence");
  const hasAttendance      = useFeature("attendance");
  const hasEnterprise      = useFeature("custom_branding");
  const hasMigrations      = useFeature("slack_migration");
  const hasWorkspaceSearch = useFeature("workspace_search_memory");

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!auth?.token) {
      const unsubscribeBus = subscribeToUnreadCount((count) => {
        if (!cancelled) setUnreadCount(count);
      });
      return () => { cancelled = true; unsubscribeBus(); };
    }

    async function loadNotificationsCount() {
      try {
        const res = await api.get("/notifications");
        if (cancelled) return;
        const list = res.data || [];
        setUnreadCount(list.filter((n) => !n.is_read).length);
      } catch (err) {
        console.error("Failed to load notifications for sidebar:", err);
      }
    }

    loadNotificationsCount();

    let socket = getSocket();
    if (!socket && auth.token) socket = initSocket(auth.token);

    let offSocket = () => {};
    if (socket) {
      const onNotification = () => { if (!cancelled) setUnreadCount((prev) => prev + 1); };
      socket.on("notification", onNotification);
      offSocket = () => socket.off("notification", onNotification);
    }

    const unsubscribeBus = subscribeToUnreadCount((count) => {
      if (!cancelled) setUnreadCount(count);
    });

    return () => { cancelled = true; offSocket(); unsubscribeBus(); };
  }, [api, auth.token]);

  const navItems = [
    { to: "/dashboard",        label: "Dashboard",              icon: LayoutDashboard, show: true },
    { to: "/projects",         label: "Projects",               icon: FolderKanban,    show: true },
    { to: "/my-tasks",         label: tasksLabel,               icon: CheckSquare,     show: true },
    { to: "/wiki",             label: "Wiki / Docs",            icon: BookOpen,        show: true,                           locked: !hasWiki },
    { to: "/leave",            label: "Leave",                  icon: CalendarDays,    show: true,                           locked: !hasLeave },
    { to: "/okr",              label: "Goals",                  icon: Target,          show: isAdmin,                        locked: !hasGoals },
    { to: "/reviews",          label: "Reviews",                icon: Star,            show: true,                           locked: !hasReviews },
    { to: "/reports",          label: "Reports",                icon: FileText,        show: isAdmin || role === "manager", locked: !hasReports },
    { to: "/ai",               label: "AI Hub",                 icon: Sparkles,        show: isAdmin || role === "manager", locked: !hasAiHub },
    { to: "/enterprise-intel", label: "Workspace Intelligence", icon: Brain,           show: isAdmin,                        locked: !hasWsIntel },
    { to: "/chat",             label: "Team Chat",              icon: MessageSquare,   show: true,                           locked: !hasChat },
    { to: "/notifications",    label: "Notifications",          icon: Bell,            show: true, badge: unreadCount },
  ];

  const adminItems = [
    { to: "/admin/workspace-search", label: "Workspace Search", icon: Search,    show: isAdmin, locked: !hasWorkspaceSearch },
    { to: "/admin/attendance",       label: "Attendance",       icon: Clock,     show: isAdmin, locked: !hasAttendance },
    { to: "/admin/users",            label: "Admin Panel",      icon: Users,     show: isAdmin },
    { to: "/admin/billing",          label: "Billing",          icon: CreditCard,show: isAdmin },
    { to: "/enterprise",             label: "Enterprise",       icon: Shield,    show: isAdmin, locked: !hasEnterprise },
    { to: "/admin/migrations",       label: "Migrations",       icon: Hash,      show: isAdmin, locked: !hasMigrations },
  ];

  // Shared NavLink class builder
  const linkClass = ({ isActive }) =>
    cn(
      "flex items-center rounded-lg text-sm font-medium transition-colors",
      collapsed ? "justify-center px-0 py-2.5 mx-1" : "gap-3 px-3 py-2.5",
      isActive
        ? collapsed
          ? "bg-[var(--primary-light,#eff6ff)] text-[var(--primary,#2563eb)]"
          : "nav-link-active border-l-2 -ml-[2px] pl-[10px]"
        : "theme-text-muted hover:bg-[var(--surface-soft)]"
    );

  return (
    <div
      className={cn(
        "gradient-sidebar border-r theme-border fixed inset-y-0 left-0 flex flex-col overflow-hidden z-40",
        "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* ── Brand + toggle ──────────────────────────────── */}
      <div className={cn(
        "border-b theme-border flex items-center shrink-0",
        collapsed ? "h-16 px-2 justify-between" : "h-16 px-3 gap-2"
      )}>
        <AppBrand collapsed={collapsed} className={cn("min-w-0", !collapsed && "flex-1")} />
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "p-1.5 rounded-lg hover:bg-[var(--surface-soft)] theme-text-muted transition-colors shrink-0",
            !collapsed && "ml-auto"
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* ── Main nav ────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-4 pr-1 space-y-0.5 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {navItems.filter((i) => i.show).map(({ to, label, icon: Icon, badge, locked }) => (
          <NavLink key={to} to={to} title={collapsed ? label : undefined} className={linkClass}>
            <div className="relative shrink-0">
              <Icon className="w-5 h-5" />
              {locked && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface)] p-0.5">
                  <Lock className="w-2.5 h-2.5 theme-text-muted" aria-hidden="true" />
                </span>
              )}
              {/* Dot badge in collapsed mode */}
              {badge > 0 && collapsed && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{label}</span>
                {locked && <Lock className="w-3.5 h-3.5 shrink-0 theme-text-muted" aria-hidden="true" />}
                {badge > 0 && (
                  <Badge color="danger" size="sm" variant="solid">{badge}</Badge>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Profile link */}
        <div className="pt-3 pb-1">
          <div className="h-px bg-[var(--border)]" />
        </div>
        <NavLink
          to="/profile"
          title={collapsed ? "Profile" : undefined}
          className={linkClass}
        >
          <User className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Profile</span>}
        </NavLink>

        {/* Admin section */}
        {adminItems.some((i) => i.show) && (
          <>
            <div className="pt-3 pb-1">
              <div className="h-px theme-border" />
            </div>
            {!collapsed && (
              <div className="px-3 pt-1 pb-1">
                <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider">
                  Admin
                </p>
              </div>
            )}
            {adminItems.filter((i) => i.show).map(({ to, label, icon: Icon, locked }) => (
              <NavLink key={to} to={to} title={collapsed ? label : undefined} className={linkClass}>
                <div className="relative shrink-0">
                  <Icon className="w-5 h-5 shrink-0" />
                  {locked && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface)] p-0.5">
                      <Lock className="w-2.5 h-2.5 theme-text-muted" aria-hidden="true" />
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {locked && <Lock className="w-3.5 h-3.5 shrink-0 theme-text-muted" aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* ── User card ───────────────────────────────────── */}
      <div className="p-3 border-t theme-border shrink-0">
        <Link
          to="/profile"
          title={collapsed ? auth.user?.username : undefined}
          className={cn(
            "flex items-center rounded-lg hover:bg-[var(--surface-soft)] transition-colors p-2",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <Avatar name={auth.user?.username} src={auth.user?.avatar_url} size="md" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium theme-text truncate">{auth.user?.username}</p>
              <p className="text-xs theme-text-muted truncate capitalize">{auth.user?.role}</p>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
