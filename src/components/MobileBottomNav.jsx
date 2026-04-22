// src/components/MobileBottomNav.jsx
// Bottom navigation bar for mobile — replaces the desktop sidebar.
// Shows 5 primary tabs + a "More" drawer for secondary items.

import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Bell,
  Command,
  MoreHorizontal,
  X,
  FileText,
  User,
  Clock,
  Users,
  Hash,
  LogOut,
  Sparkles,
  Target,
  BookOpen,
  CalendarDays,
  Star,
  Shield,
  Lock,
  CreditCard,
  Brain,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFeature } from "../context/PlanContext";
import { cn } from "../utils/cn";
import { Avatar, Badge } from "./ui";

export default function MobileBottomNav({ unreadCount = 0 }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const role = auth?.user?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const hasGoals = useFeature("okr_goals");
  const hasWiki = useFeature("wiki_docs");
  const hasLeave = useFeature("leave_management");
  const hasReviews = useFeature("performance_reviews");
  const hasReports = useFeature("basic_reporting");
  const hasAiHub = useFeature("ai_hub");
  const hasChat = useFeature("team_chat");
  const hasAttendance = useFeature("attendance");
  const hasEnterprise = useFeature("custom_branding");
  const hasMigrations = useFeature("slack_migration");
  const hasWorkspaceSearch = useFeature("workspace_search_memory");

  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTabs = [
    { to: "/dashboard",     icon: LayoutDashboard, label: "Home" },
    { to: "/projects",      icon: FolderKanban,    label: "Projects" },
    { to: "/my-tasks",      icon: CheckSquare,     label: "Tasks" },
    { to: "/chat",          icon: MessageSquare,   label: "Chat", locked: !hasChat },
    {
      to: "/notifications",
      icon: Bell,
      label: "Alerts",
      badge: unreadCount,
    },
  ];

  const moreItems = [
    { to: "/okr",          icon: Target,       label: "Goals",            show: isAdmin,               locked: !hasGoals },
    { to: "/admin/workspace-search", icon: Command, label: "Workspace Search", show: isAdmin, locked: !hasWorkspaceSearch },
    { to: "/wiki",         icon: BookOpen,     label: "Wiki / Docs",      show: true,                  locked: !hasWiki },
    { to: "/leave",        icon: CalendarDays, label: "Leave",            show: true,                  locked: !hasLeave },
    { to: "/reviews",      icon: Star,         label: "Reviews",          show: true,                  locked: !hasReviews },
    { to: "/reports",      icon: FileText,     label: "Reports",          show: isAdmin || isManager,  locked: !hasReports },
    { to: "/ai",           icon: Sparkles,     label: "AI Hub",           show: isAdmin || isManager,  locked: !hasAiHub },
    { to: "/profile",      icon: User,         label: "Profile",          show: true },
    { to: "/enterprise",   icon: Shield,       label: "Enterprise",       show: isAdmin,               locked: !hasEnterprise },
    { to: "/admin/attendance", icon: Clock,    label: "Attendance",       show: isAdmin,               locked: !hasAttendance },
    { to: "/admin/users",  icon: Users,        label: "Admin Panel",      show: isAdmin },
    { to: "/admin/migrations", icon: Hash,     label: "Migrations",       show: isAdmin,               locked: !hasMigrations },
    { to: "/admin/billing",   icon: CreditCard, label: "Billing",         show: isAdmin },
    { to: "/enterprise-intel", icon: Brain,    label: "Workspace AI",     show: isAdmin },
  ].filter((i) => i.show);

  const tabClass = ({ isActive }) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative",
      "text-xs font-medium transition-colors min-h-[56px]",
      isActive
        ? "text-[var(--primary)]"
        : "text-[var(--text-muted)]"
    );

  return (
    <>
      {/* ── More drawer backdrop ─────────────────────────── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* ── More drawer (slides up) ──────────────────────── */}
      <div
        className={cn(
          "fixed left-0 right-0 bottom-0 z-50 theme-surface rounded-t-2xl shadow-2xl",
          "transform transition-transform duration-300 ease-out",
          moreOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b theme-border">
          <div className="flex items-center gap-3">
            <Avatar name={auth?.user?.username} src={auth?.user?.avatar_url} size="md" />
            <div>
              <p className="text-sm font-semibold theme-text">{auth?.user?.username}</p>
              <p className="text-xs theme-text-muted capitalize">{auth?.user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => setMoreOpen(false)}
            className="p-2 rounded-full theme-text-muted hover:bg-[var(--surface-soft)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav grid */}
        <div className="grid grid-cols-3 gap-px p-4">
          {moreItems.map(({ to, icon: Icon, label, locked }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl transition-colors",
                  isActive
                    ? "bg-[var(--primary)] text-white"
                    : "theme-text-muted hover:bg-[var(--surface-soft)]"
                )
              }
            >
              <div className="relative">
                <Icon size={22} />
                {locked && (
                  <span className="absolute -top-1 -right-2 rounded-full bg-[var(--surface)] p-0.5">
                    <Lock size={10} />
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-center leading-tight">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Logout */}
        <div className="px-4 pb-4">
          <button
            onClick={() => { setMoreOpen(false); logout(); navigate("/login"); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                       bg-red-500/10 text-red-500 font-medium text-sm
                       hover:bg-red-500/15 transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Bottom tab bar ───────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 theme-surface border-t theme-border
                   flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primaryTabs.map(({ to, icon: Icon, label, badge, locked }) => (
          <NavLink key={to} to={to} className={tabClass}>
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                  {locked && (
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-[var(--surface)] p-0.5">
                      <Lock size={9} />
                    </span>
                  )}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1
                                     bg-red-500 text-white text-[10px] font-bold
                                     rounded-full flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-normal")}>
                  {label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5
                                   rounded-full bg-[var(--primary)]" />
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 py-2",
            "text-xs font-medium transition-colors min-h-[56px]",
            moreOpen ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
          )}
        >
          <MoreHorizontal size={22} strokeWidth={1.8} />
          <span className="text-[10px]">More</span>
        </button>
      </nav>
    </>
  );
}
