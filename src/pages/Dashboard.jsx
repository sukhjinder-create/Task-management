import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getAdminInsights } from "../services/intelligence.api";
import { getSocket } from "../socket";
import { Card, Badge, Button, Skeleton } from "../components/ui";

function isTaskOverdue(task) {
  if (!task.due_date) return false;
  if (task.status === "completed") return false;
  const due = new Date(task.due_date);
  const today = new Date();
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return dueDateOnly < todayOnly;
}

export default function Dashboard() {
  const api = useApi();
  const { auth } = useAuth();
  const role = auth.user.role;

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isUser = role === "user";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]); // [{ project, tasks }]
  const [intelligence, setIntelligence] = useState(null);
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [myPerformance, setMyPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceTrend, setPerformanceTrend] = useState([]);
  const [projectPerformance, setProjectPerformance] = useState([]);
  const [forecastReasoningOpen, setForecastReasoningOpen] = useState(false);
  const [healthScore, setHealthScore] = useState(null);
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [executiveDetail, setExecutiveDetail] = useState(null);
  const [executiveDetailLoading, setExecutiveDetailLoading] = useState(false);
  const [executiveDetailOpen, setExecutiveDetailOpen] = useState(false);
  const [executiveModalView, setExecutiveModalView] = useState("summary");

async function openExecutiveDetail(view = "summary") {
  try {
    setExecutiveDetailLoading(true);
    setExecutiveModalView(view);
    setExecutiveDetailOpen(true);
    const res = await api.get("/dashboard/executive-detail");
    setExecutiveDetail(res.data);
  } catch (err) {
    toast.error(err?.response?.data?.error || "Failed to load executive detail");
    setExecutiveDetailOpen(false);
  } finally {
    setExecutiveDetailLoading(false);
  }
}

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      let overview = null;
      try {
        const overviewRes = await api.get("/dashboard/overview");
        overview = overviewRes.data;
        setDashboardOverview(overview);
        if (typeof overview?.healthScore === "number") {
          setHealthScore(overview.healthScore);
        }
      } catch (err) {
        console.warn("Dashboard overview not available yet");
      }
      // 🔥 Load workspace health (initial value)
// ✅ Load workspace health baseline
try {
  const healthRes = await api.get("/intelligence/workspace/health");
  setHealthScore(healthRes.data.healthScore);
} catch (err) {
  console.warn("Health not available yet");
}

      // Fetch performance trend (last 3 months)
try {
  const trendRes = await api.get("/intelligence/user/trend");
  setPerformanceTrend(trendRes.data || []);
} catch (err) {
  console.warn("Trend not available");
}

// Fetch project-wise performance
try {
  const projectPerfRes = await api.get("/intelligence/user/project-performance");
  setProjectPerformance(projectPerfRes.data || []);
} catch (err) {
  console.warn("Project performance not available");
}
      // Reflective summary for dashboard card
if (overview?.executiveSummary) {
  setExecutiveSummary({
    status: "ready",
    headline: overview.executiveSummary.headline || "",
    text: overview.executiveSummary.narrative || "",
    reasoning: null,
  });
}

// Fetch my monthly performance
try {
  setPerformanceLoading(true);
  const month = new Date().toISOString().slice(0, 7);
  const perfRes = await api.get(
    `/intelligence/user/performance?month=${month}`
  );
  setMyPerformance(perfRes.data || null);
} catch (err) {
  console.warn("Performance not available yet");
} finally {
  setPerformanceLoading(false);
}
      try {
        const projectsRes = await api.get("/projects");
        let proj = projectsRes.data || [];
        const scopedProjectIds = overview?.scope?.projectIds || [];
        if (role !== "admin") {
          if (scopedProjectIds.length === 0) {
            proj = [];
          } else {
            const allowed = new Set(scopedProjectIds.map(String));
            proj = proj.filter((p) => allowed.has(String(p.id)));
          }
        }
        setProjects(proj);

        const allProjectTasks = [];

        for (const p of proj) {
          try {
            const tasksRes = await api.get(`/tasks/${p.id}`);
            const tasks = tasksRes.data || [];
            allProjectTasks.push({ project: p, tasks });
          } catch (err) {
            console.error("Failed to load tasks for project", p.id, err);
          }
        }

        setProjectTasks(allProjectTasks);
        // 🔥 Load intelligence (admin only)
if (isAdmin) {
  try {
    setIntelligenceLoading(true);

    const month = new Date().toISOString().slice(0, 7);

    const insightsRes = await getAdminInsights(month);

    setIntelligence(insightsRes.data);
  } catch (err) {
    console.error("Failed to load intelligence", err);
  } finally {
    setIntelligenceLoading(false);
  }
}
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to load dashboard data";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
  const socket = getSocket();
  if (!socket) return;

  const subscribe = () => {
    console.log("✅ Subscribing to workspace realtime");
    socket.emit("workspace:subscribe");
  };

  // ✅ wait until socket is actually connected
  if (socket.connected) {
    subscribe();
  } else {
    socket.once("connect", subscribe);
  }

  const onPulse = (data) => {
    console.log("🔥 HEALTH PULSE RECEIVED", data);
  const healthValue = Number(data?.health);

  if (Number.isNaN(healthValue)) return;

  setHealthScore(Math.max(0, Math.min(100, healthValue)));
};

  socket.on("workspace:health-pulse", onPulse);

  return () => {
    socket.off("workspace:health-pulse", onPulse);
    socket.off("connect", subscribe);
  };
}, []);

  /* ======================================
   LIVE INTELLIGENCE UPDATES
====================================== */

useEffect(() => {
  const socket = getSocket();
  if (!socket) return;

  const handleIntelligenceUpdate = async () => {
    try {
      console.log("🧠 Intelligence update received");

      // reload only intelligence — NOT whole dashboard
      const month = new Date().toISOString().slice(0, 7);

      // refresh performance
      const perfRes = await api.get(
        `/intelligence/user/performance?month=${month}`
      );
      setMyPerformance(perfRes.data);

      // refresh admin insights if admin
      if (isAdmin) {
        const insightsRes = await getAdminInsights(month);
        setIntelligence(insightsRes.data);
      }

      const overviewRes = await api.get("/dashboard/overview");
      setDashboardOverview(overviewRes.data);

    } catch (err) {
      console.warn("Live intelligence refresh failed");
    }
  };

  socket.on("workspace:intelligence-updated", handleIntelligenceUpdate);

  return () => {
    socket.off(
      "workspace:intelligence-updated",
      handleIntelligenceUpdate
    );
  };
}, [api, isAdmin]);

  // Flatten tasks with project reference
  const flatTasks = useMemo(() => {
    const list = [];
    projectTasks.forEach(({ project, tasks }) => {
      tasks.forEach((t) => {
        list.push({ ...t, _project: project });
      });
    });
    return list;
  }, [projectTasks]);

  // For admins/managers – global stats; for users – only their tasks
  const tasksForStats = useMemo(() => {
    if (isUser) {
      return flatTasks.filter((t) => t.assigned_to === auth.user.id);
    }
    return flatTasks;
  }, [flatTasks, isUser, auth.user.id]);

  const totalProjects = dashboardOverview?.counts?.totalProjects ?? projects.length;
  const totalTasks = dashboardOverview?.counts?.totalTasks ?? tasksForStats.length;
  const pendingCount =
    dashboardOverview?.counts?.pendingTasks ??
    tasksForStats.filter((t) => t.status === "pending").length;
  const inProgressCount =
    dashboardOverview?.counts?.inProgressTasks ??
    tasksForStats.filter((t) => t.status === "in-progress").length;
  const completedCount =
    dashboardOverview?.counts?.completedTasks ??
    tasksForStats.filter((t) => t.status === "completed").length;
  const overdueCount =
    dashboardOverview?.counts?.overdueTasks ??
    tasksForStats.filter((t) => isTaskOverdue(t)).length;


/* ======================================
   AUTONOMOUS AI INSIGHT ENGINE
====================================== */

const autonomousInsight = useMemo(() => {
  const risk = myPerformance?.intelligence?.risk?.level;
  const overdue = overdueCount;
  const trend = intelligence?.forecast?.trend;
  const inProgress = inProgressCount;
  const completed = completedCount;
  const total = totalTasks;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;

  // Critical: high risk + many overdue
  if (risk === "High" && overdue > 3) {
    return {
      type: "critical",
      headline: "Execution Risk Detected",
      message: `${overdue} overdue task${overdue !== 1 ? "s" : ""} are accumulating with a High risk profile. ${inProgress} task${inProgress !== 1 ? "s" : ""} currently in progress. Immediate attention needed to prevent further delays.`,
      stats: [
        { label: "Overdue", value: overdue, color: "text-red-600" },
        { label: "In Progress", value: inProgress, color: "text-orange-500" },
        { label: "Completion Rate", value: `${completionRate}%`, color: "text-gray-600" },
      ],
    };
  }

  // Warning: any overdue tasks
  if (overdue > 0) {
    return {
      type: "warning",
      headline: "Overdue Tasks Need Attention",
      message: `${overdue} task${overdue !== 1 ? "s are" : " is"} past due (${overdueRate}% of total workload). ${inProgress} task${inProgress !== 1 ? "s are" : " is"} actively in progress. Address blockers to restore delivery momentum.`,
      stats: [
        { label: "Overdue", value: overdue, color: "text-amber-600" },
        { label: "In Progress", value: inProgress, color: "text-blue-600" },
        { label: "Completion Rate", value: `${completionRate}%`, color: "text-gray-600" },
      ],
    };
  }

  // Declining trend
  if (trend === "declining") {
    return {
      type: "warning",
      headline: "Performance Momentum Declining",
      message: `Completion velocity is trending downward. ${completed} task${completed !== 1 ? "s" : ""} completed so far with ${inProgress} currently in progress. Early intervention recommended.`,
      stats: [
        { label: "Completed", value: completed, color: "text-green-600" },
        { label: "In Progress", value: inProgress, color: "text-blue-600" },
        { label: "Trend", value: "↓ Declining", color: "text-amber-600" },
      ],
    };
  }

  // Positive: improving trend, no overdue
  if ((trend === "improving" || completionRate > 60) && overdue === 0) {
    return {
      type: "positive",
      headline: "Strong Execution Momentum",
      message: `${completed} task${completed !== 1 ? "s" : ""} completed with ${overdue} overdue — execution is on track. ${inProgress} task${inProgress !== 1 ? "s" : ""} actively progressing.`,
      stats: [
        { label: "Completed", value: completed, color: "text-green-600" },
        { label: "In Progress", value: inProgress, color: "text-blue-600" },
        { label: "Completion Rate", value: `${completionRate}%`, color: "text-green-600" },
      ],
    };
  }

  // Neutral fallback — still show real numbers
  return {
    type: "neutral",
    headline: "Workspace Status Normal",
    message: `${total} total task${total !== 1 ? "s" : ""} across ${totalProjects} project${totalProjects !== 1 ? "s" : ""}. ${inProgress} in progress, ${completed} completed, ${overdue} overdue.`,
    stats: [
      { label: "Total Tasks", value: total, color: "text-gray-700" },
      { label: "In Progress", value: inProgress, color: "text-blue-600" },
      { label: "Completed", value: completed, color: "text-green-600" },
    ],
  };
}, [myPerformance, overdueCount, intelligence, inProgressCount, completedCount, totalTasks, totalProjects]);

  // My tasks subset (for admin/manager too)
  const myTasks = useMemo(
    () => flatTasks.filter((t) => t.assigned_to === auth.user.id),
    [flatTasks, auth.user.id]
  );
  const myOverdueTasks = myTasks.filter((t) => isTaskOverdue(t));

  // Top overdue tasks list (scope-safe from dashboard overview when available)
  const topOverdue = useMemo(() => {
    if (Array.isArray(dashboardOverview?.topOverdue)) {
      return dashboardOverview.topOverdue;
    }
    const arr = tasksForStats.filter((t) => isTaskOverdue(t));
    // sort by due_date ascending
    arr.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return arr.slice(0, 5);
  }, [tasksForStats, dashboardOverview]);

  function getRiskLevel(score) {
  if (score >= 75) return { label: "Low Risk", color: "text-emerald-600" };
  if (score >= 50) return { label: "Medium Risk", color: "text-amber-600" };
  return { label: "High Risk", color: "text-red-600" };
}
  return (
  <div className="space-y-6 px-4 py-4 md:px-0 md:py-0">

{/* ======================================
   AUTONOMOUS AI INSIGHT CARD
====================================== */}

{autonomousInsight && (
  <div className={`rounded-xl border p-4 ${
    autonomousInsight.type === "critical" ? "bg-red-50 border-red-200" :
    autonomousInsight.type === "warning"  ? "bg-amber-50 border-amber-200" :
    autonomousInsight.type === "positive" ? "bg-emerald-50 border-emerald-200" :
    "bg-blue-50 border-blue-100"
  }`}>
    <div className="flex items-start gap-3">
      <div className="text-xl mt-0.5">
        {autonomousInsight.type === "critical" && "🔴"}
        {autonomousInsight.type === "warning"  && "⚠️"}
        {autonomousInsight.type === "positive" && "✅"}
        {autonomousInsight.type === "neutral"  && "🧠"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            autonomousInsight.type === "critical" ? "bg-red-100 text-red-700" :
            autonomousInsight.type === "warning"  ? "bg-amber-100 text-amber-700" :
            autonomousInsight.type === "positive" ? "bg-emerald-100 text-emerald-700" :
            "bg-blue-100 text-blue-700"
          }`}>AI Insight</span>
          <span className="text-sm font-semibold theme-text">{autonomousInsight.headline}</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">{autonomousInsight.message}</p>
        {autonomousInsight.stats && (
          <div className="flex gap-4 flex-wrap">
            {autonomousInsight.stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}

      {/* ======================================
   WORKSPACE CONTROL CENTER — AI ATTENTION
====================================== */}

{(isAdmin || isManager || isUser) && (
  <Card className="theme-surface-strong theme-text border theme-border">
    <Card.Content>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Workspace Overview</h2>
        <span className="text-xs text-gray-400">Live</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Overdue */}
        <div className={`rounded-lg p-4 border ${overdueCount > 5 ? "bg-red-50 border-red-200" : overdueCount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-100"}`}>
          <div className="text-xs font-medium text-gray-500 mb-1">Overdue Tasks</div>
          <div className={`text-2xl font-bold ${overdueCount > 5 ? "text-red-600" : overdueCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {overdueCount}
          </div>
          <div className={`text-xs mt-1 font-semibold ${overdueCount > 5 ? "text-red-500" : overdueCount > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            {overdueCount > 5 ? "⚠ High pressure" : overdueCount > 0 ? "Needs attention" : "✓ All on track"}
          </div>
        </div>

        {/* In Progress */}
        <div className="rounded-lg p-4 border bg-blue-50 border-blue-100">
          <div className="text-xs font-medium text-gray-500 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
          <div className="text-xs mt-1 text-blue-500 font-semibold">
            of {totalTasks} total tasks
          </div>
        </div>

        {/* Completed */}
        <div className="rounded-lg p-4 border bg-emerald-50 border-emerald-100">
          <div className="text-xs font-medium text-gray-500 mb-1">Completed</div>
          <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
          <div className="text-xs mt-1 text-emerald-500 font-semibold">
            {totalTasks > 0 ? `${Math.round((completedCount / totalTasks) * 100)}% completion rate` : "No tasks yet"}
          </div>
        </div>

        {/* Risk / Trend */}
        <div className={`rounded-lg p-4 border ${
          myPerformance?.intelligence?.risk?.level === "High" ? "bg-red-50 border-red-200" :
          myPerformance?.intelligence?.risk?.level === "Medium" ? "bg-amber-50 border-amber-200" :
          "bg-gray-50 border-gray-200"
        }`}>
          <div className="text-xs font-medium text-gray-500 mb-1">Risk Level</div>
          <div className={`text-2xl font-bold ${
            myPerformance?.intelligence?.risk?.level === "High" ? "text-red-600" :
            myPerformance?.intelligence?.risk?.level === "Medium" ? "text-amber-600" :
            "text-gray-600"
          }`}>
            {myPerformance?.intelligence?.risk?.level || "—"}
          </div>
          <div className="text-xs mt-1 text-gray-500 font-semibold capitalize">
            {intelligence?.forecast?.trend ? `Trend: ${intelligence.forecast.trend}` : `${totalProjects} project${totalProjects !== 1 ? "s" : ""} active`}
          </div>
        </div>
      </div>
    </Card.Content>
  </Card>
)}

{/* ================================
    EXECUTIVE INTELLIGENCE SUMMARY
================================ */}
{false && isAdmin && dashboardOverview?.executiveSummary && (
  <Card className="bg-gradient-to-r from-primary-600 to-primary-700 text-white border-primary-500">
    <Card.Content>
      <h2 className="text-lg font-semibold mb-3">
        Executive Intelligence Insight
      </h2>

      <div className="text-sm font-semibold opacity-95">
        {dashboardOverview.executiveSummary.headline}
        
          🧠 AI is analyzing organizational performance...
        
      </div>

      {dashboardOverview?.executiveSummary && (
        <>
          <div className="text-sm leading-relaxed whitespace-pre-wrap mt-2 line-clamp-3">
            {dashboardOverview.executiveSummary.narrative}
          </div>

          <Button
            onClick={openExecutiveDetail}
            size="sm"
            variant="ghost"
            className="mt-4 text-white hover:bg-white/10"
          >
            Read full executive summary & reasoning
          </Button>
        </>
      )}
    </Card.Content>
  </Card>
)}

{isAdmin && dashboardOverview?.executiveSummary && (
  <Card className="bg-gradient-to-r from-primary-600 to-primary-700 text-white border-primary-500">
    <Card.Content>
      <h2 className="text-lg font-semibold mb-3">
        Executive Intelligence Insight
      </h2>
      <div className="text-sm font-semibold opacity-95">
        {dashboardOverview.executiveSummary.headline}
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap mt-2 line-clamp-3">
        {dashboardOverview.executiveSummary.narrative}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => openExecutiveDetail("summary")}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10"
        >
          Read Full Summary
        </Button>
        <Button
          onClick={() => openExecutiveDetail("reasoning")}
          size="sm"
          variant="ghost"
          className="text-white hover:bg-white/10"
        >
          View Reasoning
        </Button>
      </div>
    </Card.Content>
  </Card>
)}

{/* ================================
    MY PERFORMANCE SNAPSHOT
================================ */}
{myPerformance && (() => {
  const score = myPerformance.score ?? 0;
  const risk = myPerformance.intelligence?.risk;
  const dims = myPerformance.intelligence?.dimensions || {};
  const signals = myPerformance.intelligence?.signals || [];
  const coaching = Array.isArray(myPerformance.coaching) ? myPerformance.coaching : [];
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  // Real task counts for current user
  const myTotal = myTasks.length;
  const myCompleted = myTasks.filter(t => t.status === "completed").length;
  const myInProgress = myTasks.filter(t => t.status === "in_progress" || t.status === "in-progress").length;
  const myOverdue = myOverdueTasks.length;
  const myCompletionRate = myTotal > 0 ? Math.round((myCompleted / myTotal) * 100) : 0;

  // Trend delta
  const prevScore = performanceTrend.length >= 2 ? performanceTrend[performanceTrend.length - 2]?.score : null;
  const delta = prevScore != null ? score - prevScore : null;

  // Dimension meta
  const dimMeta = {
    executionDiscipline: { label: "Execution Discipline", good: "high", icon: "⚡" },
    timelinessIndex:     { label: "Timeliness",           good: "high", icon: "⏱" },
    workloadStress:      { label: "Workload Stress",       good: "low",  icon: "🔥" },
    velocityScore:       { label: "Task Velocity",         good: "high", icon: "🚀" },
  };

  const getDimColor = (key, value) => {
    const isGoodHigh = dimMeta[key]?.good === "high";
    if (isGoodHigh) return value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-400" : "bg-red-400";
    // good = low (workload stress)
    return value <= 40 ? "bg-emerald-500" : value <= 70 ? "bg-amber-400" : "bg-red-400";
  };

  const getDimTextColor = (key, value) => {
    const isGoodHigh = dimMeta[key]?.good === "high";
    if (isGoodHigh) return value >= 70 ? "text-emerald-600" : value >= 40 ? "text-amber-600" : "text-red-600";
    return value <= 40 ? "text-emerald-600" : value <= 70 ? "text-amber-600" : "text-red-600";
  };

  return (
  <Card>
    <Card.Content className="space-y-5">

      {/* HEADER ROW */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">My Performance</div>
          <div className="text-lg font-bold theme-text">{monthLabel}</div>
          {myPerformance.explanation && (
            <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">{myPerformance.explanation}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-4xl font-bold ${score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-500" : "text-red-500"}`}>
            {score}
            <span className="text-base font-normal text-gray-400">/100</span>
          </div>
          {delta != null && (
            <div className={`text-xs font-semibold mt-0.5 ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs last month
            </div>
          )}
          <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block ${
            risk?.level === "High" ? "bg-red-100 text-red-700" :
            risk?.level === "Medium" ? "bg-amber-100 text-amber-700" :
            "bg-emerald-100 text-emerald-700"
          }`}>
            {risk?.level || "—"} Risk
          </div>
        </div>
      </div>

      {/* SCORE BAR */}
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>

      {/* MY TASK STATS */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "My Tasks", value: myTotal, color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
          { label: "Completed", value: myCompleted, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "In Progress", value: myInProgress, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Overdue", value: myOverdue, color: myOverdue > 0 ? "text-red-600" : "text-gray-400", bg: myOverdue > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg border p-3 text-center ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* COMPLETION RATE BAR */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 w-28 shrink-0">Completion rate</span>
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div className="bg-emerald-500 h-2 rounded-full transition-all duration-700" style={{ width: `${myCompletionRate}%` }} />
        </div>
        <span className="text-xs font-bold text-emerald-600 w-8 text-right">{myCompletionRate}%</span>
      </div>

      {/* BEHAVIORAL DIMENSIONS */}
      {Object.keys(dims).length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Behavioral Profile</div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(dims).map(([key, value]) => {
              const meta = dimMeta[key] || { label: key.replace(/([A-Z])/g, " $1"), icon: "•" };
              const barColor = getDimColor(key, value);
              const textColor = getDimTextColor(key, value);
              return (
                <div key={key} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{meta.icon}</span>
                      <span className="text-xs text-gray-600 font-medium">{meta.label}</span>
                    </div>
                    <span className={`text-sm font-bold ${textColor}`}>{Math.round(value)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className={`${barColor} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RISK + SIGNALS */}
      {risk && (
        <div className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
          risk.level === "High" ? "bg-red-50 border-red-200" :
          risk.level === "Medium" ? "bg-amber-50 border-amber-200" :
          "bg-emerald-50 border-emerald-200"
        }`}>
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Performance Risk</div>
            <div className={`text-2xl font-bold ${risk.level === "High" ? "text-red-600" : risk.level === "Medium" ? "text-amber-600" : "text-emerald-600"}`}>
              {Math.round(risk.probability)}%
            </div>
            <div className="text-xs text-gray-500 mt-0.5">probability of underperformance</div>
          </div>
          {signals.length > 0 && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Active Signals</div>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((s, i) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    risk.level === "High" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TREND */}
      {performanceTrend.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Score Trend</div>
          <div className="flex items-end gap-2">
            {performanceTrend.map((item, idx) => {
              const h = Math.max(8, Math.round((item.score / 100) * 48));
              const isLatest = idx === performanceTrend.length - 1;
              return (
                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] font-bold text-gray-600">{item.score}</span>
                  <div
                    className={`w-full rounded-t-sm transition-all ${isLatest ? "bg-indigo-500" : "bg-gray-200"}`}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[10px] text-gray-400">{item.month?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PROJECT BREAKDOWN */}
      {projectPerformance.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">By Project</div>
          <div className="space-y-2">
            {projectPerformance.map((proj) => (
              <div key={proj.project_id} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 truncate shrink-0">{proj.project_name || proj.projectName}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${proj.score >= 75 ? "bg-emerald-500" : proj.score >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${proj.score || 0}%` }} />
                </div>
                <span className={`text-xs font-bold w-8 text-right ${proj.score >= 75 ? "text-emerald-600" : proj.score >= 50 ? "text-amber-500" : "text-red-500"}`}>{proj.score || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COACHING */}
      {coaching.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommendations</div>
          <div className="space-y-2">
            {coaching.map((nudge, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5">
                <span className="text-indigo-400 mt-0.5 shrink-0">→</span>
                <span className="text-xs text-indigo-800 leading-relaxed">
                  {typeof nudge === "string" ? nudge : nudge.message || nudge.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </Card.Content>
  </Card>
  );
})()}
      <section className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
{/* 🔥 Org Intelligence Overview */}
{isAdmin && intelligence && (
  <section className="theme-surface rounded-xl shadow border theme-border p-6 grid md:grid-cols-4 gap-6">
    <div>
      <div className="text-xs theme-text-muted">Average Score</div>
      <div className="text-2xl font-bold">
        {intelligence.orgScore.averageScore ?? "-"}
      </div>
    </div>

    <div>
      <div className="text-xs theme-text-muted">Total Users</div>
      <div className="text-2xl font-bold">
        {intelligence.orgScore.userCount}
      </div>
    </div>

    <div>
      <div className="text-xs theme-text-muted">High Performers</div>
      <div className="text-2xl font-bold text-green-600">
        {intelligence.orgScore.highPerformers}
      </div>
    </div>

    <div>
      <div className="text-xs theme-text-muted">At Risk</div>
      <div className="text-2xl font-bold text-red-600">
        {intelligence.orgScore.atRiskUsers}
      </div>
    </div>
  </section>
)}
{/* 🔥 Performance Leaderboard */}
{isAdmin && intelligence?.leaderboard && (
  <section className="theme-surface-soft border theme-border rounded-xl p-6">
    <h2 className="text-sm font-semibold mb-4">Top Performers</h2>

    <div className="space-y-2">
      {intelligence.leaderboard.map((u, index) => (
        <div
          key={`${u.userId || u.username || "leader"}-${index}`}
          className="flex justify-between items-center text-sm border-b pb-2"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">#{index + 1}</span>
            <span>{u.username}</span>
          </div>
          <span className="font-semibold">{u.score}</span>
        </div>
      ))}
    </div>
  </section>
)}
</div>

{isAdmin && intelligence?.forecast && (
  <section className="theme-surface border theme-border rounded-xl p-6 space-y-4">

    <div className="flex justify-between items-center">
      <h2 className="text-sm font-semibold">
        Next Month Outlook
      </h2>

      <span className="text-xs px-2 py-1 rounded-full theme-surface-soft theme-text font-medium">
        {intelligence.forecast.trend}
      </span>
    </div>

    {/* Data Signals */}
    <div className="grid md:grid-cols-3 gap-6 text-sm">

      <div>
        <div className="theme-text-muted">Predicted Average</div>
        <div className="text-2xl font-semibold">
          {intelligence.forecast.predictedAverage ?? "-"}
        </div>
      </div>

      <div>
        <div className="theme-text-muted">Trend Direction</div>
        <div className="text-lg font-semibold text-emerald-600">
          {intelligence.forecast.trend}
        </div>
      </div>

      <div>
        <div className="theme-text-muted">Risk Projection</div>
        <div className="text-lg font-semibold text-red-600">
          {intelligence.forecast.riskProjection ?? "-"}
        </div>
      </div>

    </div>

    {/* AI Interpretation */}
    {executiveSummary?.outlook && (
      <div className="border-t pt-4">
        <div className="text-xs font-semibold theme-text-muted mb-2">
          AI PERFORMANCE INTERPRETATION
        </div>

        <p className="text-sm theme-text leading-relaxed">
          {executiveSummary.outlook}
        </p>
      </div>
    )}

    {/* AI Decision Guidance */}
<div className="border-t pt-4 mt-4">
  <div className="text-xs font-semibold theme-text-muted mb-2">
    RECOMMENDED ACTION
  </div>

  <p className="text-sm theme-text">
    {intelligence.forecast.trend === "declining"
      ? "Intervention recommended. Focus on overdue workload and coaching reinforcement."
      : intelligence.forecast.trend === "improving"
      ? "Momentum positive. Maintain execution cadence and reinforce high performers."
      : "Performance stable. Monitor workload balance and prevent execution drift."}
  </p>
</div>

    {/* ✅ AI Forecast Reasoning */}
{intelligence?.forecast?.reasoning && (
  <div className="mt-5 border-t pt-4">
    <button
      onClick={() => setForecastReasoningOpen(true)}
      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
    >
      View AI forecast reasoning
    </button>
  </div>
)}
  </section>
)}
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          {/* ===============================
   WORKSPACE HEALTH PULSE
================================ */}
<section className="theme-surface rounded-xl shadow p-4 border theme-border">
  <div className="flex justify-between items-center mb-2">
    <h2 className="text-sm font-semibold">
      Workspace Health Pulse
    </h2>
    <span
  className={`text-xs font-semibold ${
    healthScore === null
      ? "text-slate-400"
      : healthScore > 75
      ? "text-emerald-600"
      : healthScore > 50
      ? "text-amber-600"
      : "text-red-600"
  }`}
>
  {healthScore === null ? "Analyzing…" : `${Math.round(healthScore)}%`}
</span>
  </div>

  <div className="w-full theme-surface-soft rounded-full h-2 overflow-hidden">
    <div
      className="h-2 rounded-full transition-all duration-700"
      style={{
        width: `${healthScore ?? 0}%`,
        background:
          healthScore > 75
            ? "#10b981"
            : healthScore > 50
            ? "#f59e0b"
            : "#ef4444",
      }}
    />
  </div>

  <p className="text-[11px] theme-text-muted mt-2">
    Live organizational health reacting to task execution in real time.
  </p>
</section>
          <p className="text-xs theme-text-muted">
            Role: {role}. Showing an overview of projects and tasks you are allowed
            to access.
          </p>
        </div>
      </section>

      {/* High-level stats */}
      <section className="theme-surface rounded-xl shadow border theme-border p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <div className="theme-text-muted">Projects</div>
          <div className="text-lg font-semibold">{totalProjects}</div>
        </div>
        <div>
          <div className="theme-text-muted">
            {isUser ? "My tasks" : "Total tasks"}
          </div>
          <div className="text-lg font-semibold">{totalTasks}</div>
        </div>
        <div>
          <div className="theme-text-muted">Pending</div>
          <div className="text-lg font-semibold">{pendingCount}</div>
        </div>
        <div>
          <div className="theme-text-muted">In progress</div>
          <div className="text-lg font-semibold">{inProgressCount}</div>
        </div>
        <div>
          <div className="theme-text-muted">Overdue</div>
          <div className="text-lg font-semibold text-red-600">
            {overdueCount}
          </div>
        </div>
      </section>

      {/* My tasks summary (for everyone) */}
      <section className="bg-white rounded-xl shadow p-4 grid md:grid-cols-3 gap-4 text-xs">
        <div>
          <h2 className="font-semibold mb-2">My tasks summary</h2>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Total assigned to me</span>
              <span className="font-semibold">{myTasks.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Overdue</span>
              <span className="font-semibold text-red-600">
                {myOverdueTasks.length}
              </span>
            </div>
          </div>
        </div>

        {/* For admin/manager, extra info */}
        {(isAdmin || isManager) && (
          <>
            <div>
              <h2 className="font-semibold mb-2">Role overview</h2>
              <p className="text-[11px] text-slate-600">
                As {role}, you can manage projects and tasks according to RBAC:
              </p>
              <ul className="mt-1 list-disc list-inside text-[11px] text-slate-600">
                <li>See all projects you&apos;re allowed to access</li>
                <li>Create & manage tasks in those projects</li>
                {isAdmin && <li>Manage users & project assignments</li>}
              </ul>
            </div>

            <div>
              <h2 className="font-semibold mb-2">Projects you own / access</h2>
              <p className="text-[11px] text-slate-600 mb-1">
                You have access to {projects.length} project
                {projects.length === 1 ? "" : "s"}.
              </p>
              <ul className="max-h-32 overflow-y-auto text-[11px] text-slate-700 space-y-1">
                {projects.map((p) => (
                  <li key={p.id}>
                    <span className="font-medium">{p.name}</span>{" "}
                    <span className="text-slate-400">
                      (added by {p.added_by})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* For plain user, explain limitations */}
        {isUser && (
          <div>
            <h2 className="font-semibold mb-2">Access rules</h2>
            <p className="text-[11px] text-slate-600">
              You can:
            </p>
            <ul className="mt-1 list-disc list-inside text-[11px] text-slate-600">
              <li>See only projects assigned to you</li>
              <li>See only tasks within those projects</li>
              <li>Change status of tasks assigned to you</li>
              <li>Add comments to tasks</li>
            </ul>
          </div>
        )}
      </section>

      {/* Top overdue tasks */}
      <section className="theme-surface rounded-xl shadow border theme-border p-4">
        <h2 className="text-sm font-semibold mb-3">Top overdue tasks</h2>

        {loading && (
          <div className="text-sm theme-text-muted">Loading overdue tasks...</div>
        )}

        {!loading && topOverdue.length === 0 && (
          <div className="text-sm theme-text-muted">
            No overdue tasks in your scope. 🎉
          </div>
        )}

        <div className="space-y-2">
          {topOverdue.map((t) => (
            <div
              key={t.id}
              className="theme-overdue-card border rounded-lg px-3 py-2 text-xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-[11px] theme-overdue-text">
                    {t.task}
                  </div>
                  <div className="text-[10px] theme-overdue-text">
                    Project:{" "}
                    <span className="font-semibold">
                      {t.project_name || t._project?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="text-[10px] theme-overdue-soft">
                    Due:{" "}
                    {t.due_date
                      ? new Date(t.due_date).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
                {t.assigned_to && (
                  <div className="text-[10px] theme-overdue-soft">
                    Assigned: {t.assigned_to}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===============================
    FORECAST REASONING MODAL
================================ */}
{forecastReasoningOpen && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="theme-surface theme-text border theme-border w-full max-w-2xl rounded-xl shadow-xl p-6 relative">

      <button
        onClick={() => setForecastReasoningOpen(false)}
        className="absolute top-3 right-4 theme-text-soft hover:text-[var(--text)]"
      >
        ✕
      </button>

      <h2 className="text-lg font-semibold mb-4">
        AI Forecast Reasoning
      </h2>

      <div className="text-sm theme-text whitespace-pre-line leading-relaxed max-h-[60vh] overflow-y-auto">
  {intelligence?.forecast?.reasoning || "Forecast reasoning unavailable"}
</div>
    </div>
  </div>
)}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {executiveDetailOpen && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="theme-surface theme-text border theme-border rounded-xl shadow-xl w-[920px] max-w-[94%] p-6 relative max-h-[86vh] overflow-y-auto">

      <button
        onClick={() => setExecutiveDetailOpen(false)}
        className="absolute top-3 right-4 theme-text-muted hover:text-[var(--text)]"
      >
        ✕
      </button>

      <h3 className="text-lg font-semibold mb-4">
        Executive Summary and Reasoning
      </h3>

      <div className="flex gap-2 mb-4">
        <Button
          size="xs"
          variant={executiveModalView === "summary" ? "primary" : "outline"}
          onClick={() => setExecutiveModalView("summary")}
        >
          Summary
        </Button>
        <Button
          size="xs"
          variant={executiveModalView === "reasoning" ? "primary" : "outline"}
          onClick={() => setExecutiveModalView("reasoning")}
        >
          Reasoning
        </Button>
      </div>

      {executiveDetailLoading ? (
        <div className="text-sm theme-text-muted">Loading executive detail...</div>
      ) : !executiveDetail ? (
        <div className="text-sm theme-text-muted">Executive detail not available.</div>
      ) : (
        <div className="space-y-5">
          {executiveModalView === "summary" && (
            <>
              <div>
                <div className="text-xs font-semibold theme-text-muted mb-2">REFLECTIVE SUMMARY</div>
                <div className="text-sm font-semibold theme-text">
                  {executiveDetail.reflectiveSummary?.headline}
                </div>
                <div className="text-sm theme-text mt-1">
                  {executiveDetail.reflectiveSummary?.narrative}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold theme-text-muted mb-2">FULL EXECUTIVE SUMMARY</div>
                <div className="text-sm theme-text whitespace-pre-line leading-relaxed">
                  {executiveDetail.fullSummary}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold theme-text-muted mb-2">RECOMMENDATIONS</div>
                <ul className="space-y-2 text-sm theme-text list-disc list-inside">
                  {(executiveDetail.recommendations || executiveDetail.priorities || []).map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {executiveModalView === "reasoning" && (
            <div>
              <div className="text-xs font-semibold theme-text-muted mb-2">REASONING</div>
              <ul className="space-y-2 text-sm theme-text list-disc list-inside">
                {(executiveDetail.reasoning || []).map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

    </div>
  </div>
)}


    </div>
  );
}
