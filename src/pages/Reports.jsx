// src/pages/Reports.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  CheckCircle2, AlertCircle, Clock, BarChart2,
  Download, TrendingUp, Users, Layers, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { getUserProfilePath } from "../utils/userProfiles";

// ─── Status / Priority meta ──────────────────────────────────────────────────

const STATUS_META = {
  pending:      { label: "To Do",       color: "#f59e0b" },
  "in-progress":{ label: "In Progress", color: "#3b82f6" },
  completed:    { label: "Completed",   color: "#22c55e" },
  stage:        { label: "Stage",       color: "#a855f7" },
};
const FALLBACK_COLORS = ["#ffa500", "#ec4899", "#06b6d4", "#ef4444"];

function getStatusMeta(key, idx = 0) {
  const base = STATUS_META[key] || {};
  return {
    label: base.label || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Unknown"),
    color: base.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  };
}

// Status badge classes — dark-theme friendly outlines
const STATUS_BADGE = {
  pending:      "border-amber-500/60 text-amber-400",
  "in-progress":"border-blue-500/60 text-blue-400",
  completed:    "border-green-500/60 text-green-400",
  stage:        "border-purple-500/60 text-purple-400",
};
function getStatusBadge(key) {
  return STATUS_BADGE[key] || "border-[color:var(--border)] text-[color:var(--text-soft)]";
}

const PRIORITY_BADGE = {
  high:   "border-red-500/60 text-red-400",
  medium: "border-amber-500/60 text-amber-400",
  low:    "border-green-500/60 text-green-400",
};
function getPriorityBadge(p) {
  return PRIORITY_BADGE[p] || "border-[color:var(--border)] text-[color:var(--text-soft)]";
}
function getPriorityLabel(p) {
  if (p === "high") return "High";
  if (p === "medium") return "Medium";
  if (p === "low") return "Low";
  return p || "Medium";
}

// ─── MultiSelectChips ────────────────────────────────────────────────────────

function MultiSelectChips({ label, options, value, onChange, getLabel, getKey }) {
  const getId = getKey || ((o) => o.id);
  const remaining = options.filter((o) => !value.includes(getId(o)));
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-1 min-h-[26px]">
        {value.length === 0 && (
          <span className="text-[11px] text-[color:var(--text-muted)] italic">All</span>
        )}
        {value.map((id) => {
          const opt = options.find((o) => getId(o) === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--primary)] px-2 py-0.5 text-[11px] text-[color:var(--primary)]"
            >
              {getLabel(opt)}
              <button
                type="button"
                className="hover:text-red-400 transition-colors"
                onClick={() => onChange(value.filter((v) => v !== id))}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
      </div>
      <select
        className="border border-[color:var(--border)] rounded-lg px-2 py-1.5 text-xs text-[color:var(--text)] bg-[var(--surface)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]"
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
          e.target.value = "";
        }}
        value=""
      >
        <option value="">Add filter...</option>
        {remaining.map((o) => (
          <option key={getId(o)} value={getId(o)}>
            {getLabel(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accentColor }) {
  return (
    <div className="border border-[color:var(--border)] rounded-lg p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-[var(--surface-soft)] shrink-0">
        <Icon className="w-4 h-4" style={{ color: accentColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[color:var(--text-muted)] font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-[color:var(--text)] leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Chart tooltip style ─────────────────────────────────────────────────────

const CHART_TOOLTIP = {
  contentStyle: {
    fontSize: "11px",
    background: "#18181c",
    border: "1px solid #3c3c44",
    borderRadius: "6px",
    color: "#fafafa",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(task) {
  if (task.status === "completed" || !task.due_date) return false;
  return new Date(task.due_date).toISOString().slice(0, 10) < TODAY;
}

function exportCsv(tasks) {
  const header = ["ID", "Task", "Project", "Sprint", "Assignee", "Status", "Priority", "Due Date", "Created"];
  const rows = tasks.map((t) => [
    t.display_id || t.id,
    `"${(t.task || "").replace(/"/g, '""')}"`,
    t.project_name || "",
    t.sprint_name || "",
    t.username || "",
    t.status || "",
    t.priority || "",
    t.due_date ? t.due_date.slice(0, 10) : "",
    t.created_at ? t.created_at.slice(0, 10) : "",
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${TODAY}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Reports() {
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;
  const isManager = user?.role === "manager";

  // meta
  const [projects, setProjects]   = useState([]);
  const [users, setUsers]         = useState([]);       // all workspace users (full list)
  const [visibleUsers, setVisibleUsers] = useState([]); // users scoped to project filter
  const [sprints, setSprints]     = useState([]);

  // filters
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedUserIds,    setSelectedUserIds]    = useState([]);
  const [selectedSprintIds,  setSelectedSprintIds]  = useState([]);
  const [fromDate, setFromDate]     = useState("");
  const [toDate,   setToDate]       = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // result
  const [loading, setLoading] = useState(false);
  const [report,  setReport]  = useState(null);

  // tasks table
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey,  setSortKey]  = useState("overdue"); // overdue | due_date | created_at | status | priority

  // ── Load meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [pRes, uRes, sRes] = await Promise.all([
          api.get("/projects"),
          api.get("/users"),
          api.get("/sprints"),
        ]);
        const projectList = pRes.data || [];
        const userList = uRes.data || [];
        setProjects(projectList);
        setUsers(userList);
        setSprints(sRes.data || []);

        // For managers: initial visible users = users from all their assigned projects
        if (isManager && projectList.length > 0) {
          const ids = projectList.map((p) => p.id).join(",");
          try {
            const scopedRes = await api.get(`/users?projectIds=${ids}`);
            setVisibleUsers(scopedRes.data || userList);
          } catch {
            setVisibleUsers(userList);
          }
        } else {
          setVisibleUsers(userList);
        }
      } catch (err) {
        console.error("Reports meta load failed", err);
      }
    }
    load();
  }, [user, api]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update visible users when project filter changes ───────────────────────
  useEffect(() => {
    if (!user || projects.length === 0) return;
    async function refreshUsers() {
      // Effective project scope for user filter
      const scope = selectedProjectIds.length > 0
        ? selectedProjectIds
        : isManager
          ? projects.map((p) => p.id) // manager with no selection → all their projects
          : null; // admin with no selection → all users

      if (scope && scope.length > 0) {
        try {
          const res = await api.get(`/users?projectIds=${scope.join(",")}`);
          setVisibleUsers(res.data || users);
        } catch {
          setVisibleUsers(users);
        }
      } else {
        setVisibleUsers(users);
      }
    }
    refreshUsers();
  }, [selectedProjectIds, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Run report ─────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setLoading(true);
    setPage(1);
    try {
      const p = new URLSearchParams();
      if (selectedProjectIds.length) p.set("projects", selectedProjectIds.join(","));
      if (selectedUserIds.length)    p.set("users",    selectedUserIds.join(","));
      if (selectedSprintIds.length)  p.set("sprints",  selectedSprintIds.join(","));
      if (fromDate)                  p.set("from",     fromDate);
      if (toDate)                    p.set("to",       toDate);
      if (statusFilter   !== "all")  p.set("status",   statusFilter);
      if (priorityFilter !== "all")  p.set("priority", priorityFilter);

      const { data } = await api.get(`/reports/combined?${p}`);
      setReport(data || null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to run report");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedProjectIds([]);
    setSelectedUserIds([]);
    setSelectedSprintIds([]);
    setFromDate(""); setToDate("");
    setStatusFilter("all"); setPriorityFilter("all");
    setReport(null);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const statusOrder = useMemo(() => {
    if (!report?.byStatus) return [];
    const raw = report.byStatus.map((r) => r.status).filter(Boolean);
    const preferred = ["pending", "in-progress", "completed"];
    const ordered = preferred.filter((k) => raw.includes(k));
    raw.forEach((k) => { if (!ordered.includes(k)) ordered.push(k); });
    return ordered;
  }, [report]);

  const statusPieData = useMemo(() =>
    (report?.byStatus || []).map((row, i) => {
      const { label, color } = getStatusMeta(row.status, i);
      return { name: label, value: row.count, color };
    }), [report]);

  const userChartData = useMemo(() => {
    if (!report?.tasks || !statusOrder.length) return [];
    const map = new Map();
    report.tasks.forEach((t) => {
      const name = t.username || "Unassigned";
      if (!map.has(name)) { const base = { name }; statusOrder.forEach((s) => { base[s] = 0; }); map.set(name, base); }
      if (statusOrder.includes(t.status)) map.get(name)[t.status]++;
    });
    return Array.from(map.values());
  }, [report, statusOrder]);

  const projectChartData = useMemo(() => {
    if (!report?.tasks || !statusOrder.length) return [];
    const map = new Map();
    report.tasks.forEach((t) => {
      const name = t.project_name || "No project";
      if (!map.has(name)) { const base = { name }; statusOrder.forEach((s) => { base[s] = 0; }); map.set(name, base); }
      if (statusOrder.includes(t.status)) map.get(name)[t.status]++;
    });
    return Array.from(map.values());
  }, [report, statusOrder]);

  // sorted + paginated tasks
  const sortedTasks = useMemo(() => {
    if (!report?.tasks) return [];
    const tasks = [...report.tasks];
    if (sortKey === "overdue") {
      tasks.sort((a, b) => {
        const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ad = a.due_date || "9999", bd = b.due_date || "9999";
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
    } else if (sortKey === "due_date") {
      tasks.sort((a, b) => {
        const ad = a.due_date || "9999", bd = b.due_date || "9999";
        return ad < bd ? -1 : ad > bd ? 1 : 0;
      });
    } else if (sortKey === "status") {
      const order = { pending: 0, "in-progress": 1, completed: 2 };
      tasks.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    } else if (sortKey === "priority") {
      const order = { high: 0, medium: 1, low: 2 };
      tasks.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    } else {
      tasks.sort((a, b) => (b.created_at || "") > (a.created_at || "") ? 1 : -1);
    }
    return tasks;
  }, [report, sortKey]);

  const totalPages  = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const pagedTasks  = sortedTasks.slice((page - 1) * pageSize, page * pageSize);

  const summary = report?.summary || {};
  const completionPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  const controlSelectClass =
    "border border-[color:var(--border)] rounded-lg px-2 py-1.5 text-xs text-[color:var(--text)] bg-[var(--surface)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10 px-1">

      {/* ── HEADER ── */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Analytics</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Reports</h1>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
            Analyse tasks across projects, users, sprints, and time periods.
          </p>
        </div>
        {report && (
          <button
            onClick={() => exportCsv(report.tasks)}
            className="flex items-center gap-1.5 text-xs border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        )}
      </header>

      {/* ── FILTERS ── */}
      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Filters</h2>
          <button
            onClick={handleReset}
            className="text-[11px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline transition-colors"
          >
            Reset all
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <MultiSelectChips
            label="Projects"
            options={projects}
            value={selectedProjectIds}
            onChange={setSelectedProjectIds}
            getLabel={(p) => p ? p.name : "-"}
          />
          <MultiSelectChips
            label="Users"
            options={visibleUsers}
            value={selectedUserIds}
            onChange={setSelectedUserIds}
            getLabel={(u) => u ? (u.username || u.email || "-") : "-"}
          />
          <MultiSelectChips
            label="Sprints"
            options={sprints}
            value={selectedSprintIds}
            onChange={setSelectedSprintIds}
            getLabel={(s) => s ? `${s.name} (${s.project_name || "?"})` : "-"}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* From */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">From</label>
            <input
              type="date"
              value={fromDate}
              max={toDate || TODAY}
              onChange={(e) => setFromDate(e.target.value)}
              className={controlSelectClass}
            />
          </div>
          {/* To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">To</label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              max={TODAY}
              onChange={(e) => setToDate(e.target.value)}
              className={controlSelectClass}
            />
          </div>
          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={controlSelectClass}
            >
              <option value="all">All statuses</option>
              <option value="pending">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {/* Priority */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className={controlSelectClass}
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {/* Run button spanning remaining */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-semibold text-transparent select-none">Run</label>
            <button
              type="button"
              disabled={loading}
              onClick={handleRun}
              className="h-[30px] bg-[var(--primary)] text-[color:var(--primary-contrast)] text-xs font-semibold rounded-lg px-5 hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? "Running..." : "Run Report"}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={BarChart2}    label="Total Tasks"   value={summary.total ?? 0}       accentColor="#ffa500" />
          <KpiCard icon={CheckCircle2} label="Completed"     value={summary.completed ?? 0}   sub={`${completionPct}% completion rate`} accentColor="#22c55e" />
          <KpiCard icon={Clock}        label="In Progress"   value={summary.in_progress ?? 0} accentColor="#3b82f6" />
          <KpiCard icon={AlertCircle}  label="Overdue"       value={summary.overdue ?? 0}     accentColor="#ef4444" />
        </div>
      )}

      {/* ── CHARTS ROW ── */}
      {report && statusPieData.length > 0 && (
        <div className="grid md:grid-cols-3 gap-5">
          {/* Pie */}
          <div className="border border-[color:var(--border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-2">By Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {statusPieData.map((e, i) => (
                    <Cell key={i} fill={e.color} stroke="#0a0a0b" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
                <Legend height={28} iconSize={10} wrapperStyle={{ fontSize: "11px", color: "var(--text-muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* User bar */}
          <div className="border border-[color:var(--border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-2">By User</h3>
            {userChartData.length === 0
              ? <p className="text-xs text-[color:var(--text-muted)] mt-8 text-center">No data</p>
              : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={userChartData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3c3c44" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" height={55} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  {statusOrder.map((k, i) => {
                    const { label, color } = getStatusMeta(k, i);
                    return <Bar key={k} dataKey={k} stackId="a" name={label} fill={color} />;
                  })}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Project bar */}
          <div className="border border-[color:var(--border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-2">By Project</h3>
            {projectChartData.length === 0
              ? <p className="text-xs text-[color:var(--text-muted)] mt-8 text-center">No data</p>
              : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={projectChartData} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3c3c44" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" height={55} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  {statusOrder.map((k, i) => {
                    const { label, color } = getStatusMeta(k, i);
                    return <Bar key={k} dataKey={k} stackId="a" name={label} fill={color} />;
                  })}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── BREAKDOWN TABLES ── */}
      {report && (
        <div className="grid md:grid-cols-3 gap-5">
          {/* By Status */}
          <div className="border border-[color:var(--border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3">Status breakdown</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  <th className="text-left py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">Status</th>
                  <th className="text-right py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">Tasks</th>
                  <th className="text-right py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody>
                {report.byStatus?.map((row) => {
                  const { label } = getStatusMeta(row.status);
                  const badgeCls = getStatusBadge(row.status);
                  const pct = summary.total > 0 ? Math.round((row.count / summary.total) * 100) : 0;
                  return (
                    <tr key={row.status} className="border-b border-[color:var(--border)]">
                      <td className="py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${badgeCls}`}>{label}</span>
                      </td>
                      <td className="py-1.5 text-right font-semibold text-[color:var(--text)]">{row.count}</td>
                      <td className="py-1.5 text-right text-[color:var(--text-muted)]">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* By User */}
          <div className="border border-[color:var(--border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3">User breakdown</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  <th className="text-left py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">User</th>
                  <th className="text-right py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {report.byUser?.map((row) => (
                  <tr key={row.id || row.username} className="border-b border-[color:var(--border)]">
                    <td className="py-1.5">
                      {row.id ? (
                        <Link to={getUserProfilePath(row.id, auth.user?.id)} className="hover:text-[color:var(--primary)] transition-colors">
                          <div className="font-medium text-[color:var(--text)] truncate max-w-[120px]">{row.username || "Unassigned"}</div>
                          <div className="text-[10px] text-[color:var(--text-muted)] truncate max-w-[120px]">{row.email || ""}</div>
                        </Link>
                      ) : (
                        <>
                          <div className="font-medium text-[color:var(--text)] truncate max-w-[120px]">{row.username || "Unassigned"}</div>
                          <div className="text-[10px] text-[color:var(--text-muted)] truncate max-w-[120px]">{row.email || ""}</div>
                        </>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-[color:var(--text)]">{row.task_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Sprint */}
          <div className="border border-[color:var(--border)] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3">Sprint breakdown</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  <th className="text-left py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">Sprint</th>
                  <th className="text-right py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">Tasks</th>
                  <th className="text-right py-1.5 text-[color:var(--text-soft)] font-semibold uppercase tracking-wide">Done</th>
                </tr>
              </thead>
              <tbody>
                {report.bySprint?.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-[color:var(--text-muted)] italic">No sprints in this range</td></tr>
                )}
                {report.bySprint?.map((row) => (
                  <tr key={row.id || row.name} className="border-b border-[color:var(--border)]">
                    <td className="py-1.5">
                      <div className="font-medium text-[color:var(--text)] truncate max-w-[120px]">{row.name || "Backlog"}</div>
                      {row.sprint_status && (
                        <span className="text-[10px] text-[color:var(--text-muted)]">{row.sprint_status}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right font-semibold text-[color:var(--text)]">{row.task_count}</td>
                    <td className="py-1.5 text-right text-[color:var(--text-muted)]">{row.completed_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TASKS TABLE ── */}
      {report && (
        <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[color:var(--border)] bg-[var(--surface-soft)]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[color:var(--text)]">Tasks</h2>
              <span className="text-[11px] text-[color:var(--text-muted)] border border-[color:var(--border)] px-1.5 py-0.5 rounded-full">
                {sortedTasks.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-[color:var(--text-muted)]">Sort:</label>
              <select
                value={sortKey}
                onChange={(e) => { setSortKey(e.target.value); setPage(1); }}
                className="border border-[color:var(--border)] rounded px-2 py-1 text-[11px] text-[color:var(--text)] bg-[var(--surface)] focus:outline-none"
              >
                <option value="overdue">Overdue first</option>
                <option value="due_date">Due date</option>
                <option value="status">Status</option>
                <option value="priority">Priority</option>
                <option value="created_at">Newest first</option>
              </select>
              <label className="text-[11px] text-[color:var(--text-muted)]">Per page:</label>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-[color:var(--border)] rounded px-2 py-1 text-[11px] text-[color:var(--text)] bg-[var(--surface)] focus:outline-none"
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)] text-center py-10">No tasks match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[var(--surface-soft)] border-b border-[color:var(--border)]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[color:var(--text-soft)] text-xs uppercase tracking-wide font-semibold w-20">ID</th>
                    <th className="px-3 py-2.5 text-left text-[color:var(--text-soft)] text-xs uppercase tracking-wide font-semibold">Task</th>
                    <th className="px-3 py-2.5 text-left text-[color:var(--text-soft)] text-xs uppercase tracking-wide font-semibold w-28">Project</th>
                    <th className="px-3 py-2.5 text-left text-[color:var(--text-soft)] text-xs uppercase tracking-wide font-semibold w-28">Sprint</th>
                    <th className="px-3 py-2.5 text-left text-[color:var(--text-soft)] text-xs uppercase tracking-wide font-semibold w-24">Assignee</th>
                    <th
                      className={`px-3 py-2.5 text-left text-xs uppercase tracking-wide font-semibold w-24 cursor-pointer select-none ${sortKey === "status" ? "text-[color:var(--primary)]" : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]"}`}
                      onClick={() => { setSortKey("status"); setPage(1); }}
                    >
                      Status{sortKey === "status" ? " ↑" : ""}
                    </th>
                    <th
                      className={`px-3 py-2.5 text-left text-xs uppercase tracking-wide font-semibold w-20 cursor-pointer select-none ${sortKey === "priority" ? "text-[color:var(--primary)]" : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]"}`}
                      onClick={() => { setSortKey("priority"); setPage(1); }}
                    >
                      Priority{sortKey === "priority" ? " ↑" : ""}
                    </th>
                    <th
                      className={`px-3 py-2.5 text-left text-xs uppercase tracking-wide font-semibold w-24 cursor-pointer select-none ${sortKey === "due_date" ? "text-[color:var(--primary)]" : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]"}`}
                      onClick={() => { setSortKey("due_date"); setPage(1); }}
                    >
                      Due{sortKey === "due_date" ? " ↑" : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTasks.map((t) => {
                    const overdue = isOverdue(t);
                    const { label: sLabel } = getStatusMeta(t.status);
                    const sBadge = getStatusBadge(t.status);
                    const pBadge = getPriorityBadge(t.priority);
                    const pLabel = getPriorityLabel(t.priority);
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-[color:var(--border)] hover:bg-[var(--surface-soft)] transition-colors ${overdue ? "border-l-2 border-l-red-800/60" : ""}`}
                      >
                        <td className="px-3 py-3 font-mono text-[10px] text-[color:var(--text-muted)] whitespace-nowrap">
                          {t.display_id || "-"}
                        </td>
                        <td className="px-3 py-3 max-w-[220px]">
                          <div className="flex items-start gap-1.5">
                            {overdue && <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                            <span className="truncate text-[color:var(--text)] font-medium" title={t.task}>{t.task}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[color:var(--text-muted)] truncate max-w-[110px]" title={t.project_name}>
                          {t.project_name || "-"}
                        </td>
                        <td className="px-3 py-3 max-w-[110px]">
                          {t.sprint_name
                            ? <span className="inline-block border border-[color:var(--primary)] text-[color:var(--primary)] text-[10px] px-1.5 py-0.5 rounded truncate max-w-full" title={t.sprint_name}>{t.sprint_name}</span>
                            : <span className="text-[color:var(--text-muted)] text-[10px]">Backlog</span>
                          }
                        </td>
                        <td className="px-3 py-3 text-[color:var(--text-muted)] truncate max-w-[90px]" title={t.username}>
                          {t.username ? (
                            <Link to={getUserProfilePath(t.assigned_to, auth.user?.id)} className="hover:text-[color:var(--primary)] transition-colors">
                              {t.username}
                            </Link>
                          ) : (
                            <span className="text-[color:var(--text-soft)]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${sBadge}`}>
                            {sLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${pBadge}`}>
                            {pLabel}
                          </span>
                        </td>
                        <td className={`px-3 py-3 whitespace-nowrap text-xs ${overdue ? "text-red-500 font-semibold" : "text-[color:var(--text-muted)]"}`}>
                          {fmtDate(t.due_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {sortedTasks.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[color:var(--border)]">
              <span className="text-[11px] text-[color:var(--text-muted)]">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedTasks.length)} of {sortedTasks.length} tasks
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1 rounded border border-[color:var(--border)] disabled:opacity-40 hover:bg-[var(--surface-soft)] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-[color:var(--text-muted)]" />
                </button>
                <span className="text-[11px] text-[color:var(--text-muted)] px-2">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1 rounded border border-[color:var(--border)] disabled:opacity-40 hover:bg-[var(--surface-soft)] transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-[color:var(--text-muted)]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
