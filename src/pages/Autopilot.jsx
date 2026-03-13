import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import toast from "react-hot-toast";
import {
  Bot,
  Clock3,
  CheckCircle2,
  XCircle,
  Zap,
  Target,
  UserCheck,
  CalendarClock,
  AlertTriangle,
  FileText,
  Play,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  History,
  Search,
  RefreshCw,
} from "lucide-react";

/**
 * AI AUTOPILOT MODE
 * Approval queue for AI-generated actions
 */

export default function Autopilot() {
  const { auth } = useAuth();
  const user = auth?.user;

  const [settings, setSettings] = useState(null);
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());

  const [activeTab, setActiveTab] = useState("pending");
  const [actionFilter, setActionFilter] = useState("all");
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    search: "",
    status: "all",
    fromDate: "",
    toDate: "",
    limit: 10,
  });
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab !== "history") return;
    const timer = setTimeout(() => {
      fetchHistory(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [
    activeTab,
    historyFilters.search,
    historyFilters.status,
    historyFilters.fromDate,
    historyFilters.toDate,
    historyFilters.limit,
  ]);

  const fetchData = async () => {
    try {
      const [settingsRes, actionsRes, statsRes] = await Promise.all([
        api.get("/autopilot/settings"),
        api.get("/autopilot/actions"),
        api.get("/autopilot/stats"),
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
        page,
        limit: historyFilters.limit,
        search: historyFilters.search || undefined,
        status: historyFilters.status !== "all" ? historyFilters.status : undefined,
        fromDate: historyFilters.fromDate || undefined,
        toDate: historyFilters.toDate
          ? `${historyFilters.toDate}T23:59:59.999`
          : undefined,
      };

      const res = await api.get("/autopilot/history", { params });
      setHistoryItems(res.data.items || []);
      setHistoryPagination(res.data.pagination || historyPagination);
    } catch (err) {
      toast.error("Failed to fetch autopilot history");
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleAutopilot = async (enabled) => {
    try {
      const res = await api.post("/autopilot/settings", {
        enabled,
        mode: settings?.mode || "assisted",
        autoAssign: settings?.auto_assign ?? true,
        autoDeadlineAdjust: settings?.auto_deadline_adjust ?? true,
        autoEscalateBlockers: settings?.auto_escalate_blockers ?? true,
        autoGenerateStandup: settings?.auto_generate_standup ?? true,
        maxTasksPerUser: settings?.max_tasks_per_user || 10,
        blockerThresholdHours: settings?.blocker_threshold_hours || 48,
        velocityDropThreshold: settings?.velocity_drop_threshold || 0.2,
        requireApproval: settings?.require_approval ?? true,
        autoApproveAfterHours: settings?.auto_approve_after_hours || 24,
      });

      setSettings(res.data.settings);
      toast.success(res.data.message);
      await fetchData();
    } catch (err) {
      toast.error("Failed to update settings");
      console.error(err);
    }
  };

  const runAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const res = await api.post("/autopilot/run");
      toast.success(res.data.message);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to run analysis");
      console.error(err);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const approveAction = async (actionId) => {
    setProcessingIds((prev) => new Set(prev).add(actionId));
    try {
      const res = await api.post(`/autopilot/actions/${actionId}/approve`);
      toast.success(res.data.message || "Action executed");
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to approve action");
      console.error(err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  const rejectAction = async (actionId, reason = null) => {
    setProcessingIds((prev) => new Set(prev).add(actionId));
    try {
      await api.post(`/autopilot/actions/${actionId}/reject`, { reason });
      toast.success("Action rejected");
      await fetchData();
    } catch (err) {
      toast.error("Failed to reject action");
      console.error(err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  const actionTypeCounts = useMemo(() => {
    return {
      all: actions.length,
      reassign: actions.filter((a) => a.action_type === "reassign").length,
      adjust_deadline: actions.filter((a) => a.action_type === "adjust_deadline").length,
      escalate: actions.filter((a) => a.action_type === "escalate").length,
      create_standup: actions.filter((a) => a.action_type === "create_standup").length,
    };
  }, [actions]);

  const filteredActions = useMemo(() => {
    if (actionFilter === "all") return actions;
    return actions.filter((a) => a.action_type === actionFilter);
  }, [actions, actionFilter]);

  const approveVisibleActions = async () => {
    if (filteredActions.length === 0) return;
    const confirmed = window.confirm(
      `Approve and execute ${filteredActions.length} visible actions?`
    );
    if (!confirmed) return;

    setBulkApproving(true);
    try {
      let success = 0;
      let failed = 0;
      let firstError = null;

      for (const action of filteredActions) {
        try {
          await api.post(`/autopilot/actions/${action.id}/approve`);
          success += 1;
        } catch (err) {
          failed += 1;
          if (!firstError) {
            firstError =
              err.response?.data?.details ||
              err.response?.data?.error ||
              err.message ||
              "Unknown approval error";
          }
        }
      }

      if (failed > 0) {
        toast.error(`Approved ${success}, failed ${failed}. ${firstError}`);
      } else {
        toast.success(`Approved ${success} actions`);
      }

      await fetchData();
    } catch (err) {
      toast.error("Bulk approval failed");
      console.error(err);
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold theme-text">AI Autopilot</h1>
              <p className="theme-text-muted">
                Autonomous task management powered by AI
                {user?.username ? ` · ${user.username}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-lg font-semibold ${
                settings?.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {settings?.enabled ? "Active" : "Disabled"}
            </div>
            <button
              onClick={() => toggleAutopilot(!settings?.enabled)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                settings?.enabled
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {settings?.enabled ? "Disable Autopilot" : "Enable Autopilot"}
            </button>
          </div>
        </div>

        {stats && (
          <div>
            <p className="text-xs text-gray-400 mb-2 text-right">
              Executed / Rejected / Auto-Approved counts show last 7 days
            </p>
            <div className="grid grid-cols-5 gap-4">
              <StatCard label="Pending" value={stats.pending} icon={Clock3} color="yellow" />
              <StatCard label="Executed (7d)" value={stats.executed} icon={CheckCircle2} color="green" />
              <StatCard label="Rejected (7d)" value={stats.rejected} icon={XCircle} color="red" />
              <StatCard label="Auto-Approved (7d)" value={stats.autoApproved} icon={Zap} color="purple" />
              <StatCard
                label="Avg Confidence (7d)"
                value={`${Math.round((stats.avgConfidence || 0) * 100)}%`}
                icon={Target}
                color="blue"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-b theme-border mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-2 px-4 font-semibold transition ${
              activeTab === "pending"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "theme-text-muted hover:text-[var(--text)]"
            }`}
          >
            Pending Actions ({actions.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-2 px-4 font-semibold transition inline-flex items-center gap-2 ${
              activeTab === "history"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "theme-text-muted hover:text-[var(--text)]"
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-2 px-4 font-semibold transition ${
              activeTab === "settings"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "theme-text-muted hover:text-[var(--text)]"
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === "pending" && (
        <div>
          <div className="mb-6 flex justify-end">
            <div className="flex items-center gap-3">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All ({actionTypeCounts.all})</option>
                <option value="reassign">Reassign ({actionTypeCounts.reassign})</option>
                <option value="adjust_deadline">Deadline ({actionTypeCounts.adjust_deadline})</option>
                <option value="escalate">Escalate ({actionTypeCounts.escalate})</option>
                <option value="create_standup">Standup ({actionTypeCounts.create_standup})</option>
              </select>

              <button
                onClick={approveVisibleActions}
                disabled={bulkApproving || filteredActions.length === 0}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkApproving ? "Approving..." : `Approve Visible (${filteredActions.length})`}
              </button>

              <button
                onClick={runAnalysis}
                disabled={runningAnalysis || !settings?.enabled}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {runningAnalysis ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Analysis Now
                  </>
                )}
              </button>
            </div>
          </div>

          {filteredActions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No pending actions</h3>
              <p className="text-gray-600">
                {settings?.enabled
                  ? "Autopilot is monitoring your workspace. New actions will appear here."
                  : "Enable autopilot to start receiving intelligent suggestions."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onApprove={() => approveAction(action.id)}
                  onReject={(reason) => rejectAction(action.id, reason)}
                  processing={processingIds.has(action.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <SettingsPanel settings={settings} onSave={setSettings} apiClient={api} />
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="theme-surface border theme-border rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs theme-text-muted mb-1 block">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 theme-text-soft absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={historyFilters.search}
                    onChange={(e) =>
                      setHistoryFilters((prev) => ({ ...prev, search: e.target.value }))
                    }
                    placeholder="Task, reason, action type, approver..."
                    className="w-full pl-9 pr-3 py-2 border theme-border theme-input rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs theme-text-muted mb-1 block">Status</label>
                <select
                  value={historyFilters.status}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border theme-border theme-input rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="executed">Executed</option>
                  <option value="rejected">Rejected</option>
                  <option value="auto_approved">Auto Approved</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div>
                <label className="text-xs theme-text-muted mb-1 block">From date</label>
                <input
                  type="date"
                  value={historyFilters.fromDate}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({ ...prev, fromDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border theme-border theme-input rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs theme-text-muted mb-1 block">To date</label>
                <input
                  type="date"
                  value={historyFilters.toDate}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({ ...prev, toDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border theme-border theme-input rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="text-sm theme-text-muted">
                {historyPagination.total} records
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={historyFilters.limit}
                  onChange={(e) =>
                    setHistoryFilters((prev) => ({
                      ...prev,
                      limit: parseInt(e.target.value, 10),
                    }))
                  }
                  className="px-3 py-2 border theme-border rounded-lg text-sm theme-input"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <button
                  onClick={() => fetchHistory(historyPagination.page)}
                  className="px-3 py-2 border theme-border rounded-lg text-sm hover:bg-[var(--surface-soft)] inline-flex items-center gap-1 theme-surface-soft theme-text"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="theme-surface border theme-border rounded-lg overflow-hidden">
            {historyLoading ? (
              <div className="p-8 text-center theme-text-muted">Loading history...</div>
            ) : historyItems.length === 0 ? (
              <div className="p-8 text-center theme-text-muted">
                No historical actions found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-surface-soft theme-text-muted">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 font-semibold">Action</th>
                      <th className="text-left px-4 py-3 font-semibold">Task</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">By</th>
                      <th className="text-left px-4 py-3 font-semibold">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((row) => (
                      <tr key={row.id} className="border-t theme-border">
                        <td className="px-4 py-3 theme-text whitespace-nowrap">
                          {formatDateTime(row.executed_at || row.approved_at || row.created_at)}
                        </td>
                        <td className="px-4 py-3 theme-text whitespace-nowrap">
                          {humanizeActionType(row.action_type)}
                        </td>
                        <td className="px-4 py-3 theme-text">
                          <div>{row.task_title || "N/A"}</div>
                          {row.project_name && (
                            <div className="text-xs theme-text-muted">{row.project_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-3 theme-text whitespace-nowrap">
                          {row.approved_by_username ||
                            row.decision_by_username ||
                            "system"}
                        </td>
                        <td className="px-4 py-3 theme-text-muted max-w-xl">
                          <div className="truncate" title={row.reason}>
                            {row.reason}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {historyPagination.page} of {historyPagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchHistory(Math.max(historyPagination.page - 1, 1))}
                disabled={!historyPagination.hasPrev}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchHistory(historyPagination.page + 1)}
                disabled={!historyPagination.hasNext}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function humanizeActionType(type) {
  const map = {
    reassign: "Auto Assignment",
    adjust_deadline: "Deadline Adjustment",
    escalate: "Escalation",
    create_standup: "Standup Summary",
  };
  return map[type] || type || "Unknown";
}

function StatusPill({ status }) {
  const classes = {
    executed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    auto_approved: "bg-purple-100 text-purple-700",
    approved: "bg-blue-100 text-blue-700",
    pending: "bg-yellow-100 text-yellow-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
        classes[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status === "auto_approved" ? "auto approved" : status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    yellow: "bg-yellow-50 text-yellow-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-6 h-6" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm font-semibold">{label}</div>
    </div>
  );
}

function ActionCard({ action, onApprove, onReject, processing = false }) {
  const [expanded, setExpanded] = useState(false);

  const actionIcons = {
    reassign: UserCheck,
    adjust_deadline: CalendarClock,
    escalate: AlertTriangle,
    create_standup: FileText,
  };

  const actionLabels = {
    reassign: "Auto-Assignment",
    adjust_deadline: "Deadline Adjustment",
    escalate: "Escalation",
    create_standup: "Daily Standup",
  };

  const confidenceColor = (score) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const Icon = actionIcons[action.action_type] || Bot;
  const isStandup = action.action_type === "create_standup";
  const cs = action.current_state || {};
  const pc = action.proposed_changes || {};

  if (isStandup) {
    return (
      <div className="bg-white border border-blue-200 rounded-lg p-6 hover:shadow-md transition">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-900">
              Daily Standup — {pc.project_name || cs.project_name || "Project"}
            </h3>
            <p className="text-xs text-gray-500">
              Ready to post to <span className="font-semibold text-blue-600">#daily-standups</span>
            </p>
          </div>
          <span className={`text-sm font-semibold ${confidenceColor(action.confidence_score)}`}>
            {Math.round(action.confidence_score * 100)}% confidence
          </span>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {cs.status_changes != null && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
              {cs.status_changes} task movements
            </span>
          )}
          {cs.stuck_tasks > 0 && (
            <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs font-semibold rounded-full">
              {cs.stuck_tasks} stuck task{cs.stuck_tasks !== 1 ? "s" : ""}
            </span>
          )}
          {cs.new_tasks > 0 && (
            <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
              {cs.new_tasks} new task{cs.new_tasks !== 1 ? "s" : ""}
            </span>
          )}
          {cs.overdue_count > 0 && (
            <span className="px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full">
              {cs.overdue_count} overdue
            </span>
          )}
          {cs.active_count != null && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
              {cs.active_count} active tasks
            </span>
          )}
        </div>

        {/* Preview / Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-3"
        >
          <span className="inline-flex items-center gap-1">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {expanded ? "Hide" : "Preview"} standup content
          </span>
        </button>

        {expanded && pc.summary && (
          <div className="mt-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {pc.summary}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onApprove}
            disabled={processing}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center justify-center gap-1">
              <Check className="w-4 h-4" />
              {processing ? "Posting..." : "Post to #daily-standups"}
            </span>
          </button>
          <button
            onClick={() => onReject(null)}
            disabled={processing}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-1">
              <X className="w-4 h-4" />
              Dismiss
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Default card for reassign / adjust_deadline / escalate / handle_overdue
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Icon className="w-8 h-8 text-slate-700" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">{actionLabels[action.action_type] || action.action_type}</h3>
              {action.task_title && <p className="text-sm text-gray-600">Task: {action.task_title}</p>}
            </div>
            <div className={`ml-auto text-sm font-semibold ${confidenceColor(action.confidence_score)}`}>
              {Math.round(action.confidence_score * 100)}% confidence
            </div>
          </div>

          <p className="text-gray-700 mb-4">{action.reason}</p>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-2"
          >
            <span className="inline-flex items-center gap-1">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {expanded ? "Hide" : "Show"} Details
            </span>
          </button>

          {expanded && (
            <div className="mt-4 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Current State</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(action.current_state, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Proposed Changes</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(action.proposed_changes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={onApprove}
          disabled={processing}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-1">
            <Check className="w-4 h-4" />
            {processing ? "Processing..." : "Approve & Execute"}
          </span>
        </button>
        <button
          onClick={() => {
            const reason = window.prompt("Optional rejection reason:", "");
            if (reason === null) return;
            onReject(reason || null);
          }}
          disabled={processing}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="inline-flex items-center gap-1">
            <X className="w-4 h-4" />
            Reject
          </span>
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSave, apiClient }) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings || {});
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.post("/autopilot/settings", {
        enabled: localSettings.enabled,
        mode: localSettings.mode,
        autoAssign: localSettings.auto_assign,
        autoDeadlineAdjust: localSettings.auto_deadline_adjust,
        autoEscalateBlockers: localSettings.auto_escalate_blockers,
        autoGenerateStandup: localSettings.auto_generate_standup,
        maxTasksPerUser: parseInt(localSettings.max_tasks_per_user, 10) || 10,
        blockerThresholdHours: parseInt(localSettings.blocker_threshold_hours, 10) || 48,
        velocityDropThreshold: parseFloat(localSettings.velocity_drop_threshold) || 0.2,
        requireApproval: localSettings.require_approval,
        autoApproveAfterHours: parseInt(localSettings.auto_approve_after_hours, 10) || 24,
      });

      onSave(res.data.settings);
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Autopilot Configuration</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Operation Mode</label>
          <select
            value={localSettings.mode || "assisted"}
            onChange={(e) => setLocalSettings({ ...localSettings, mode: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="monitoring">Monitoring Only (No actions)</option>
            <option value="assisted">Assisted (Require approval)</option>
            <option value="autonomous">Autonomous (Auto-execute)</option>
          </select>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Enabled Features</h3>
          <div className="space-y-2">
            <ToggleOption
              label="Auto-assign unassigned tasks"
              checked={localSettings.auto_assign ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_assign: checked })}
            />
            <ToggleOption
              label="Auto-adjust deadlines based on velocity"
              checked={localSettings.auto_deadline_adjust ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_deadline_adjust: checked })}
            />
            <ToggleOption
              label="Auto-escalate blocked tasks"
              checked={localSettings.auto_escalate_blockers ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_escalate_blockers: checked })}
            />
            <ToggleOption
              label="Auto-generate daily standup"
              checked={localSettings.auto_generate_standup ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_generate_standup: checked })}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Thresholds</h3>
          <div className="space-y-3">
            <InputField
              label="Max tasks per user"
              type="number"
              value={localSettings.max_tasks_per_user || 10}
              onChange={(value) => setLocalSettings({ ...localSettings, max_tasks_per_user: value })}
            />
            <InputField
              label="Blocker threshold (hours)"
              type="number"
              value={localSettings.blocker_threshold_hours || 48}
              onChange={(value) => setLocalSettings({ ...localSettings, blocker_threshold_hours: value })}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Approval Settings</h3>
          <div className="space-y-3">
            <ToggleOption
              label="Require approval for actions"
              checked={localSettings.require_approval ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, require_approval: checked })}
            />
            {localSettings.require_approval && (
              <InputField
                label="Auto-approve after (hours)"
                type="number"
                value={localSettings.auto_approve_after_hours || 24}
                onChange={(value) => setLocalSettings({ ...localSettings, auto_approve_after_hours: value })}
              />
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function ToggleOption({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function InputField({ label, type, value, onChange }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
