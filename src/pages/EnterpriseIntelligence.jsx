/**
 * Workspace Intelligence Hub
 * Four AI-powered strategic analytics — admin only, fully automatic.
 *  1. Pre-Project Profitability Oracle
 *  2. Resignation Radar (60-day early warning)
 *  3. Ghost Work Detection
 *  4. Organizational Truth Map
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useApi, API_BASE_URL } from "../api";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Eye,
  Map,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  FolderOpen,
  Shield,
  Activity,
  Clock,
  CheckCircle2,
  BarChart2,
  AlertCircle,
} from "lucide-react";

// ── Shared UI ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
        ${active
          ? "bg-[var(--primary)] text-[color:var(--primary-contrast)]"
          : "text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)]"}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-[color:var(--text-soft)]">
      <RefreshCw size={20} className="animate-spin mr-2" />
      <span className="text-sm">Analysing data…</span>
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)]">
      <AlertCircle size={32} className="mb-3 text-[color:var(--score-danger)]" />
      <p className="text-sm mb-4">{message || "Failed to load data"}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm">
          Retry
        </button>
      )}
    </div>
  );
}

function RiskBadge({ level }) {
  const map = {
    critical: "text-[color:var(--score-danger)]",
    high:     "text-[color:var(--score-danger)]",
    medium:   "text-[color:var(--primary)]",
    low:      "text-[color:var(--primary)]",
    clean:    "text-[color:var(--primary)]",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border border-[color:var(--border)] text-xs font-semibold capitalize ${map[level] || map.medium}`}>
      {level}
    </span>
  );
}

function ScoreBar({ value, max = 100, color = "indigo" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colors = {
    indigo: "bg-[var(--primary)]",
    red:    "bg-[var(--score-danger)]",
    green:  "bg-[var(--primary)]",
    yellow: "bg-[var(--primary)]",
    orange: "bg-[var(--primary)]",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[var(--surface-soft)] rounded-full overflow-hidden">
        <div className={`h-full ${colors[color] || colors.indigo} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[color:var(--text-muted)] w-6 text-right">{value}</span>
    </div>
  );
}

function StatPill({ label, value, color = "gray" }) {
  const textColor = {
    gray:   "text-[color:var(--text-muted)]",
    red:    "text-[color:var(--score-danger)]",
    green:  "text-[color:var(--primary)]",
    yellow: "text-[color:var(--primary)]",
  };
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border border-[color:var(--border)]`}>
      <span className={`text-lg font-bold leading-none ${textColor[color] || textColor.gray}`}>{value}</span>
      <span className="text-xs mt-1 text-[color:var(--text-soft)]">{label}</span>
    </div>
  );
}

function AIInsightCard({ insights, emptyMsg = "No AI insights available." }) {
  if (!insights || insights.length === 0) {
    return <p className="text-sm text-[color:var(--text-soft)] italic">{emptyMsg}</p>;
  }
  const priorityColor = {
    high:               "text-[color:var(--score-danger)]",
    critical:           "text-[color:var(--score-danger)]",
    medium:             "text-[color:var(--primary)]",
    low:                "text-[color:var(--primary)]",
    immediate:          "text-[color:var(--score-danger)]",
    this_week:          "text-[color:var(--primary)]",
    this_month:         "text-[color:var(--primary)]",
    process_issue:      "text-[color:var(--primary)]",
    needs_investigation:"text-[color:var(--primary)]",
    monitor:            "text-[color:var(--text-muted)]",
  };
  return (
    <div className="space-y-3">
      {insights.map((ins, i) => {
        const key = ins.priority || ins.urgency || ins.impact || ins.framing || "medium";
        return (
          <div key={i} className="border border-[color:var(--border)] rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-[color:var(--text)]">{ins.title || ins.username}</p>
              <span className={`text-xs capitalize font-medium ${priorityColor[key] || "text-[color:var(--text-muted)]"}`}>
                {key.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">{ins.detail || ins.action}</p>
          </div>
        );
      })}
    </div>
  );
}

function CollapsibleUser({ user, badge, detail }) {
  const [open, setOpen] = useState(false);
  const avatarUrl = user.avatarUrl
    ? user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_BASE_URL}${user.avatarUrl}`
    : null;

  return (
    <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-soft)] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--surface-soft)] flex items-center justify-center text-[color:var(--primary)] text-sm font-bold shrink-0">
              {user.username?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-[color:var(--text)]">{user.username}</p>
            <p className="text-xs text-[color:var(--text-soft)] capitalize">{user.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {open ? <ChevronUp size={16} className="text-[color:var(--text-soft)] shrink-0" /> : <ChevronDown size={16} className="text-[color:var(--text-soft)] shrink-0" />}
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-2 bg-[var(--surface-soft)] border-t border-[color:var(--border)]">{detail}</div>}
    </div>
  );
}

// ── Tab 1: Profitability Oracle ───────────────────────────────────────────────

function ProfitabilityOracle() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get("/intelligence/enterprise/profitability-oracle")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SectionLoader />;
  if (error)   return <ErrorBox message={error} onRetry={load} />;
  if (!data)   return null;

  const { calibration, projects, aiInsights } = data;

  return (
    <div className="space-y-6">
      {/* Calibration panel — derived from completed projects */}
      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3 flex items-center gap-2">
          <BarChart2 size={14} className="text-[color:var(--primary)]" /> Workspace Calibration (Completed Projects)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatPill label="Avg Completion"  value={`${calibration.avgCompletionRate}%`} color={calibration.avgCompletionRate >= 80 ? "green" : "yellow"} />
          <StatPill label="Avg Delay Rate"  value={`${calibration.avgDelayRate}%`}      color={calibration.avgDelayRate > 30 ? "red" : "yellow"} />
          <StatPill label="Avg Duration"    value={`${calibration.avgDurationDays}d`} />
          <StatPill label="Avg Team Size"   value={calibration.avgTeamSize} />
          <StatPill label="Avg Burn/wk"     value={calibration.avgBurnRatePerWeek}      color={calibration.avgBurnRatePerWeek > 0 ? "green" : "gray"} />
        </div>
      </div>

      {/* Project list */}
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--text-muted)] mb-3 flex items-center gap-2">
          <FolderOpen size={14} /> Project Risk Analysis ({projects.length})
        </h3>
        {projects.length === 0 ? (
          <p className="text-sm text-[color:var(--text-soft)] italic">No project data yet. Create tasks across projects to unlock analysis.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.projectId} className="border border-[color:var(--border)] rounded-lg p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[color:var(--text)]">{p.projectName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] font-medium ${p.isActive ? "text-[color:var(--primary)]" : "text-[color:var(--text-soft)]"}`}>
                        {p.isActive ? "Active" : "Completed"}
                      </span>
                    </div>
                    <p className="text-xs text-[color:var(--text-soft)] mt-0.5">{p.teamSize} members · {p.totalTasks} tasks</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className={`text-sm font-bold ${p.profitScore >= 70 ? "text-[color:var(--primary)]" : p.profitScore >= 40 ? "text-[color:var(--primary)]" : "text-[color:var(--score-danger)]"}`}>
                        {p.profitScore}
                      </span>
                      <p className="text-xs text-[color:var(--text-soft)]">health score</p>
                    </div>
                    <RiskBadge level={p.riskLevel} />
                  </div>
                </div>

                {/* Active project metrics */}
                {p.isActive && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                    <div>
                      <p className={`font-semibold ${p.netVelocity < 0 ? "text-[color:var(--score-danger)]" : "text-[color:var(--primary)]"}`}>
                        {p.netVelocity > 0 ? "+" : ""}{p.netVelocity}/wk
                      </p>
                      <p className="text-[color:var(--text-soft)]">Net velocity</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[color:var(--text-muted)]">{p.burnRatePerWeek}/wk</p>
                      <p className="text-[color:var(--text-soft)]">Burn rate</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.growthRatePerWeek > p.burnRatePerWeek ? "text-[color:var(--primary)]" : "text-[color:var(--text-muted)]"}`}>
                        {p.growthRatePerWeek}/wk
                      </p>
                      <p className="text-[color:var(--text-soft)]">Backlog growth</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.projectedWeeks > 12 ? "text-[color:var(--score-danger)]" : "text-[color:var(--text-muted)]"}`}>
                        {p.projectedWeeks != null ? `~${p.projectedWeeks}wk` : "—"}
                      </p>
                      <p className="text-[color:var(--text-soft)]">Est. to complete</p>
                    </div>
                  </div>
                )}

                {/* Completed project metrics */}
                {!p.isActive && (
                  <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                    <div>
                      <p className="font-semibold text-[color:var(--text-muted)]">{p.completionRate}%</p>
                      <p className="text-[color:var(--text-soft)]">Completion</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.taskGrowthPct > 50 ? "text-[color:var(--primary)]" : "text-[color:var(--text-muted)]"}`}>
                        {p.taskGrowthPct != null ? `+${p.taskGrowthPct}%` : "—"}
                      </p>
                      <p className="text-[color:var(--text-soft)]">Task growth</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.delayRate > 30 ? "text-[color:var(--score-danger)]" : "text-[color:var(--text-muted)]"}`}>{p.delayRate}%</p>
                      <p className="text-[color:var(--text-soft)]">Delay rate</p>
                    </div>
                  </div>
                )}

                {/* Risk signals */}
                {p.riskSignals && p.riskSignals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.riskSignals.map((s, i) => (
                      <span key={i} className="text-xs text-[color:var(--score-danger)] border border-[color:var(--border)] rounded-full px-2 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Duration for completed projects */}
                {!p.isActive && p.durationDays != null && (
                  <p className="text-xs text-[color:var(--text-soft)] mt-2">
                    <Clock size={10} className="inline mr-1" />{p.durationDays} days total duration
                  </p>
                )}

                {/* Velocity trend for active projects */}
                {p.isActive && p.velocityTrend != null && p.velocityTrend !== 0 && (
                  <p className={`text-xs mt-2 ${p.velocityTrend > 0 ? "text-[color:var(--primary)]" : "text-[color:var(--primary)]"}`}>
                    <Activity size={10} className="inline mr-1" />
                    Burn rate {p.velocityTrend > 0 ? "up" : "down"} {Math.abs(p.velocityTrend)}% vs last month
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3 flex items-center gap-2">
          <Zap size={14} className="text-[color:var(--primary)]" /> AI Strategic Insights
        </h3>
        <AIInsightCard insights={aiInsights} emptyMsg="Run more projects to unlock AI profitability insights." />
      </div>
    </div>
  );
}

// ── Tab 2: Resignation Radar ──────────────────────────────────────────────────

function ResignationRadar() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get("/intelligence/enterprise/resignation-radar")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SectionLoader />;
  if (error)   return <ErrorBox message={error} onRetry={load} />;
  if (!data)   return null;

  const { users, summary, aiInsights } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",     value: summary.total,    color: "gray" },
          { label: "Critical",  value: summary.critical, color: summary.critical > 0 ? "red"    : "gray" },
          { label: "High Risk", value: summary.high,     color: summary.high     > 0 ? "red"    : "gray" },
          { label: "Medium",    value: summary.medium,   color: summary.medium   > 0 ? "yellow" : "gray" },
        ].map((s) => (
          <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      <div className="space-y-2">
        {users.length === 0 && <p className="text-sm text-[color:var(--text-soft)] italic">No users to analyse.</p>}
        {users.map((u) => (
          <CollapsibleUser
            key={u.userId}
            user={u}
            badge={
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={`text-base font-bold ${u.riskScore >= 55 ? "text-[color:var(--score-danger)]" : u.riskScore >= 35 ? "text-[color:var(--primary)]" : u.riskScore >= 20 ? "text-[color:var(--primary)]" : "text-[color:var(--primary)]"}`}>
                    {u.riskScore}
                  </span>
                  <p className="text-xs text-[color:var(--text-soft)] leading-none">risk</p>
                </div>
                <RiskBadge level={u.riskLevel} />
              </div>
            }
            detail={
              <div className="space-y-3 pt-1">
                {u.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {u.signals.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 text-[color:var(--score-danger)] text-xs rounded-full border border-[color:var(--border)]">{s}</span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-medium text-[color:var(--text-muted)] mb-1">Task Completions</p>
                    <p className="text-[color:var(--text-soft)]">Last 30d: <span className="font-semibold text-[color:var(--text)]">{u.metrics.recentTaskCompletions}</span></p>
                    <p className="text-[color:var(--text-soft)]">Prev 30d: <span className="font-semibold text-[color:var(--text)]">{u.metrics.prevTaskCompletions}</span></p>
                    {u.metrics.taskDrop > 0 && <p className="text-[color:var(--score-danger)]">↓ {u.metrics.taskDrop}% drop</p>}
                  </div>
                  <div>
                    <p className="font-medium text-[color:var(--text-muted)] mb-1">Attendance (avg min/day)</p>
                    <p className="text-[color:var(--text-soft)]">Last 30d: <span className="font-semibold text-[color:var(--text)]">{u.metrics.recentAttendanceMinutes}</span></p>
                    <p className="text-[color:var(--text-soft)]">Prev 30d: <span className="font-semibold text-[color:var(--text)]">{u.metrics.prevAttendanceMinutes}</span></p>
                    {u.metrics.attendanceDrop > 0 && <p className="text-[color:var(--score-danger)]">↓ {u.metrics.attendanceDrop}% drop</p>}
                  </div>
                  <div>
                    <p className="font-medium text-[color:var(--text-muted)] mb-1">Comments</p>
                    <p className="text-[color:var(--text-soft)]">Last 30d: <span className="font-semibold text-[color:var(--text)]">{u.metrics.recentComments}</span></p>
                    <p className="text-[color:var(--text-soft)]">Prev 30d: <span className="font-semibold text-[color:var(--text)]">{u.metrics.prevComments}</span></p>
                    {u.metrics.commentDrop > 0 && <p className="text-[color:var(--score-danger)]">↓ {u.metrics.commentDrop}%</p>}
                  </div>
                  <div>
                    <p className="font-medium text-[color:var(--text-muted)] mb-1">Activity</p>
                    <p className={u.metrics.daysSilent >= 7 ? "text-[color:var(--score-danger)] font-semibold" : "text-[color:var(--text-soft)]"}>
                      {u.metrics.daysSilent === 999 ? "Never active" : `${u.metrics.daysSilent}d since last action`}
                    </p>
                  </div>
                </div>
              </div>
            }
          />
        ))}
      </div>

      {aiInsights && aiInsights.length > 0 && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3 flex items-center gap-2">
            <Zap size={14} className="text-[color:var(--primary)]" /> AI Retention Recommendations
          </h3>
          <div className="space-y-3">
            {aiInsights.map((ins, i) => (
              <div key={i} className="flex gap-3 p-3 border border-[color:var(--border)] rounded-lg">
                <AlertTriangle size={14} className="text-[color:var(--primary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[color:var(--text)]">{ins.username}</p>
                  <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{ins.action}</p>
                  <span className="text-xs capitalize font-medium text-[color:var(--primary)]">{ins.urgency?.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Ghost Work Detection ───────────────────────────────────────────────

function GhostWorkDetection() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get("/intelligence/enterprise/ghost-work")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SectionLoader />;
  if (error)   return <ErrorBox message={error} onRetry={load} />;
  if (!data)   return null;

  const { users, summary, aiInsights, workspaceBenchmarks } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Members",   value: summary.total,    color: "gray" },
          { label: "Critical Flags",  value: summary.critical, color: summary.critical > 0 ? "red" : "gray" },
          { label: "High Flags",      value: summary.high,     color: summary.high     > 0 ? "red" : "gray" },
          { label: "Clean",           value: summary.clean,    color: summary.clean    > 0 ? "green" : "gray" },
        ].map((s) => (
          <StatPill key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      <div className="border border-[color:var(--border)] rounded-lg px-4 py-3 flex flex-wrap gap-6 text-xs text-[color:var(--text-muted)]">
        <span><strong className="text-[color:var(--text)]">Workspace avg attendance:</strong> {workspaceBenchmarks.avgAttendanceMinutes} min/day</span>
        <span><strong className="text-[color:var(--text)]">Workspace avg completions:</strong> {workspaceBenchmarks.avgMonthlyCompletions} tasks/mo</span>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <CollapsibleUser
            key={u.userId}
            user={u}
            badge={
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={`text-base font-bold ${u.ghostScore >= 55 ? "text-[color:var(--score-danger)]" : u.ghostScore >= 35 ? "text-[color:var(--primary)]" : u.ghostScore >= 15 ? "text-[color:var(--primary)]" : "text-[color:var(--primary)]"}`}>
                    {u.ghostScore}
                  </span>
                  <p className="text-xs text-[color:var(--text-soft)] leading-none">score</p>
                </div>
                <RiskBadge level={u.riskLevel} />
              </div>
            }
            detail={
              <div className="space-y-3 pt-1">
                {u.flags.length > 0 ? (
                  <div className="space-y-2">
                    {u.flags.map((f, i) => (
                      <div key={i} className={`p-2.5 rounded-lg border border-[color:var(--border)] text-xs ${f.severity === "high" ? "text-[color:var(--score-danger)]" : "text-[color:var(--primary)]"}`}>
                        <p className="font-semibold">{f.label}</p>
                        <p className="opacity-80 mt-0.5 text-[color:var(--text-muted)]">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[color:var(--primary)] flex items-center gap-1"><CheckCircle2 size={12} /> No anomalies detected</p>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs text-[color:var(--text-muted)]">
                  <div><p className="font-medium text-[color:var(--text-soft)]">Attendance</p><p>{u.metrics.avgAttendanceMinutes} min/day</p></div>
                  <div><p className="font-medium text-[color:var(--text-soft)]">Completions</p><p>{u.metrics.taskCompletions} tasks</p></div>
                  <div><p className="font-medium text-[color:var(--text-soft)]">Max burst</p><p>{u.metrics.maxHourlyBurst} actions/hr</p></div>
                  <div><p className="font-medium text-[color:var(--text-soft)]">Total assigned</p><p>{u.metrics.totalAssigned}</p></div>
                  <div><p className="font-medium text-[color:var(--text-soft)]">Reopened</p><p>{u.metrics.reopenedTasks}</p></div>
                </div>
              </div>
            }
          />
        ))}
      </div>

      {aiInsights && aiInsights.length > 0 && (
        <div className="border border-[color:var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3 flex items-center gap-2">
            <Zap size={14} className="text-[color:var(--primary)]" /> AI Investigation Guidance
          </h3>
          <div className="space-y-3">
            {aiInsights.map((ins, i) => {
              const framingTextColor = {
                process_issue:        "text-[color:var(--primary)]",
                needs_investigation:  "text-[color:var(--primary)]",
                monitor:              "text-[color:var(--text-soft)]",
              }[ins.framing] || "text-[color:var(--text-soft)]";
              return (
                <div key={i} className="p-3 border border-[color:var(--border)] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-[color:var(--text)]">{ins.username}</p>
                    <span className={`text-xs capitalize font-medium ${framingTextColor}`}>{ins.framing?.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)]">{ins.action}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Org Truth Map ──────────────────────────────────────────────────────

const ARCHETYPE_CFG = {
  cornerstone:           { color: "text-[color:var(--primary)] border-[color:var(--border)]",         icon: "⚓", desc: "Critical dependency — single point of failure risk" },
  multiplier:            { color: "text-[color:var(--primary)] border-[color:var(--border)]",         icon: "⚡", desc: "Amplifies the entire team's effectiveness" },
  invisible_contributor: { color: "text-[color:var(--primary)] border-[color:var(--border)]",      icon: "👁",  desc: "Significant value delivered without visibility" },
  bottleneck:            { color: "text-[color:var(--score-danger)] border-[color:var(--border)]",    icon: "🚧", desc: "Others wait on them — blocking team velocity" },
  solo_performer:        { color: "text-[color:var(--primary)] border-[color:var(--border)]",   icon: "🎯", desc: "High output, low collaboration" },
  orchestrator:          { color: "text-[color:var(--primary)] border-[color:var(--border)]",   icon: "🎻", desc: "Coordinates and delegates rather than executing" },
  contributor:           { color: "text-[color:var(--text-muted)] border-[color:var(--border)]",      icon: "👤", desc: "Standard contributor" },
};

function OrgTruthMap() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get("/intelligence/enterprise/org-truth-map")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SectionLoader />;
  if (error)   return <ErrorBox message={error} onRetry={load} />;
  if (!data)   return null;

  const { users, archetypeBreakdown, keyRisks, aiInsights } = data;

  return (
    <div className="space-y-6">
      {/* Key risk callouts */}
      {(keyRisks.cornerstones.length > 0 || keyRisks.bottlenecks.length > 0 || keyRisks.invisible.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {keyRisks.cornerstones.length > 0 && (
            <div className="border border-[color:var(--border)] rounded-lg p-3">
              <p className="text-xs font-semibold text-[color:var(--primary)] mb-1">⚓ Key-Person Risk</p>
              <p className="text-xs text-[color:var(--text)] font-medium">{keyRisks.cornerstones.join(", ")}</p>
              <p className="text-xs text-[color:var(--text-soft)] mt-1">Losing these people will severely disrupt operations.</p>
            </div>
          )}
          {keyRisks.invisible.length > 0 && (
            <div className="border border-[color:var(--border)] rounded-lg p-3">
              <p className="text-xs font-semibold text-[color:var(--primary)] mb-1">👁 Invisible Heroes</p>
              <p className="text-xs text-[color:var(--text)] font-medium">{keyRisks.invisible.join(", ")}</p>
              <p className="text-xs text-[color:var(--text-soft)] mt-1">Delivering above expectations without recognition.</p>
            </div>
          )}
          {keyRisks.bottlenecks.length > 0 && (
            <div className="border border-[color:var(--border)] rounded-lg p-3">
              <p className="text-xs font-semibold text-[color:var(--score-danger)] mb-1">🚧 Team Bottlenecks</p>
              <p className="text-xs text-[color:var(--text)] font-medium">{keyRisks.bottlenecks.join(", ")}</p>
              <p className="text-xs text-[color:var(--text-soft)] mt-1">Others are waiting on their tasks.</p>
            </div>
          )}
        </div>
      )}

      {/* Archetype summary */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {Object.entries(archetypeBreakdown).map(([key, count]) => {
          const cfg = ARCHETYPE_CFG[key] || ARCHETYPE_CFG.contributor;
          return (
            <div key={key} className={`rounded-lg p-2.5 text-center border ${cfg.color}`}>
              <p className="text-xl leading-none mb-1">{cfg.icon}</p>
              <p className="text-base font-bold text-[color:var(--text)]">{count}</p>
              <p className="text-xs text-[color:var(--text-soft)] leading-tight capitalize mt-0.5">{key.replace(/_/g, " ")}</p>
            </div>
          );
        })}
      </div>

      {/* Per-user breakdown */}
      <div className="space-y-2">
        {users.map((u) => {
          const cfg = ARCHETYPE_CFG[u.archetype] || ARCHETYPE_CFG.contributor;
          return (
            <CollapsibleUser
              key={u.userId}
              user={u}
              badge={
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-base font-bold text-[color:var(--primary)]">{u.valueScore}</span>
                    <p className="text-xs text-[color:var(--text-soft)] leading-none">value</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color}`}>
                    {cfg.icon} {u.archetypeLabel}
                  </span>
                </div>
              }
              detail={
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-[color:var(--text-soft)] italic">{cfg.desc}</p>
                  <div className="space-y-2">
                    {[
                      { label: "Output",        key: "output",        color: "indigo" },
                      { label: "Collaboration", key: "collaboration",  color: "green" },
                      { label: "Breadth",       key: "breadth",        color: "indigo" },
                      { label: "Leadership",    key: "leadership",     color: "yellow" },
                      { label: "Bottleneck",    key: "bottleneck",     color: "red" },
                    ].map((s) => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="text-xs text-[color:var(--text-soft)] w-24 shrink-0">{s.label}</span>
                        <ScoreBar value={u.scores[s.key]} color={s.color} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-[color:var(--text-muted)]">
                    <div><p className="font-medium text-[color:var(--text-soft)]">Tasks done</p><p>{u.metrics.tasksCompleted}</p></div>
                    <div><p className="font-medium text-[color:var(--text-soft)]">Projects</p><p>{u.metrics.projectsTouched}</p></div>
                    <div><p className="font-medium text-[color:var(--text-soft)]">Helped</p><p>{u.metrics.peopleHelped} people</p></div>
                    <div><p className="font-medium text-[color:var(--text-soft)]">Hidden load</p><p className={u.metrics.hiddenLoadPct > 40 ? "text-[color:var(--primary)]" : ""}>{u.metrics.hiddenLoadPct}% backlog</p></div>
                    <div><p className="font-medium text-[color:var(--text-soft)]">Comments on others</p><p>{u.metrics.commentsOnOthers}</p></div>
                    <div><p className="font-medium text-[color:var(--text-soft)]">Tasks created</p><p>{u.metrics.tasksCreated}</p></div>
                  </div>
                </div>
              }
            />
          );
        })}
      </div>

      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-[color:var(--text)] mb-3 flex items-center gap-2">
          <Zap size={14} className="text-[color:var(--primary)]" /> Strategic Recommendations
        </h3>
        <AIInsightCard insights={aiInsights} emptyMsg="Engage your team on more tasks to unlock org insights." />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "oracle", label: "Profitability Oracle", icon: TrendingUp,    desc: "Predict cost & risk before a project starts using historical patterns" },
  { id: "radar",  label: "Resignation Radar",    icon: AlertTriangle, desc: "60-day early warning for employee departures based on behavioural signals" },
  { id: "ghost",  label: "Ghost Work",           icon: Eye,           desc: "Detect inflated or fake productivity through attendance–output analysis" },
  { id: "orgmap", label: "Org Truth Map",        icon: Map,           desc: "Who actually drives your workspace — value scores, archetypes, hidden risks" },
];

export default function EnterpriseIntelligence() {
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    TABS.some((tab) => tab.id === searchParams.get("tab")) ? searchParams.get("tab") : "oracle"
  );

  if (auth?.user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-64 text-[color:var(--text-soft)]">
        <div className="text-center">
          <Shield size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Admin access required.</p>
        </div>
      </div>
    );
  }

  const currentTab = TABS.find((t) => t.id === activeTab);

  useEffect(() => {
    if (!TABS.some((tab) => tab.id === activeTab)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", activeTab);
      return next;
    }, { replace: true });
  }, [activeTab, setSearchParams]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Intelligence</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Workspace Intelligence</h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">AI-powered organisational analytics grounded in real operational data</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 border border-[color:var(--border)] rounded-lg">
        {TABS.map((tab) => (
          <TabBtn
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>

      {currentTab && (
        <p className="text-sm text-[color:var(--text-muted)] px-1">{currentTab.desc}</p>
      )}

      {/* Automatic load per tab — each mounts fresh and fetches on its own */}
      {activeTab === "oracle" && <ProfitabilityOracle />}
      {activeTab === "radar"  && <ResignationRadar />}
      {activeTab === "ghost"  && <GhostWorkDetection />}
      {activeTab === "orgmap" && <OrgTruthMap />}
    </div>
  );
}
