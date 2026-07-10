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
  Workflow,
  GitBranch,
  ShieldCheck,
  Zap,
  Blocks,
  Gauge,
  Microscope,
  Network,
  FlaskConical,
  Activity,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFeature } from "../context/PlanContext";
import { useApi } from "../api";
import { getSocket, initSocket } from "../socket";
import { subscribeToUnreadCount } from "../notificationBus";
import { Avatar } from "./ui";
import { cn } from "../utils/cn";
import AppBrand from "./AppBrand";

export default function Sidebar({ collapsed, onToggle }) {
  const { auth } = useAuth();
  const role = auth.user?.role;
  const api = useApi();

  const tasksLabel = role === "user" ? "My Tasks" : "Tasks";
  const isAdmin = role === "admin";

  // Feature gates
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

  /** Primary navigation (everyone) */
  const workspaceItems = [
    { to: "/dashboard",        label: "Dashboard",     icon: LayoutDashboard, show: true },
    { to: "/projects",         label: "Projects",      icon: FolderKanban,    show: true },
    { to: "/my-tasks",         label: tasksLabel,      icon: CheckSquare,     show: true },
    { to: "/chat",             label: "Team Chat",     icon: MessageSquare,   show: true,                          locked: !hasChat },
    { to: "/notifications",    label: "Notifications", icon: Bell,            show: true, badge: unreadCount },
  ];

  /** Knowledge & people */
  const orgItems = [
    { to: "/wiki",             label: "Wiki / Docs",   icon: BookOpen,        show: true,                          locked: !hasWiki },
    { to: "/leave",            label: "Leave",         icon: CalendarDays,    show: true,                          locked: !hasLeave },
    { to: "/okr",              label: "Goals",         icon: Target,          show: isAdmin,                       locked: !hasGoals },
    { to: "/reviews",          label: "Reviews",       icon: Star,            show: true,                          locked: !hasReviews },
  ];

  /** Insights & intelligence */
  const intelligenceItems = [
    { to: "/reports",          label: "Reports",                icon: FileText, show: isAdmin || role === "manager", locked: !hasReports },
    { to: "/ai",               label: "AI Hub",                 icon: Sparkles, show: isAdmin || role === "manager", locked: !hasAiHub },
    { to: "/enterprise-intel", label: "Workspace Intelligence", icon: Brain,    show: isAdmin,                        locked: !hasWsIntel },
  ];

  /** Admin controls */
  const adminItems = [
    { to: "/ai-settings",            label: "AI Settings",      icon: Sparkles,  show: isAdmin },
    { to: "/admin/workspace-search", label: "Workspace Search", icon: Search,    show: isAdmin, locked: !hasWorkspaceSearch },
    { to: "/admin/adaptive-intelligence", label: "AI Impact",   icon: Brain,     show: isAdmin, locked: !hasWsIntel },
    { to: "/admin/attendance",       label: "Attendance",       icon: Clock,     show: isAdmin, locked: !hasAttendance },
    { to: "/admin/users",            label: "Admin Panel",      icon: Users,     show: isAdmin },
    { to: "/admin/billing",          label: "Billing",          icon: CreditCard,show: isAdmin },
    { to: "/enterprise",             label: "Enterprise",       icon: Shield,    show: isAdmin, locked: !hasEnterprise },
    { to: "/admin/migrations",       label: "Migrations",       icon: Hash,      show: isAdmin, locked: !hasMigrations },
  ];

  /** Execution platform (EWIP V3) — admin. Self-guards server-side (404 when disabled). */
  const executionItems = [
    { to: "/execution",              label: "Control Center", icon: Gauge,       show: isAdmin },
    { to: "/execution/decisions",    label: "Decisions",      icon: GitBranch,   show: isAdmin },
    { to: "/execution/approvals",    label: "Approvals",      icon: ShieldCheck, show: isAdmin || role === "manager" },
    { to: "/execution/dashboard",    label: "Execution",      icon: Gauge,       show: isAdmin },
    { to: "/execution/workflows",    label: "Workflows",      icon: Workflow,    show: isAdmin },
    { to: "/execution/capabilities", label: "Capabilities",   icon: Blocks,      show: isAdmin },
    { to: "/execution/policies",     label: "Policies",       icon: ShieldCheck, show: isAdmin },
    { to: "/execution/automations",  label: "Automations",    icon: Zap,         show: isAdmin },
    { to: "/execution/graph",        label: "Enterprise Graph", icon: GitBranch, show: isAdmin },
    { to: "/execution/executive",    label: "Executive",      icon: Brain,       show: isAdmin },
  ];

  /** Enterprise Intelligence Studio (read-only) — admin. Self-guards server-side (404 when disabled). */
  const intelligenceStudioItems = [
    { to: "/intelligence-studio",                label: "EI Home",       icon: Brain,        show: isAdmin },
    { to: "/intelligence-studio/evidence",       label: "Evidence",      icon: Microscope,   show: isAdmin },
    { to: "/intelligence-studio/attributions",   label: "Attributions",  icon: GitBranch,    show: isAdmin },
    { to: "/intelligence-studio/traces",         label: "Reasoning",     icon: Network,      show: isAdmin },
    { to: "/intelligence-studio/predictions",    label: "Predictions",   icon: Activity,     show: isAdmin },
    { to: "/intelligence-studio/recommendations", label: "Recommendations", icon: Sparkles,  show: isAdmin },
    { to: "/intelligence-studio/executive",      label: "Executive",     icon: Brain,        show: isAdmin },
    { to: "/intelligence-studio/outcomes",       label: "Outcomes",      icon: CheckSquare,  show: isAdmin },
    { to: "/intelligence-studio/validation",     label: "Validation",    icon: Activity,     show: isAdmin },
    { to: "/intelligence-studio/calibration",    label: "Calibration",   icon: Gauge,        show: isAdmin },
    { to: "/intelligence-studio/learning",       label: "Learning",      icon: FlaskConical, show: isAdmin },
    { to: "/intelligence-studio/experiments",    label: "Experiments",   icon: FlaskConical, show: isAdmin },
    { to: "/intelligence-studio/memory",         label: "Memory",        icon: BookOpen,     show: isAdmin },
    { to: "/intelligence-studio/health",         label: "Platform Health", icon: Activity,   show: isAdmin },
    { to: "/intelligence-studio/graph",          label: "Graph",         icon: Network,      show: isAdmin },
    { to: "/intelligence-studio/search",         label: "Search",        icon: Search,       show: isAdmin },
  ];

  const linkClass = ({ isActive }) =>
    cn(
      "group relative flex items-center text-[13px] font-medium tracking-tight",
      "transition-colors duration-100 select-none",
      collapsed
        ? "justify-center h-9 w-9 mx-auto rounded-[8px]"
        : "h-8 gap-2.5 px-2.5 rounded-[6px]",
      isActive
        ? "bg-[var(--sidebar-active)] text-[color:var(--text)]"
        : "text-[color:var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[color:var(--text)]"
    );

  const renderItem = ({ to, label, icon: Icon, badge, locked }) => (
    <NavLink key={to} to={to} title={collapsed ? label : undefined} className={linkClass}>
      {({ isActive }) => (
        <>
          {/* Active accent rail */}
          {isActive && !collapsed && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r brand-orange-bg"
            />
          )}
          <div className="relative shrink-0">
            <Icon
              className={cn(
                "w-[16px] h-[16px]",
                isActive
                  ? "brand-orange-text"
                  : "text-[color:var(--text-soft)] group-hover:text-[color:var(--text)]"
              )}
              strokeWidth={1.75}
            />
            {locked && (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--sidebar-bg)] p-[1px]">
                <Lock className="w-2.5 h-2.5 text-[color:var(--text-soft)]" aria-hidden="true" />
              </span>
            )}
            {badge > 0 && collapsed && (
              <span className="absolute -top-1 -right-1 w-[7px] h-[7px] brand-orange-bg rounded-full" />
            )}
          </div>
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{label}</span>
              {locked && <Lock className="w-3 h-3 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />}
              {badge > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full brand-orange-bg text-[10px] font-semibold px-1.5 text-[#0a0a0b]">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );

  const renderSection = (label, items) => {
    const visible = items.filter((i) => i.show);
    if (visible.length === 0) return null;
    return (
      <div className="px-1.5">
        {!collapsed && (
          <p className="px-2.5 mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
            {label}
          </p>
        )}
        {collapsed && <div className="my-2 mx-auto h-px w-6 bg-[color:var(--sidebar-border)]" />}
        <div className="space-y-0.5">{visible.map(renderItem)}</div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden",
        "bg-[var(--sidebar-bg)] border-r border-[color:var(--sidebar-border)]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Brand row */}
      <div
        className={cn(
          "border-b border-[color:var(--sidebar-border)] flex items-center shrink-0",
          collapsed ? "h-[52px] justify-center" : "h-[52px] px-3 gap-2"
        )}
      >
        <AppBrand collapsed={collapsed} className={cn("min-w-0", !collapsed && "flex-1")} />
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-[6px]",
            "text-[color:var(--text-soft)] hover:text-[color:var(--text)] hover:bg-[var(--sidebar-hover)]",
            "transition-colors",
            collapsed && "absolute top-3 right-2"
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {renderSection("Workspace", workspaceItems)}
        {renderSection("Organization", orgItems)}
        {renderSection("Intelligence", intelligenceItems)}
        {/* Execution Platform + Intelligence Studio are SUPER-ADMIN owned — not shown to workspace admins. */}
        {renderSection("Administration", adminItems)}
      </nav>

      {/* User card */}
      <div className="border-t border-[color:var(--sidebar-border)] shrink-0">
        <Link
          to="/profile"
          title={collapsed ? auth.user?.username : undefined}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--sidebar-hover)] transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          <Avatar
            name={auth.user?.username}
            src={auth.user?.avatar_url}
            size="sm"
            status="online"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[color:var(--text)] truncate leading-tight">
                {auth.user?.username || "—"}
              </p>
              <p className="text-[11px] text-[color:var(--text-soft)] truncate leading-tight capitalize mt-0.5">
                {auth.user?.role || "member"}
              </p>
            </div>
          )}
          {!collapsed && (
            <User className="w-3.5 h-3.5 text-[color:var(--text-soft)] shrink-0" aria-hidden="true" />
          )}
        </Link>
      </div>
    </aside>
  );
}
