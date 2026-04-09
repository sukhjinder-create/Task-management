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
import { useApi } from "../api";
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
        ${active ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" />
      <span className="text-sm">Analysing data…</span>
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <AlertCircle size={32} className="mb-3 text-red-400" />
      <p className="text-sm mb-4">{message || "Failed to load data"}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Retry
        </button>
      )}
    </div>
  );
}

function RiskBadge({ level }) {
  const map = {
    critical: "bg-red-100 text-red-800 border border-red-200",
    high:     "bg-orange-100 text-orange-800 border border-orange-200",
    medium:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
    low:      "bg-green-100 text-green-700 border border-green-200",
    clean:    "bg-green-50 text-green-600 border border-green-100",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[level] || map.medium}`}>
      {level}
    </span>
  );
}

function ScoreBar({ value, max = 100, color = "indigo" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colors = { indigo: "bg-indigo-500", red: "bg-red-500", green: "bg-green-500", yellow: "bg-yellow-400", orange: "bg-orange-500" };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right">{value}</span>
    </div>
  );
}

function StatPill({ label, value, color = "gray" }) {
  const map = {
    gray:   "bg-gray-50 text-gray-600 border border-gray-100",
    red:    "bg-red-50 text-red-700 border border-red-100",
    green:  "bg-green-50 text-green-700 border border-green-100",
    yellow: "bg-yellow-50 text-yellow-700 border border-yellow-100",
  };
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${map[color]}`}>
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-xs mt-1 opacity-70">{label}</span>
    </div>
  );
}

function AIInsightCard({ insights, emptyMsg = "No AI insights available." }) {
  if (!insights || insights.length === 0) {
    return <p className="text-sm text-gray-400 italic">{emptyMsg}</p>;
  }
  const priorityColors = {
    high:               "border-red-300 bg-red-50",
    critical:           "border-red-400 bg-red-100",
    medium:             "border-yellow-300 bg-yellow-50",
    low:                "border-green-300 bg-green-50",
    immediate:          "border-red-400 bg-red-100",
    this_week:          "border-yellow-300 bg-yellow-50",
    this_month:         "border-green-300 bg-green-50",
    process_issue:      "border-blue-200 bg-blue-50",
    needs_investigation:"border-orange-300 bg-orange-50",
    monitor:            "border-gray-200 bg-gray-50",
  };
  return (
    <div className="space-y-3">
      {insights.map((ins, i) => {
        const key = ins.priority || ins.urgency || ins.impact || ins.framing || "medium";
        return (
          <div key={i} className={`border rounded-xl p-3 ${priorityColors[key] || "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-800">{ins.title || ins.username}</p>
              <span className="text-xs capitalize font-medium px-2 py-0.5 bg-white rounded-full border border-gray-200 text-gray-500">
                {key.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{ins.detail || ins.action}</p>
          </div>
        );
      })}
    </div>
  );
}

function CollapsibleUser({ user, badge, detail }) {
  const [open, setOpen] = useState(false);
  const avatarUrl = user.avatarUrl
    ? user.avatarUrl.startsWith("http") ? user.avatarUrl : `http://localhost:3000${user.avatarUrl}`
    : null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
              {user.username?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-800">{user.username}</p>
            <p className="text-xs text-gray-400 capitalize">{user.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">{detail}</div>}
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
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
        <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
          <BarChart2 size={14} /> Workspace Calibration (Completed Projects)
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
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <FolderOpen size={14} /> Project Risk Analysis ({projects.length})
        </h3>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No project data yet. Create tasks across projects to unlock analysis.</p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.projectId} className="bg-white border border-gray-100 rounded-xl p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">{p.projectName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-gray-50 text-gray-500 border border-gray-100"}`}>
                        {p.isActive ? "Active" : "Completed"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{p.teamSize} members · {p.totalTasks} tasks</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className={`text-sm font-bold ${p.profitScore >= 70 ? "text-green-600" : p.profitScore >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                        {p.profitScore}
                      </span>
                      <p className="text-xs text-gray-400">health score</p>
                    </div>
                    <RiskBadge level={p.riskLevel} />
                  </div>
                </div>

                {/* Active project metrics */}
                {p.isActive && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                    <div>
                      <p className={`font-semibold ${p.netVelocity < 0 ? "text-red-600" : "text-green-600"}`}>
                        {p.netVelocity > 0 ? "+" : ""}{p.netVelocity}/wk
                      </p>
                      <p className="text-gray-400">Net velocity</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700">{p.burnRatePerWeek}/wk</p>
                      <p className="text-gray-400">Burn rate</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.growthRatePerWeek > p.burnRatePerWeek ? "text-orange-600" : "text-gray-700"}`}>
                        {p.growthRatePerWeek}/wk
                      </p>
                      <p className="text-gray-400">Backlog growth</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.projectedWeeks > 12 ? "text-red-600" : "text-gray-700"}`}>
                        {p.projectedWeeks != null ? `~${p.projectedWeeks}wk` : "—"}
                      </p>
                      <p className="text-gray-400">Est. to complete</p>
                    </div>
                  </div>
                )}

                {/* Completed project metrics */}
                {!p.isActive && (
                  <div className="grid grid-cols-3 gap-3 text-xs mb-2">
                    <div>
                      <p className="font-semibold text-gray-700">{p.completionRate}%</p>
                      <p className="text-gray-400">Completion</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.taskGrowthPct > 50 ? "text-orange-600" : "text-gray-700"}`}>
                        {p.taskGrowthPct != null ? `+${p.taskGrowthPct}%` : "—"}
                      </p>
                      <p className="text-gray-400">Task growth</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${p.delayRate > 30 ? "text-red-600" : "text-gray-700"}`}>{p.delayRate}%</p>
                      <p className="text-gray-400">Delay rate</p>
                    </div>
                  </div>
                )}

                {/* Risk signals */}
                {p.riskSignals && p.riskSignals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.riskSignals.map((s, i) => (
                      <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-100 rounded-full px-2 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Duration for completed projects */}
                {!p.isActive && p.durationDays != null && (
                  <p className="text-xs text-gray-400 mt-2">
                    <Clock size={10} className="inline mr-1" />{p.durationDays} days total duration
                  </p>
                )}

                {/* Velocity trend for active projects */}
                {p.isActive && p.velocityTrend != null && p.velocityTrend !== 0 && (
                  <p className={`text-xs mt-2 ${p.velocityTrend > 0 ? "text-green-600" : "text-orange-600"}`}>
                    <Activity size={10} className="inline mr-1" />
                    Burn rate {p.velocityTrend > 0 ? "up" : "down"} {Math.abs(p.velocityTrend)}% vs last month
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Zap size={14} className="text-indigo-500" /> AI Strategic Insights
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
        {users.length === 0 && <p className="text-sm text-gray-400 italic">No users to analyse.</p>}
        {users.map((u) => (
          <CollapsibleUser
            key={u.userId}
            user={u}
            badge={
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={`text-base font-bold ${u.riskScore >= 55 ? "text-red-600" : u.riskScore >= 35 ? "text-orange-600" : u.riskScore >= 20 ? "text-yellow-600" : "text-green-600"}`}>
                    {u.riskScore}
                  </span>
                  <p className="text-xs text-gray-400 leading-none">risk</p>
                </div>
                <RiskBadge level={u.riskLevel} />
              </div>
            }
            detail={
              <div className="space-y-3 pt-1">
                {u.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {u.signals.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-100">{s}</span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Task Completions</p>
                    <p>Last 30d: <span className="font-semibold">{u.metrics.recentTaskCompletions}</span></p>
                    <p>Prev 30d: <span className="font-semibold">{u.metrics.prevTaskCompletions}</span></p>
                    {u.metrics.taskDrop > 0 && <p className="text-red-600">↓ {u.metrics.taskDrop}% drop</p>}
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Attendance (avg min/day)</p>
                    <p>Last 30d: <span className="font-semibold">{u.metrics.recentAttendanceMinutes}</span></p>
                    <p>Prev 30d: <span className="font-semibold">{u.metrics.prevAttendanceMinutes}</span></p>
                    {u.metrics.attendanceDrop > 0 && <p className="text-red-600">↓ {u.metrics.attendanceDrop}% drop</p>}
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Comments</p>
                    <p>Last 30d: <span className="font-semibold">{u.metrics.recentComments}</span></p>
                    <p>Prev 30d: <span className="font-semibold">{u.metrics.prevComments}</span></p>
                    {u.metrics.commentDrop > 0 && <p className="text-red-600">↓ {u.metrics.commentDrop}%</p>}
                  </div>
                  <div>
                    <p className="font-medium text-gray-600 mb-1">Activity</p>
                    <p className={u.metrics.daysSilent >= 7 ? "text-red-600 font-semibold" : ""}>
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
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Zap size={14} className="text-indigo-500" /> AI Retention Recommendations
          </h3>
          <div className="space-y-3">
            {aiInsights.map((ins, i) => (
              <div key={i} className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{ins.username}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{ins.action}</p>
                  <span className="text-xs capitalize font-medium text-amber-700">{ins.urgency?.replace(/_/g, " ")}</span>
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

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex flex-wrap gap-6 text-xs text-blue-700">
        <span><strong>Workspace avg attendance:</strong> {workspaceBenchmarks.avgAttendanceMinutes} min/day</span>
        <span><strong>Workspace avg completions:</strong> {workspaceBenchmarks.avgMonthlyCompletions} tasks/mo</span>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <CollapsibleUser
            key={u.userId}
            user={u}
            badge={
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={`text-base font-bold ${u.ghostScore >= 55 ? "text-red-600" : u.ghostScore >= 35 ? "text-orange-600" : u.ghostScore >= 15 ? "text-yellow-600" : "text-green-600"}`}>
                    {u.ghostScore}
                  </span>
                  <p className="text-xs text-gray-400 leading-none">score</p>
                </div>
                <RiskBadge level={u.riskLevel} />
              </div>
            }
            detail={
              <div className="space-y-3 pt-1">
                {u.flags.length > 0 ? (
                  <div className="space-y-2">
                    {u.flags.map((f, i) => (
                      <div key={i} className={`p-2.5 rounded-lg border text-xs ${f.severity === "high" ? "bg-red-50 border-red-100 text-red-800" : "bg-yellow-50 border-yellow-100 text-yellow-800"}`}>
                        <p className="font-semibold">{f.label}</p>
                        <p className="opacity-80 mt-0.5">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> No anomalies detected</p>
                )}
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <div><p className="font-medium">Attendance</p><p>{u.metrics.avgAttendanceMinutes} min/day</p></div>
                  <div><p className="font-medium">Completions</p><p>{u.metrics.taskCompletions} tasks</p></div>
                  <div><p className="font-medium">Max burst</p><p>{u.metrics.maxHourlyBurst} actions/hr</p></div>
                  <div><p className="font-medium">Total assigned</p><p>{u.metrics.totalAssigned}</p></div>
                  <div><p className="font-medium">Reopened</p><p>{u.metrics.reopenedTasks}</p></div>
                </div>
              </div>
            }
          />
        ))}
      </div>

      {aiInsights && aiInsights.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Zap size={14} className="text-indigo-500" /> AI Investigation Guidance
          </h3>
          <div className="space-y-3">
            {aiInsights.map((ins, i) => {
              const framingColor = {
                process_issue:        "bg-blue-50 border-blue-100",
                needs_investigation:  "bg-orange-50 border-orange-100",
                monitor:              "bg-gray-50 border-gray-100",
              }[ins.framing] || "bg-gray-50 border-gray-100";
              return (
                <div key={i} className={`p-3 border rounded-xl ${framingColor}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-gray-800">{ins.username}</p>
                    <span className="text-xs capitalize text-gray-500 font-medium">{ins.framing?.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-gray-600">{ins.action}</p>
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
  cornerstone:           { color: "bg-purple-100 text-purple-800 border-purple-200", icon: "⚓", desc: "Critical dependency — single point of failure risk" },
  multiplier:            { color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "⚡", desc: "Amplifies the entire team's effectiveness" },
  invisible_contributor: { color: "bg-teal-100 text-teal-800 border-teal-200",       icon: "👁",  desc: "Significant value delivered without visibility" },
  bottleneck:            { color: "bg-red-100 text-red-800 border-red-200",           icon: "🚧", desc: "Others wait on them — blocking team velocity" },
  solo_performer:        { color: "bg-orange-100 text-orange-800 border-orange-200",  icon: "🎯", desc: "High output, low collaboration" },
  orchestrator:          { color: "bg-yellow-100 text-yellow-800 border-yellow-200",  icon: "🎻", desc: "Coordinates and delegates rather than executing" },
  contributor:           { color: "bg-gray-100 text-gray-700 border-gray-200",        icon: "👤", desc: "Standard contributor" },
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
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-purple-800 mb-1">⚓ Key-Person Risk</p>
              <p className="text-xs text-purple-700 font-medium">{keyRisks.cornerstones.join(", ")}</p>
              <p className="text-xs text-purple-500 mt-1">Losing these people will severely disrupt operations.</p>
            </div>
          )}
          {keyRisks.invisible.length > 0 && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-teal-800 mb-1">👁 Invisible Heroes</p>
              <p className="text-xs text-teal-700 font-medium">{keyRisks.invisible.join(", ")}</p>
              <p className="text-xs text-teal-500 mt-1">Delivering above expectations without recognition.</p>
            </div>
          )}
          {keyRisks.bottlenecks.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-800 mb-1">🚧 Team Bottlenecks</p>
              <p className="text-xs text-red-700 font-medium">{keyRisks.bottlenecks.join(", ")}</p>
              <p className="text-xs text-red-500 mt-1">Others are waiting on their tasks.</p>
            </div>
          )}
        </div>
      )}

      {/* Archetype summary */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {Object.entries(archetypeBreakdown).map(([key, count]) => {
          const cfg = ARCHETYPE_CFG[key] || ARCHETYPE_CFG.contributor;
          return (
            <div key={key} className={`rounded-xl p-2.5 text-center border ${cfg.color}`}>
              <p className="text-xl leading-none mb-1">{cfg.icon}</p>
              <p className="text-base font-bold">{count}</p>
              <p className="text-xs opacity-70 leading-tight capitalize mt-0.5">{key.replace(/_/g, " ")}</p>
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
                    <span className="text-base font-bold text-indigo-700">{u.valueScore}</span>
                    <p className="text-xs text-gray-400 leading-none">value</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color}`}>
                    {cfg.icon} {u.archetypeLabel}
                  </span>
                </div>
              }
              detail={
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-gray-500 italic">{cfg.desc}</p>
                  <div className="space-y-2">
                    {[
                      { label: "Output",        key: "output",        color: "indigo" },
                      { label: "Collaboration", key: "collaboration",  color: "green" },
                      { label: "Breadth",       key: "breadth",        color: "indigo" },
                      { label: "Leadership",    key: "leadership",     color: "yellow" },
                      { label: "Bottleneck",    key: "bottleneck",     color: "red" },
                    ].map((s) => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24 shrink-0">{s.label}</span>
                        <ScoreBar value={u.scores[s.key]} color={s.color} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div><p className="font-medium">Tasks done</p><p>{u.metrics.tasksCompleted}</p></div>
                    <div><p className="font-medium">Projects</p><p>{u.metrics.projectsTouched}</p></div>
                    <div><p className="font-medium">Helped</p><p>{u.metrics.peopleHelped} people</p></div>
                    <div><p className="font-medium">Hidden load</p><p className={u.metrics.hiddenLoadPct > 40 ? "text-orange-600" : ""}>{u.metrics.hiddenLoadPct}% backlog</p></div>
                    <div><p className="font-medium">Comments on others</p><p>{u.metrics.commentsOnOthers}</p></div>
                    <div><p className="font-medium">Tasks created</p><p>{u.metrics.tasksCreated}</p></div>
                  </div>
                </div>
              }
            />
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Zap size={14} className="text-indigo-500" /> Strategic Recommendations
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
      <div className="flex items-center justify-center min-h-64 text-gray-400">
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
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
          <Brain size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workspace Intelligence</h1>
          <p className="text-xs text-gray-400">AI-powered organisational analytics grounded in real operational data</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5 p-1.5 bg-gray-50 rounded-xl border border-gray-100">
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
        <p className="text-sm text-gray-500 mb-5 px-1">{currentTab.desc}</p>
      )}

      {/* Automatic load per tab — each mounts fresh and fetches on its own */}
      {activeTab === "oracle" && <ProfitabilityOracle />}
      {activeTab === "radar"  && <ResignationRadar />}
      {activeTab === "ghost"  && <GhostWorkDetection />}
      {activeTab === "orgmap" && <OrgTruthMap />}
    </div>
  );
}
