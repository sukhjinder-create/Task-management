import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import toast from "react-hot-toast";
import {
  Bot, Clock3, CheckCircle2, XCircle, Zap, Target, UserCheck,
  CalendarClock, AlertTriangle, FileText, Play, Check, X,
  ChevronDown, ChevronRight, History, Search, RefreshCw, Calendar,
} from "lucide-react";

const TODAY = new Date().toISOString().slice(0, 10);

function buildStatsParams(range, customFrom, customTo) {
  if (range === "all") return {};
  if (range === "custom") {
    const p = {};
    if (customFrom) p.fromDate = customFrom;
    if (customTo) p.toDate = customTo;
    return p;
  }
  const days = { today: 0, "7d": 7, "30d": 30, "90d": 90 }[range] ?? 7;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { fromDate: from.toISOString().slice(0, 10) };
}

function rangeLabel(range, customFrom, customTo) {
  if (range === "all") return "All time";
  if (range === "custom") {
    if (customFrom && customTo) return `${customFrom} → ${customTo}`;
    if (customFrom) return `From ${customFrom}`;
    if (customTo) return `Up to ${customTo}`;
    return "Custom range";
  }
  return { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" }[range] ?? "";
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function humanizeActionType(type) {
  return { reassign: "Auto Assignment", adjust_deadline: "Deadline Adjust", escalate: "Escalation", create_standup: "Standup" }[type] || type || "Unknown";
}

function StatusPill({ status }) {
  const cls = { executed: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700", auto_approved: "bg-purple-100 text-purple-700", approved: "bg-blue-100 text-blue-700", pending: "bg-yellow-100 text-yellow-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls[status] || "bg-slate-100 text-slate-600"}`}>
      {status === "auto_approved" ? "auto-approved" : status}
    </span>
  );
}

/** Renders inline markdown: **bold**, @mention */
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*([^*]+)\*\*$/.test(part)) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (/@\w+/.test(part)) {
      const subs = part.split(/(@\w+)/g);
      return subs.map((sp, j) => /@\w+/.test(sp) ? <span key={j} className="text-blue-600 font-medium">{sp}</span> : sp);
    }
    return part;
  });
}

function StandupMarkdown({ content }) {
  if (!content) return null;
  const lines = content.split("\n");
  const elements = [];
  let key = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^# (.+)/.test(line)) elements.push(<h1 key={key++} className="text-sm font-bold theme-text mt-1 mb-1">{renderInline(line.replace(/^# /, ""))}</h1>);
    else if (/^## (.+)/.test(line)) elements.push(<h2 key={key++} className="text-xs font-bold theme-text mt-3 mb-1 border-b theme-border pb-0.5">{renderInline(line.replace(/^## /, ""))}</h2>);
    else if (/^> (.+)/.test(line)) elements.push(<div key={key++} className="text-xs text-indigo-700 bg-indigo-50 rounded px-2 py-1 my-1 border-l-2 border-indigo-300">{renderInline(line.replace(/^> /, ""))}</div>);
    else if (/^---+$/.test(line)) elements.push(<hr key={key++} className="border-[var(--border)] my-2" />);
    else if (/^[\-•] (.+)/.test(line)) {
      const text = line.replace(/^[\-•] /, "");
      const isBlocked = text.includes("⚠") || text.toLowerCase().includes("overdue");
      const isGood = text.includes("✅");
      elements.push(<div key={key++} className={`flex gap-2 text-xs py-0.5 pl-1 ${isBlocked ? "text-red-700" : isGood ? "text-green-700" : "theme-text"}`}><span className="theme-text-muted mt-0.5 shrink-0">•</span><span>{renderInline(text)}</span></div>);
    } else if (line.trim() === "") elements.push(<div key={key++} className="h-1" />);
    else elements.push(<p key={key++} className="text-xs theme-text py-0.5">{renderInline(line)}</p>);
  }
  return <div className="space-y-0">{elements}</div>;
}

export default function Autopilot() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth } = useAuth();
  const user = auth?.user;

  const [settings, setSettings] = useState(null);
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());

  const [activeTab, setActiveTab] = useState(
    ["pending", "history", "settings"].includes(searchParams.get("tab"))
      ? searchParams.get("tab")
      : "pending"
  );
  const [actionFilter, setActionFilter] = useState("all");

  const [statsRange, setStatsRange] = useState("7d");
  const [statsCustomFrom, setStatsCustomFrom] = useState("");
  const [statsCustomTo, setStatsCustomTo] = useState("");

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({ search: "", status: "all", fromDate: "", toDate: "", limit: 10 });
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [statsRange, statsCustomFrom, statsCustomTo]);

  useEffect(() => {
    if (activeTab !== "history") return;
    const timer = setTimeout(() => fetchHistory(1), 350);
    return () => clearTimeout(timer);
  }, [activeTab, historyFilters.search, historyFilters.status, historyFilters.fromDate, historyFilters.toDate, historyFilters.limit]);

  useEffect(() => {
    if (!["pending", "history", "settings"].includes(activeTab)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", activeTab);
      return next;
    }, { replace: true });
  }, [activeTab, setSearchParams]);

  const fetchData = async () => {
    try {
      const statsParams = buildStatsParams(statsRange, statsCustomFrom, statsCustomTo);
      const [settingsRes, actionsRes, statsRes] = await Promise.all([
        api.get("/autopilot/settings"),
        api.get("/autopilot/actions"),
        api.get("/autopilot/stats", { params: statsParams }),
      ]);
      setSettings(settingsRes.data.settings);
      setActions(actionsRes.data.actions || []);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error("Failed to fetch autopilot data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (page = historyPagination.page) => {
    setHistoryLoading(true);
    try {
      const params = {
        page, limit: historyFilters.limit,
        search: historyFilters.search || undefined,
        status: historyFilters.status !== "all" ? historyFilters.status : undefined,
        fromDate: historyFilters.fromDate || undefined,
        toDate: historyFilters.toDate ? `${historyFilters.toDate}T23:59:59.999` : undefined,
      };
      const res = await api.get("/autopilot/history", { params });
      setHistoryItems(res.data.items || []);
      setHistoryPagination(res.data.pagination || historyPagination);
    } catch {
      toast.error("Failed to fetch autopilot history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleAutopilot = async (enabled) => {
    try {
      const res = await api.post("/autopilot/settings", {
        enabled, mode: settings?.mode || "assisted",
        autoAssign: settings?.auto_assign ?? true, autoDeadlineAdjust: settings?.auto_deadline_adjust ?? true,
        autoEscalateBlockers: settings?.auto_escalate_blockers ?? true, autoGenerateStandup: settings?.auto_generate_standup ?? true,
        maxTasksPerUser: settings?.max_tasks_per_user || 10, blockerThresholdHours: settings?.blocker_threshold_hours || 48,
        velocityDropThreshold: settings?.velocity_drop_threshold || 0.2, requireApproval: settings?.require_approval ?? true,
        autoApproveAfterHours: settings?.auto_approve_after_hours || 24,
      });
      setSettings(res.data.settings);
      toast.success(res.data.message);
      await fetchData();
    } catch { toast.error("Failed to update settings"); }
  };

  const runAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const res = await api.post("/autopilot/run");
      toast.success(res.data.message);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to run analysis");
    } finally { setRunningAnalysis(false); }
  };

  const approveAction = async (actionId) => {
    setProcessingIds((prev) => new Set(prev).add(actionId));
    try {
      const res = await api.post(`/autopilot/actions/${actionId}/approve`);
      toast.success(res.data.message || "Action executed");
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to approve action");
    } finally {
      setProcessingIds((prev) => { const n = new Set(prev); n.delete(actionId); return n; });
    }
  };

  const rejectAction = async (actionId, reason = null) => {
    setProcessingIds((prev) => new Set(prev).add(actionId));
    try {
      await api.post(`/autopilot/actions/${actionId}/reject`, { reason });
      toast.success("Action rejected");
      await fetchData();
    } catch { toast.error("Failed to reject action"); } finally {
      setProcessingIds((prev) => { const n = new Set(prev); n.delete(actionId); return n; });
    }
  };

  const actionTypeCounts = useMemo(() => ({
    all: actions.length,
    reassign: actions.filter((a) => a.action_type === "reassign").length,
    adjust_deadline: actions.filter((a) => a.action_type === "adjust_deadline").length,
    escalate: actions.filter((a) => a.action_type === "escalate").length,
    create_standup: actions.filter((a) => a.action_type === "create_standup").length,
  }), [actions]);

  const filteredActions = useMemo(() => actionFilter === "all" ? actions : actions.filter((a) => a.action_type === actionFilter), [actions, actionFilter]);

  const approveVisibleActions = async () => {
    if (filteredActions.length === 0) return;
    if (!window.confirm(`Approve and execute ${filteredActions.length} visible actions?`)) return;
    setBulkApproving(true);
    try {
      let success = 0; let failed = 0; let firstError = null;
      for (const action of filteredActions) {
        try { await api.post(`/autopilot/actions/${action.id}/approve`); success++; }
        catch (err) { failed++; if (!firstError) firstError = err.response?.data?.details || err.response?.data?.error || err.message; }
      }
      failed > 0 ? toast.error(`Approved ${success}, failed ${failed}. ${firstError}`) : toast.success(`Approved ${success} actions`);
      await fetchData();
    } catch { toast.error("Bulk approval failed"); } finally { setBulkApproving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const RANGE_OPTIONS = [
    { key: "today", label: "Today" }, { key: "7d", label: "7d" }, { key: "30d", label: "30d" },
    { key: "90d", label: "90d" }, { key: "all", label: "All" }, { key: "custom", label: "Custom" },
  ];

  const TABS = [
    { key: "pending", label: `Pending (${actions.length})` },
    { key: "history", label: "History" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 theme-surface border-b theme-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold theme-text leading-tight">AI Autopilot</h1>
              <p className="text-xs theme-text-muted">{user?.username ? `· ${user.username}` : "Autonomous task management"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings?.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {settings?.enabled ? "Active" : "Disabled"}
            </span>
            <button
              onClick={() => toggleAutopilot(!settings?.enabled)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${settings?.enabled ? "bg-red-100 text-red-700 active:bg-red-200" : "bg-primary-600 text-white active:bg-primary-700"}`}
            >
              {settings?.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-3">
            {/* Range pills - scrollable */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {RANGE_OPTIONS.map(({ key, label }) => (
                <button key={key} onClick={() => setStatsRange(key)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${statsRange === key ? "bg-primary-600 text-white" : "bg-[var(--surface-soft)] theme-text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
            {statsRange === "custom" && (
              <div className="flex gap-2 mt-2">
                <input type="date" value={statsCustomFrom} max={statsCustomTo || TODAY} onChange={(e) => setStatsCustomFrom(e.target.value)}
                  className="flex-1 border theme-border rounded-lg px-2 py-1.5 text-xs theme-surface theme-text" />
                <input type="date" value={statsCustomTo} min={statsCustomFrom || undefined} max={TODAY} onChange={(e) => setStatsCustomTo(e.target.value)}
                  className="flex-1 border theme-border rounded-lg px-2 py-1.5 text-xs theme-surface theme-text" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <MiniStat label="Pending" value={stats.pending} color="yellow" icon={Clock3} />
              <MiniStat label="Executed" value={stats.executed} color="green" icon={CheckCircle2} />
              <MiniStat label="Rejected" value={stats.rejected} color="red" icon={XCircle} />
              <MiniStat label="Auto-OK" value={stats.autoApproved} color="purple" icon={Zap} />
              <MiniStat label="Confidence" value={`${Math.round((stats.avgConfidence || 0) * 100)}%`} color="blue" icon={Target} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${activeTab === key ? "bg-primary-600 text-white" : "theme-text-muted bg-[var(--surface-soft)]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* PENDING TAB */}
        {activeTab === "pending" && (
          <div className="flex flex-col gap-3">
            {/* Filter chips + actions */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { key: "all", label: `All (${actionTypeCounts.all})` },
                  { key: "reassign", label: `Assign (${actionTypeCounts.reassign})` },
                  { key: "adjust_deadline", label: `Deadline (${actionTypeCounts.adjust_deadline})` },
                  { key: "escalate", label: `Escalate (${actionTypeCounts.escalate})` },
                  { key: "create_standup", label: `Standup (${actionTypeCounts.create_standup})` },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setActionFilter(key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${actionFilter === key ? "bg-primary-600 text-white" : "bg-[var(--surface-soft)] theme-text-muted"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={approveVisibleActions} disabled={bulkApproving || filteredActions.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold active:bg-emerald-700 disabled:opacity-50">
                  {bulkApproving ? "Approving…" : `Approve All (${filteredActions.length})`}
                </button>
                <button onClick={runAnalysis} disabled={runningAnalysis || !settings?.enabled}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-semibold active:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {runningAnalysis ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Running…</> : <><Play className="w-3.5 h-3.5" />Run Analysis</>}
                </button>
              </div>
            </div>

            {filteredActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="p-5 rounded-full bg-[var(--surface-soft)]">
                  <Bot className="w-10 h-10 theme-text-muted" />
                </div>
                <p className="font-semibold theme-text">No pending actions</p>
                <p className="text-sm theme-text-muted text-center px-4">
                  {settings?.enabled ? "Autopilot is monitoring your workspace." : "Enable autopilot to start receiving suggestions."}
                </p>
              </div>
            ) : (
              filteredActions.map((action) => (
                <ActionCard key={action.id} action={action}
                  onApprove={() => approveAction(action.id)}
                  onReject={(reason) => rejectAction(action.id, reason)}
                  processing={processingIds.has(action.id)} />
              ))
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="flex flex-col gap-3">
            {/* Filters */}
            <div className="theme-surface border theme-border rounded-2xl p-3 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 theme-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={historyFilters.search}
                  onChange={(e) => setHistoryFilters((p) => ({ ...p, search: e.target.value }))}
                  placeholder="Search task, reason, type…"
                  className="w-full pl-9 pr-3 py-2 border theme-border rounded-xl text-sm theme-surface theme-text" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={historyFilters.status}
                  onChange={(e) => setHistoryFilters((p) => ({ ...p, status: e.target.value }))}
                  className="border theme-border rounded-xl px-3 py-2 text-sm theme-surface theme-text">
                  <option value="all">All statuses</option>
                  <option value="executed">Executed</option>
                  <option value="rejected">Rejected</option>
                  <option value="auto_approved">Auto Approved</option>
                  <option value="approved">Approved</option>
                </select>
                <select value={historyFilters.limit}
                  onChange={(e) => setHistoryFilters((p) => ({ ...p, limit: parseInt(e.target.value, 10) }))}
                  className="border theme-border rounded-xl px-3 py-2 text-sm theme-surface theme-text">
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <input type="date" value={historyFilters.fromDate} max={historyFilters.toDate || TODAY}
                  onChange={(e) => setHistoryFilters((p) => ({ ...p, fromDate: e.target.value }))}
                  className="border theme-border rounded-xl px-3 py-2 text-sm theme-surface theme-text" />
                <input type="date" value={historyFilters.toDate} min={historyFilters.fromDate || undefined} max={TODAY}
                  onChange={(e) => setHistoryFilters((p) => ({ ...p, toDate: e.target.value }))}
                  className="border theme-border rounded-xl px-3 py-2 text-sm theme-surface theme-text" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs theme-text-muted">{historyPagination.total} records</span>
                <button onClick={() => fetchHistory(historyPagination.page)}
                  className="flex items-center gap-1 text-xs theme-text-muted active:opacity-70">
                  <RefreshCw className="w-3.5 h-3.5" />Refresh
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex flex-col gap-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl theme-surface border theme-border animate-pulse" />)}</div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-12 theme-text-muted text-sm">No historical actions found.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {historyItems.map((row) => (
                  <div key={row.id} className="theme-surface border theme-border rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold theme-text truncate">{row.task_title || "N/A"}</p>
                        {row.project_name && <p className="text-xs theme-text-muted">{row.project_name}</p>}
                      </div>
                      <StatusPill status={row.status} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-xs theme-text-muted">{humanizeActionType(row.action_type)}</span>
                      <span className="text-xs theme-text-muted">·</span>
                      <span className="text-xs theme-text-muted">{row.approved_by_username || row.decision_by_username || "system"}</span>
                      <span className="text-xs theme-text-muted">·</span>
                      <span className="text-xs theme-text-muted">{formatDateTime(row.executed_at || row.approved_at || row.created_at)}</span>
                    </div>
                    {row.reason && <p className="text-xs theme-text-muted mt-1 line-clamp-2">{row.reason}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs theme-text-muted">Page {historyPagination.page} of {historyPagination.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => fetchHistory(Math.max(historyPagination.page - 1, 1))} disabled={!historyPagination.hasPrev}
                  className="px-3 py-2 border theme-border rounded-xl text-xs theme-text disabled:opacity-40 active:opacity-70">Prev</button>
                <button onClick={() => fetchHistory(historyPagination.page + 1)} disabled={!historyPagination.hasNext}
                  className="px-3 py-2 border theme-border rounded-xl text-xs theme-text disabled:opacity-40 active:opacity-70">Next</button>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <SettingsPanel settings={settings} onSave={setSettings} apiClient={api} />
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, icon: Icon }) {
  const cls = { yellow: "bg-yellow-50 text-yellow-700", green: "bg-green-50 text-green-700", red: "bg-red-50 text-red-700", purple: "bg-purple-50 text-purple-700", blue: "bg-blue-50 text-blue-700" };
  return (
    <div className={`rounded-xl p-2.5 flex items-center gap-2 ${cls[color]}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <div>
        <p className="text-base font-bold leading-tight">{value}</p>
        <p className="text-[10px] font-medium leading-tight">{label}</p>
      </div>
    </div>
  );
}

function ActionCard({ action, onApprove, onReject, processing = false }) {
  const [expanded, setExpanded] = useState(false);

  const actionIcons = { reassign: UserCheck, adjust_deadline: CalendarClock, escalate: AlertTriangle, create_standup: FileText };
  const actionLabels = { reassign: "Auto-Assignment", adjust_deadline: "Deadline Adjustment", escalate: "Escalation", create_standup: "Daily Standup" };
  const confidenceColor = (s) => s >= 0.8 ? "text-green-600" : s >= 0.6 ? "text-yellow-600" : "text-red-600";
  const Icon = actionIcons[action.action_type] || Bot;
  const isStandup = action.action_type === "create_standup";
  const cs = action.current_state || {};
  const pc = action.proposed_changes || {};

  return (
    <div className={`theme-surface border rounded-2xl overflow-hidden ${isStandup ? "border-blue-200" : "theme-border"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className={`shrink-0 p-2 rounded-xl ${isStandup ? "bg-blue-100" : "bg-[var(--surface-soft)]"}`}>
          <Icon className={`w-5 h-5 ${isStandup ? "text-blue-600" : "theme-text"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold theme-text text-sm leading-tight">
            {isStandup ? `Standup — ${pc.project_name || cs.project_name || "Project"}` : (actionLabels[action.action_type] || action.action_type)}
          </p>
          {action.task_title && <p className="text-xs theme-text-muted truncate">{action.task_title}</p>}
          {isStandup && <p className="text-xs text-blue-600">→ #daily-standups</p>}
        </div>
        <span className={`shrink-0 text-xs font-semibold ${confidenceColor(action.confidence_score)}`}>
          {Math.round(action.confidence_score * 100)}%
        </span>
      </div>

      {/* Standup stats */}
      {isStandup && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {cs.sprint_name && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Sprint: {cs.sprint_name}</span>}
          {cs.status_changes != null && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{cs.status_changes} moves</span>}
          {cs.stuck_tasks > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{cs.stuck_tasks} stuck</span>}
          {cs.overdue_count > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{cs.overdue_count} overdue</span>}
        </div>
      )}

      {/* Reason */}
      {!isStandup && action.reason && (
        <p className="px-4 pb-3 text-xs theme-text-muted">{action.reason}</p>
      )}

      {/* Expand toggle */}
      <div className="px-4 pb-3">
        <button onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-xs text-primary-600 font-semibold active:opacity-70">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {isStandup ? (expanded ? "Hide" : "Preview") + " content" : (expanded ? "Hide" : "Show") + " details"}
        </button>
      </div>

      {expanded && (
        <div className="mx-4 mb-3 p-3 bg-[var(--surface-soft)] rounded-xl max-h-64 overflow-y-auto">
          {isStandup && pc.summary
            ? <StandupMarkdown content={pc.summary} />
            : <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-xs font-semibold theme-text mb-1">Current State</p>
                  <pre className="text-xs theme-text-muted whitespace-pre-wrap">{JSON.stringify(action.current_state, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-xs font-semibold theme-text mb-1">Proposed Changes</p>
                  <pre className="text-xs theme-text-muted whitespace-pre-wrap">{JSON.stringify(action.proposed_changes, null, 2)}</pre>
                </div>
              </div>
          }
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center border-t theme-border px-3 py-2 gap-1">
        <button onClick={onApprove} disabled={processing}
          className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-white text-xs font-semibold active:opacity-80 disabled:opacity-50 ${isStandup ? "bg-blue-600" : "bg-emerald-600"}`}>
          <Check className="w-3.5 h-3.5" />
          {processing ? (isStandup ? "Posting…" : "Processing…") : (isStandup ? "Post" : "Approve")}
        </button>
        <button onClick={() => {
          if (isStandup) { onReject(null); return; }
          const reason = window.prompt("Optional rejection reason:", "");
          if (reason === null) return;
          onReject(reason || null);
        }} disabled={processing}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg theme-text-muted bg-[var(--surface-soft)] text-xs font-semibold active:opacity-70 disabled:opacity-40">
          <X className="w-3.5 h-3.5" />
          {isStandup ? "Dismiss" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSave, apiClient }) {
  const [local, setLocal] = useState(settings || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(settings || {}); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.post("/autopilot/settings", {
        enabled: local.enabled, mode: local.mode,
        autoAssign: local.auto_assign, autoDeadlineAdjust: local.auto_deadline_adjust,
        autoEscalateBlockers: local.auto_escalate_blockers, autoGenerateStandup: local.auto_generate_standup,
        maxTasksPerUser: parseInt(local.max_tasks_per_user, 10) || 10,
        blockerThresholdHours: parseInt(local.blocker_threshold_hours, 10) || 48,
        velocityDropThreshold: parseFloat(local.velocity_drop_threshold) || 0.2,
        requireApproval: local.require_approval,
        autoApproveAfterHours: parseInt(local.auto_approve_after_hours, 10) || 24,
      });
      onSave(res.data.settings);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); } finally { setSaving(false); }
  };

  const set = (key, val) => setLocal((p) => ({ ...p, [key]: val }));

  return (
    <div className="flex flex-col gap-4">
      <div className="theme-surface border theme-border rounded-2xl p-4 space-y-4">
        <p className="font-semibold theme-text">Operation Mode</p>
        <select value={local.mode || "assisted"} onChange={(e) => set("mode", e.target.value)}
          className="w-full border theme-border rounded-xl px-3 py-2.5 text-sm theme-surface theme-text">
          <option value="monitoring">Monitoring Only</option>
          <option value="assisted">Assisted (Require approval)</option>
          <option value="autonomous">Autonomous (Auto-execute)</option>
        </select>
      </div>

      <div className="theme-surface border theme-border rounded-2xl p-4 space-y-2">
        <p className="font-semibold theme-text mb-2">Features</p>
        <Toggle label="Auto-assign unassigned tasks" checked={local.auto_assign ?? true} onChange={(v) => set("auto_assign", v)} />
        <Toggle label="Auto-adjust deadlines" checked={local.auto_deadline_adjust ?? true} onChange={(v) => set("auto_deadline_adjust", v)} />
        <Toggle label="Auto-escalate blocked tasks" checked={local.auto_escalate_blockers ?? true} onChange={(v) => set("auto_escalate_blockers", v)} />
        <Toggle label="Auto-generate daily standup" checked={local.auto_generate_standup ?? true} onChange={(v) => set("auto_generate_standup", v)} />
      </div>

      <div className="theme-surface border theme-border rounded-2xl p-4 space-y-3">
        <p className="font-semibold theme-text">Thresholds</p>
        <SettingInput label="Max tasks per user" type="number" value={local.max_tasks_per_user || 10} onChange={(v) => set("max_tasks_per_user", v)} />
        <SettingInput label="Blocker threshold (hours)" type="number" value={local.blocker_threshold_hours || 48} onChange={(v) => set("blocker_threshold_hours", v)} />
      </div>

      <div className="theme-surface border theme-border rounded-2xl p-4 space-y-3">
        <p className="font-semibold theme-text">Approval Settings</p>
        <Toggle label="Require approval for actions" checked={local.require_approval ?? true} onChange={(v) => set("require_approval", v)} />
        {local.require_approval && (
          <SettingInput label="Auto-approve after (hours)" type="number" value={local.auto_approve_after_hours || 24} onChange={(v) => set("auto_approve_after_hours", v)} />
        )}
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 rounded-2xl bg-primary-600 text-white font-semibold text-sm active:bg-primary-700 disabled:opacity-50">
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm theme-text">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />
    </label>
  );
}

function SettingInput({ label, type, value, onChange }) {
  return (
    <div>
      <label className="block text-xs theme-text-muted mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border theme-border rounded-xl px-3 py-2.5 text-sm theme-surface theme-text" />
    </div>
  );
}
