// src/pages/Notifications.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { getSocket, initSocket } from "../socket";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { publishUnreadCount } from "../notificationBus";
import { Bell, CheckCheck } from "lucide-react";

const TYPE_META = {
  huddle_intelligence_ready: { label: "Meeting intelligence", icon: "AI" },
  task_assigned:      { label: "Task assigned",     icon: "📋" },
  task_updated:       { label: "Task updated",       icon: "✏️" },
  task_deleted:       { label: "Task deleted",       icon: "🗑️" },
  project_assigned:   { label: "Project assigned",   icon: "📁" },
  comment_added:      { label: "New comment",        icon: "💬" },
  comment_reply:      { label: "Comment reply",      icon: "↩️" },
  comment_mention:    { label: "Mentioned",          icon: "🏷️" },
  autopilot_summary:  { label: "Autopilot",          icon: "🤖" },
  workspace_warning:  { label: "Warning",            icon: "⚠️" },
};

function typeIcon(type) { return TYPE_META[type]?.icon ?? "🔔"; }
function typeLabel(type) { return TYPE_META[type]?.label ?? type; }

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ALL_TYPE_FILTERS = [
  { value: "all",              label: "All",       roles: ["user", "manager", "admin"] },
  { value: "huddle_intelligence_ready", label: "Meetings", roles: ["user", "manager", "admin"] },
  { value: "task_assigned",    label: "Assigned",  roles: ["user", "manager", "admin"] },
  { value: "task_updated",     label: "Updated",   roles: ["user", "manager", "admin"] },
  { value: "comment_added",    label: "Comments",  roles: ["user", "manager", "admin"] },
  { value: "comment_mention",  label: "Mentions",  roles: ["user", "manager", "admin"] },
  { value: "leave",            label: "Leave",     roles: ["user", "manager", "admin"] },
  { value: "project_assigned", label: "Projects",  roles: ["manager", "admin"] },
  { value: "autopilot_summary",label: "Autopilot", roles: ["admin"] },
  { value: "workspace_warning",label: "Warnings",  roles: ["admin"] },
];

const LEAVE_TYPES = new Set(["leave_request", "leave_status"]);

export default function Notifications() {
  const api = useApi();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const role = auth.user?.role || "user";
  const visibleFilters = ALL_TYPE_FILTERS.filter((f) => f.roles.includes(role));

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [tab, setTab] = useState("all");        // "all" | "unread"
  const [typeFilter, setTypeFilter] = useState("all");

  // Publish unread count whenever notifications list changes
  useEffect(() => {
    publishUnreadCount(notifications.filter((n) => !n.is_read).length);
  }, [notifications]);

  useEffect(() => {
    api.get("/notifications").then((res) => {
      const list = res.data || [];
      setNotifications(list);
    }).catch((err) => {
      toast.error(err.response?.data?.error || "Failed to load notifications");
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auth.token) return;
    const socket = getSocket() || initSocket(auth.token);
    if (!socket) return;

    const onConnect    = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const handler = (notif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("notification", handler);
    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("notification", handler);
    };
  }, [auth.token]);

  const handleMarkAllRead = async () => {
    if (!notifications.length) return;
    setMarking(true);
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All marked as read");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    } finally {
      setMarking(false);
    }
  };

  const handleMarkOneRead = async (id) => {
    try {
      const res = await api.post(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === res.data.id ? res.data : n)));
    } catch { /* silent */ }
  };

  const handleOpen = async (notif) => {
    if (!notif.is_read) await handleMarkOneRead(notif.id);

    if (notif.action_url) {
      navigate(notif.action_url);
      return;
    }
    if (notif.task_id) {
      if (notif.project_id) {
        const p = new URLSearchParams({ task: notif.task_id });
        if (notif.comment_id) p.set("comment", notif.comment_id);
        navigate(`/projects/${notif.project_id}?${p.toString()}`);
      } else {
        navigate(`/my-tasks?task=${notif.task_id}`);
      }
      return;
    }
    if (notif.project_id) { navigate(`/projects/${notif.project_id}`); return; }
    const TYPE_ROUTES = {
      autopilot_summary:        "/autopilot",
      workspace_warning:        "/autopilot",
      task_deleted:             "/my-tasks",
      leave_request:            "/leave?tab=admin",
      leave_status:             "/leave?tab=my",
      review_assigned:          "/reviews?tab=pending",
      review_reminder:          "/reviews?tab=pending",
      manager_review_unlocked:  "/reviews?tab=pending",
      review_missed:            "/reviews?tab=aboutme",
      review_cycle_complete:    "/reviews?tab=cycles",
    };
    navigate(TYPE_ROUTES[notif.type] || "/dashboard");
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filtered = notifications.filter((n) => {
    if (tab === "unread" && n.is_read) return false;
    if (typeFilter === "leave") return LEAVE_TYPES.has(n.type);
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 flex-wrap px-4 pt-4 pb-3 border-b border-[color:var(--border)] shrink-0 mb-0">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Inbox
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight flex items-center gap-2">
            <div className="relative">
              <Bell className="w-6 h-6 text-[color:var(--primary)]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            Notifications
            <span
              className={`w-2 h-2 rounded-full ${socketConnected ? "bg-emerald-500" : "bg-[color:var(--text-soft)]"}`}
              title={socketConnected ? "Live" : "Offline"}
            />
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            Your activity feed — tasks, comments, mentions, and system alerts.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={marking || unreadCount === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[color:var(--primary-contrast)] disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark all read</span>
        </button>
      </header>

      {/* ── Tab + filter rail ───────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 border-b border-[color:var(--border)] shrink-0">
        {/* All / Unread tabs */}
        <div className="flex items-center gap-1 mb-2">
          {["all", "unread"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-semibold transition-colors rounded-[6px] ${
                tab === t
                  ? "text-[color:var(--primary)] border-b-2 border-[color:var(--primary)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {t === "all" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {visibleFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                typeFilter === f.value
                  ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                  : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col divide-y divide-[color:var(--border)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4 animate-pulse">
                <div className="w-9 h-9 rounded-xl border border-[color:var(--border)] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[var(--surface-soft)] rounded w-1/3" />
                  <div className="h-3 bg-[var(--surface-soft)] rounded w-3/4" />
                  <div className="h-2 bg-[var(--surface-soft)] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="p-4 rounded-full border border-[color:var(--border)]">
              <Bell className="w-8 h-8 text-[color:var(--text-muted)]" />
            </div>
            <p className="font-semibold text-[color:var(--text)]">All caught up</p>
            <p className="text-sm text-[color:var(--text-muted)]">No notifications yet</p>
          </div>
        )}

        {/* No results for filter */}
        {!loading && notifications.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-[color:var(--text-muted)]">No notifications match your filters</p>
            <button
              onClick={() => { setTab("all"); setTypeFilter("all"); }}
              className="text-sm text-[color:var(--primary)] font-medium hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Notification rows */}
        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-[color:var(--border)]">
            {filtered.map((n) => {
              const isUnread = !n.is_read;
              return (
                <button
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`w-full text-left flex items-start gap-3 py-4 hover:bg-[var(--surface-soft)] transition-colors relative ${
                    isUnread ? "border-l-2 border-[color:var(--primary)]" : ""
                  }`}
                  style={{ paddingLeft: isUnread ? "calc(1rem + 2px)" : "1rem", paddingRight: "1rem" }}
                >
                  {/* Icon badge */}
                  <div className="shrink-0 w-9 h-9 rounded-xl border border-[color:var(--border)] flex items-center justify-center text-lg leading-none">
                    {typeIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-semibold text-[color:var(--text-muted)]">{typeLabel(n.type)}</span>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)] shrink-0" />
                      )}
                    </div>
                    {n.title && <p className="text-sm font-semibold text-[color:var(--text)] leading-snug">{n.title}</p>}
                    <p className="text-sm text-[color:var(--text)] leading-snug line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-[color:var(--text-muted)] mt-1">{relativeTime(n.created_at)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
