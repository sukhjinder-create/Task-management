import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getAdminInsights } from "../services/intelligence.api";
import { getSocket } from "../socket";
import { Card, Badge, Button, Skeleton } from "../components/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckSquare, AlertTriangle, Clock, FolderKanban,
  Users, Shield, ArrowRight, ChevronRight,
  TrendingUp, TrendingDown, Award, BarChart2,
  Trophy, Medal, Info,
} from "lucide-react";
import {
  dashboardChartTickInterval,
  formatDashboardChartDateLabel,
  formatDashboardChartTooltipLabel,
  withDashboardChartDateLabels,
} from "../utils/dashboardChartDates";
import { getUserProfilePath } from "../utils/userProfiles";

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

const SCORE_TEXT = {
  good: "text-[color:var(--primary)]",
  warning: "text-[color:var(--primary)]",
  danger: "text-[color:var(--score-danger)]",
  neutral: "theme-text-muted",
};

const SCORE_BG = {
  good: "bg-[color:var(--primary)]",
  warning: "bg-[color:var(--primary)]",
  danger: "bg-[color:var(--primary)]",
  neutral: "bg-[color:var(--surface-strong)]",
};

// Outlines on canvas — no fills, neutral borders only. Status is
// conveyed by the text/icon color inside the container, not the
// container itself.
const SCORE_SURFACE = {
  good: "border-[color:var(--border)]",
  warning: "border-[color:var(--border)]",
  danger: "border-[color:var(--border)]",
  neutral: "border-[color:var(--border)]",
};

const DASHBOARD_TIME_RANGES = [
  { value: "30d", label: "30D", description: "Last 30 days" },
  { value: "90d", label: "90D", description: "Last 90 days" },
  { value: "6m", label: "6M", description: "Last 6 months" },
  { value: "1y", label: "1Y", description: "Last 1 year" },
  { value: "all", label: "ALL", description: "Full available history" },
];

function getScoreTone(value, { direction = "high", goodAt = 75, warningAt = 50 } = {}) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "neutral";

  if (direction === "low") {
    return score <= goodAt ? "good" : score <= warningAt ? "warning" : "danger";
  }

  return score >= goodAt ? "good" : score >= warningAt ? "warning" : "danger";
}

function getScoreTextClass(value, options) {
  return SCORE_TEXT[getScoreTone(value, options)];
}

function getScoreBgClass(value, options) {
  return SCORE_BG[getScoreTone(value, options)];
}

function getScoreSurfaceClass(value, options) {
  return SCORE_SURFACE[getScoreTone(value, options)];
}

function formatLiveMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value < 0) return "";
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function attendanceTone(status) {
  switch (status) {
    case "available":
      return { text: SCORE_TEXT.good, dot: "bg-[color:var(--primary)]", border: "border-[color:var(--border)]" };
    case "aws":
      return { text: SCORE_TEXT.warning, dot: "bg-[color:var(--primary)]", border: "border-[color:var(--border)]" };
    case "lunch":
      return { text: "text-[color:var(--primary)]", dot: "brand-orange-bg", border: "border-[color:var(--border)]" };
    case "on_leave":
      return { text: "theme-text-muted", dot: "bg-[color:var(--surface-strong)]", border: "border-[color:var(--border)]" };
    default:
      return { text: "theme-text-muted", dot: "bg-[color:var(--border)]", border: "border-[color:var(--border)]" };
  }
}

function normalizeTrendPoint(point, index, range = "30d", allPoints = []) {
  return {
    ...point,
    label: formatDashboardChartDateLabel(point, range, allPoints) || `P${index + 1}`,
    tooltipLabel: formatDashboardChartTooltipLabel(point, range, allPoints) || point?.tooltipLabel,
    score: Number(point?.score ?? point?.value ?? 0),
  };
}

function chartDataKey(chart) {
  return chart?.dataKey || chart?.series?.[0]?.dataKey || "value";
}

function usableChartPoints(chart) {
  const key = chartDataKey(chart);
  return (chart?.data || []).filter((point) => Number.isFinite(Number(point?.[key])));
}

function dashboardRangeLabel(range) {
  return DASHBOARD_TIME_RANGES.find((item) => item.value === range)?.label || "30D";
}

function cloneScoringConfig(config) {
  return config ? JSON.parse(JSON.stringify(config)) : null;
}

function weightPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function formatWeightPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${Math.round(number * 1000) / 10}%`;
}

function percentToWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.01;
  return Math.max(0.01, Math.min(0.99, number / 100));
}

function scoringPayloadFromDraft(draft) {
  if (!draft?.groups) return { groups: {} };
  return {
    groups: Object.fromEntries(
      Object.entries(draft.groups).map(([key, group]) => [
        key,
        {
          changedKey: group.changedKey || null,
          weights: group.weights || {},
        },
      ])
    ),
  };
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
  const [liveAttendance, setLiveAttendance] = useState(null);
  const [liveAttendanceLoading, setLiveAttendanceLoading] = useState(false);
  const [dashboardRange, setDashboardRange] = useState("30d");
  const [workspaceHealth, setWorkspaceHealth] = useState(null);
  const [scoringConfig, setScoringConfig] = useState(null);
  const [scoringDraft, setScoringDraft] = useState(null);
  const [scoringSaving, setScoringSaving] = useState(false);

async function openExecutiveDetail(view = "summary") {
  try {
    setExecutiveDetailLoading(true);
    setExecutiveModalView(view);
    setExecutiveDetailOpen(true);
    const res = await api.get("/dashboard/executive-detail", {
      params: { range: dashboardRange },
    });
    setExecutiveDetail(res.data);
  } catch (err) {
    toast.error(err?.response?.data?.error || "Failed to load executive detail");
    setExecutiveDetailOpen(false);
  } finally {
    setExecutiveDetailLoading(false);
  }
}

function updateScoringDraftWeight(groupKey, slotKey, nextWeight) {
  setScoringDraft((current) => {
    const draft = cloneScoringConfig(current || scoringConfig);
    if (!draft?.groups?.[groupKey]) return current;
    const group = draft.groups[groupKey];
    const keys = Object.keys(group.weights || {});
    const weight = percentToWeight(nextWeight);
    group.weights = { ...(group.weights || {}), [slotKey]: weight };
    group.changedKey = slotKey;
    if (group.type === "pair" && keys.length === 2) {
      const other = keys.find((key) => key !== slotKey);
      if (other) group.weights[other] = Math.max(0.01, Math.min(0.99, 1 - weight));
    }
    return draft;
  });
}

async function saveScoringConfiguration() {
  if (!scoringDraft) return;
  try {
    setScoringSaving(true);
    const res = await api.put("/intelligence/scoring-config", scoringPayloadFromDraft(scoringDraft));
    const nextConfig = res.data?.editableConfig || res.data?.adminSurface || res.data?.config || null;
    setScoringConfig(nextConfig);
    setScoringDraft(cloneScoringConfig(nextConfig));

    const month = new Date().toISOString().slice(0, 7);
    const [overviewRes, healthRes, perfRes] = await Promise.all([
      api.get("/dashboard/overview", { params: { range: dashboardRange } }),
      api.get("/intelligence/workspace/health"),
      api.get(`/intelligence/user/performance?month=${month}`),
    ]);
    setDashboardOverview(overviewRes.data);
    setWorkspaceHealth(healthRes.data || null);
    setHealthScore(healthRes.data?.healthScore ?? null);
    setMyPerformance(perfRes.data || null);
    if (isAdmin) {
      const insightsRes = await getAdminInsights(month, dashboardRange);
      setIntelligence(insightsRes.data);
    }
    toast.success("Scoring weightage saved and intelligence refreshed");
  } catch (err) {
    toast.error(err?.response?.data?.error || "Failed to save scoring weightage");
  } finally {
    setScoringSaving(false);
  }
}

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      let overview = null;
      try {
        const overviewRes = await api.get("/dashboard/overview", {
          params: { range: dashboardRange },
        });
        overview = overviewRes.data;
        setDashboardOverview(overview);
        if (typeof overview?.healthScore === "number") {
          setHealthScore(overview.healthScore);
        }
      } catch (err) {
        console.warn("Dashboard overview not available yet");
      }
      // 🔥 Load workspace health (admin only)
if (isAdmin) {
  try {
    const healthRes = await api.get("/intelligence/workspace/health");
    setWorkspaceHealth(healthRes.data || null);
    setHealthScore(healthRes.data.healthScore);
  } catch (err) {
    console.warn("Health not available yet");
  }
  try {
    const configRes = await api.get("/intelligence/scoring-config");
    const editableConfig = configRes.data?.editableConfig || configRes.data?.adminSurface || configRes.data?.config || null;
    setScoringConfig(editableConfig);
    setScoringDraft(cloneScoringConfig(editableConfig));
  } catch (err) {
    console.warn("Scoring configuration not available yet");
  }
}

      // Fetch performance trend (last 3 months)
try {
  const trendRes = await api.get("/intelligence/user/trend", {
    params: { range: dashboardRange },
  });
  const trendPayload = trendRes.data;
  setPerformanceTrend(
    Array.isArray(trendPayload)
      ? trendPayload
      : trendPayload?.series || trendPayload?.rows || []
  );
} catch (err) {
  console.warn("Trend not available");
}

// Fetch project-wise performance
try {
  const projectPerfRes = await api.get("/intelligence/user/project-performance");
  const projectPayload = projectPerfRes.data;
  setProjectPerformance(
    Array.isArray(projectPayload)
      ? projectPayload
      : projectPayload?.projects || projectPayload?.rows || []
  );
} catch (err) {
  console.warn("Project performance not available");
}
      // Reflective summary for dashboard card
if (overview?.executiveSummary) {
  setExecutiveSummary({
    status: "ready",
    headline: overview.executiveSummary.headline || "",
    text: overview.executiveSummary.narrative || "",
    reasoning: overview.executiveSummary.drivers || null,
    outlook: overview.executiveSummary.outlook || overview.forecast?.reasoning || null,
    sections: overview.executiveSummary.sections || [],
    range: overview.executiveSummary.period || overview.dashboardRange || null,
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

    const insightsRes = await getAdminInsights(month, dashboardRange);

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
  }, [api, auth.user.id, dashboardRange, isAdmin, role]);

  useEffect(() => {
    let active = true;

    async function loadLiveAttendance() {
      try {
        setLiveAttendanceLoading(true);
        const res = await api.get("/attendance/live");
        if (active) setLiveAttendance(res.data || null);
      } catch (err) {
        if (active) setLiveAttendance(null);
        console.warn("Live attendance not available");
      } finally {
        if (active) setLiveAttendanceLoading(false);
      }
    }

    const socket = getSocket();
    const subscribe = () => {
      socket?.emit("workspace:subscribe");
      loadLiveAttendance();
    };
    const handleAttendanceUpdate = () => {
      loadLiveAttendance();
    };

    loadLiveAttendance();

    if (socket) {
      if (socket.connected) {
        socket.emit("workspace:subscribe");
      }
      socket.on("connect", subscribe);
      socket.on("attendance:updated", handleAttendanceUpdate);
    }

    return () => {
      active = false;
      if (socket) {
        socket.off("connect", subscribe);
        socket.off("attendance:updated", handleAttendanceUpdate);
      }
    };
  }, [api]);

  useEffect(() => {
  if (!isAdmin) return; // workspace health pulse is admin-only
  const socket = getSocket();
  if (!socket) return;

  const subscribe = () => {
    socket.emit("workspace:subscribe");
  };

  if (socket.connected) {
    subscribe();
  } else {
    socket.once("connect", subscribe);
  }

  let active = true;
  let refreshInFlight = false;
  const onPulse = async () => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const [healthRes, overviewRes] = await Promise.all([
        api.get("/intelligence/workspace/health"),
        api.get("/dashboard/overview", { params: { range: dashboardRange } }),
      ]);
      if (!active) return;
      setWorkspaceHealth(healthRes.data || null);
      setDashboardOverview(overviewRes.data || null);
      setHealthScore(healthRes.data?.healthScore ?? overviewRes.data?.healthScore ?? null);
    } catch (err) {
      console.warn("Workspace health pulse refresh failed");
    } finally {
      refreshInFlight = false;
    }
  };

  socket.on("workspace:health-pulse", onPulse);

  return () => {
    active = false;
    socket.off("workspace:health-pulse", onPulse);
    socket.off("connect", subscribe);
  };
}, [api, dashboardRange, isAdmin]);

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

      const trendRes = await api.get("/intelligence/user/trend", {
        params: { range: dashboardRange },
      });
      const trendPayload = trendRes.data;
      setPerformanceTrend(
        Array.isArray(trendPayload)
          ? trendPayload
          : trendPayload?.series || trendPayload?.rows || []
      );

      // refresh admin insights if admin
      if (isAdmin) {
        const insightsRes = await getAdminInsights(month, dashboardRange);
        setIntelligence(insightsRes.data);
      }

      const overviewRes = await api.get("/dashboard/overview", {
        params: { range: dashboardRange },
      });
      setDashboardOverview(overviewRes.data);
      if (isAdmin) {
        const healthRes = await api.get("/intelligence/workspace/health");
        setWorkspaceHealth(healthRes.data || null);
        setHealthScore(healthRes.data?.healthScore ?? overviewRes.data?.healthScore ?? null);
      }

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
}, [api, dashboardRange, isAdmin]);

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

  const dashboardForecast = dashboardOverview?.forecast || intelligence?.forecast || null;
  const workspaceScoreExplanation =
    workspaceHealth?.scoreExplanation ||
    dashboardOverview?.scoreCard?.scoreExplanation ||
    dashboardOverview?.scoreExplanation ||
    null;
  const workspaceScoreCalculation = workspaceScoreExplanation?.scoreCalculation || workspaceScoreExplanation || {};
  const workspaceScoreDomains = Array.isArray(workspaceScoreCalculation?.domainContributions)
    ? workspaceScoreCalculation.domainContributions.filter((row) => row?.score != null)
    : Array.isArray(workspaceScoreExplanation?.domainContributions)
      ? workspaceScoreExplanation.domainContributions.filter((row) => row?.score != null)
      : [];
  const workspaceFormulaComponents = Array.isArray(workspaceScoreCalculation?.formulaComponents)
    ? workspaceScoreCalculation.formulaComponents.filter((row) => row?.score != null)
    : [];
  const workspaceAttendanceContribution =
    workspaceScoreCalculation?.attendanceReadinessContribution ||
    workspaceScoreExplanation?.attendanceEffect ||
    null;
  const workspaceScorePropagation =
    workspaceScoreCalculation?.userScoreBalancePropagation ||
    workspaceScoreExplanation?.userScoreBalancePropagation ||
    null;
  const adminScoringGroups = Object.values(scoringDraft?.groups || {})
    .filter((group) => group?.key === "userFinalBalance");

/* ======================================
   AUTONOMOUS AI INSIGHT ENGINE
====================================== */

const autonomousInsight = useMemo(() => {
  const risk = myPerformance?.intelligence?.risk?.level;
  const overdue = overdueCount;
  const trend = dashboardForecast?.trend;
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
        { label: "Overdue", value: overdue, color: "text-[color:var(--overdue-text)]" },
        { label: "In Progress", value: inProgress, color: "text-[color:var(--text-soft)]" },
        { label: "Completion Rate", value: `${completionRate}%`, color: "theme-text-muted" },
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
        { label: "Overdue", value: overdue, color: "text-[color:var(--overdue-text)]" },
        { label: "In Progress", value: inProgress, color: "text-[color:var(--primary)]" },
        { label: "Completion Rate", value: `${completionRate}%`, color: "theme-text-muted" },
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
        { label: "Completed", value: completed, color: "text-[color:var(--text-soft)]" },
        { label: "In Progress", value: inProgress, color: "text-[color:var(--primary)]" },
        { label: "Trend", value: "↓ Declining", color: "text-[color:var(--overdue-text)]" },
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
        { label: "Completed", value: completed, color: "text-[color:var(--text-soft)]" },
        { label: "In Progress", value: inProgress, color: "text-[color:var(--primary)]" },
        { label: "Completion Rate", value: `${completionRate}%`, color: "text-[color:var(--text-soft)]" },
      ],
    };
  }

  // Neutral fallback — still show real numbers
  return {
    type: "neutral",
    headline: "Workspace Status Normal",
    message: `${total} total task${total !== 1 ? "s" : ""} across ${totalProjects} project${totalProjects !== 1 ? "s" : ""}. ${inProgress} in progress, ${completed} completed, ${overdue} overdue.`,
    stats: [
      { label: "Total Tasks", value: total, color: "theme-text" },
      { label: "In Progress", value: inProgress, color: "text-[color:var(--primary)]" },
      { label: "Completed", value: completed, color: "text-[color:var(--text-soft)]" },
    ],
  };
}, [myPerformance, overdueCount, dashboardForecast, inProgressCount, completedCount, totalTasks, totalProjects]);

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

  const intelligenceCharts = useMemo(() => {
    return (dashboardOverview?.visualizations?.charts || [])
      .filter((chart) => chart?.type === "line" || chart?.data?.length)
      .map((chart) => {
        if (chart?.type !== "line") return chart;
        const rangeValue = chart?.range?.value || dashboardRange;
        return {
          ...chart,
          data: withDashboardChartDateLabels(chart?.data || [], rangeValue),
        };
      });
  }, [dashboardOverview, dashboardRange]);

  const liveAttendanceRows = useMemo(() => {
    if (!liveAttendance?.buckets) return [];
    return [
      ...(liveAttendance.buckets.available || []),
      ...(liveAttendance.buckets.lunch || []),
      ...(liveAttendance.buckets.aws || []),
      ...(liveAttendance.buckets.onLeave || []),
      ...(liveAttendance.buckets.notSignedIn || []),
    ].slice(0, 8);
  }, [liveAttendance]);

  function getRiskLevel(score) {
  if (score >= 75) return { label: "Low Risk", color: SCORE_TEXT.good };
  if (score >= 50) return { label: "Medium Risk", color: SCORE_TEXT.warning };
  return { label: "High Risk", color: SCORE_TEXT.danger };
}
  const insightTone =
    autonomousInsight?.type === "critical"
      ? {
          panel: "dashboard-danger-card",
          icon: "bg-[color:var(--score-danger)] text-white",
          label: "bg-[color:var(--score-danger)] text-white",
          metric: SCORE_SURFACE.danger,
          metricText: SCORE_TEXT.danger,
        }
      : autonomousInsight?.type === "warning"
      ? {
          panel: "border-[color:var(--border)]",
          icon: "bg-[color:var(--surface-soft)] text-[color:var(--primary)]",
          label: "bg-[color:var(--surface-soft)] text-[color:var(--primary)] border border-[color:var(--border)]",
          metric: SCORE_SURFACE.warning,
          metricText: SCORE_TEXT.warning,
        }
      : autonomousInsight?.type === "positive"
      ? {
          panel: "border-[color:var(--border)]",
          icon: "bg-[color:var(--surface-soft)] text-[color:var(--primary)]",
          label: "bg-[color:var(--surface-soft)] text-[color:var(--primary)] border border-[color:var(--border)]",
          metric: SCORE_SURFACE.good,
          metricText: SCORE_TEXT.good,
        }
      : {
          panel: "border-[color:var(--border)]",
          icon: "bg-[color:var(--surface-soft)] theme-text-muted",
          label: "bg-[color:var(--surface-soft)] theme-text-muted border border-[color:var(--border)]",
          metric: SCORE_SURFACE.neutral,
          metricText: "theme-text",
        };

  const liveAttendancePanel = (liveAttendance || liveAttendanceLoading) ? (
    <section className="border border-[color:var(--border)] rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Live Operations
          </p>
          <h2 className="text-sm font-bold theme-text">Live Attendance</h2>
          <p className="text-[11px] theme-text-muted">
            Today {liveAttendance?.date ? `- ${liveAttendance.date}` : ""} - updates on attendance changes
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-md border border-[color:var(--border)] theme-text-muted">
          {liveAttendanceLoading ? "Refreshing" : "Live"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {[
          { label: "Present", value: liveAttendance?.totals?.present ?? 0, status: "available" },
          { label: "Available", value: liveAttendance?.totals?.available ?? 0, status: "available" },
          { label: "Lunch", value: liveAttendance?.totals?.lunch ?? 0, status: "lunch" },
          { label: "AWS", value: liveAttendance?.totals?.aws ?? 0, status: "aws" },
          { label: "On Leave", value: liveAttendance?.totals?.onLeave ?? 0, status: "on_leave" },
        ].map((item) => {
          const tone = attendanceTone(item.status);
          return (
            <div key={item.label} className={`rounded-lg border ${tone.border} p-3`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                <span className="text-[11px] font-semibold theme-text-muted">{item.label}</span>
              </div>
              <div className={`mt-2 text-xl font-semibold ${tone.text}`}>{item.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {liveAttendanceRows.length > 0 ? (
          liveAttendanceRows.map((user) => {
            const tone = attendanceTone(user.status);
            const detail =
              user.status === "on_leave"
                ? user.leave?.type || "Leave"
                : user.status === "offline"
                ? "Not signed in"
                : user.statusMinutes != null
                ? `${user.label} - ${formatLiveMinutes(user.statusMinutes)}`
                : user.label;

            return (
              <div key={user.userId} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] px-3 py-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${tone.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold theme-text truncate">{user.username}</div>
                  <div className="text-[10px] theme-text-muted truncate">{detail}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase shrink-0 ${tone.text}`}>{user.label}</span>
              </div>
            );
          })
        ) : (
          <div className="md:col-span-2 rounded-lg border border-[color:var(--border)] px-3 py-4 text-xs theme-text-muted text-center">
            No live attendance activity is available yet.
          </div>
        )}
      </div>

      <p className="mt-3 text-[10px] theme-text-muted">
        {liveAttendance?.totals?.notSignedIn ?? 0} not signed in. Attendance scoring remains end-of-day; this panel is live operational status.
      </p>
    </section>
  ) : null;

  return (
  <div className="max-w-[1400px] mx-auto w-full space-y-6">

    {/* ── Page header ─────────────────────────────────────────── */}
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
          {isAdmin ? "Operations" : isManager ? "Team" : "Personal"}
        </p>
        <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
          Dashboard
        </h1>
        <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
          {isAdmin
            ? "Workspace-wide signal — execution, intelligence, and forecast at a glance."
            : isManager
            ? "Your team's execution snapshot and active workload."
            : "Your active work, performance, and signal for the month."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {healthScore != null && (
          <div className="relative group inline-flex items-center gap-2 px-3 h-9 rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)]">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-soft)] font-semibold">Health</span>
            <span className={`text-[15px] font-semibold font-mono ${getScoreTextClass(healthScore)}`}>{healthScore}</span>
            <span className="text-[11px] text-[color:var(--text-soft)]">/100</span>
            {workspaceScoreExplanation && (
              <>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--border)] theme-text-muted hover:text-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
                  aria-label="Show workspace health calculation"
                >
                  <Info className="h-3 w-3" />
                </button>
                <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-40 hidden w-[min(94vw,520px)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left shadow-xl group-hover:block group-focus-within:block">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Workspace Health Calculation</div>
                      <div className="text-sm font-semibold theme-text">
                        {workspaceScoreCalculation.finalScore ?? workspaceScoreExplanation.finalScore}/100 from {workspaceScoreCalculation.scoreAuthority || workspaceScoreExplanation.scoreAuthority || "workspace_intelligence.score"}
                      </div>
                    </div>
                    <span className="rounded-md bg-[color:var(--surface-soft)] px-2 py-1 text-[10px] font-bold theme-text-muted">Canonical</span>
                  </div>
                  <p className="text-[11px] leading-snug theme-text-muted">{workspaceScoreCalculation.formulaReadable || workspaceScoreExplanation.formulaReadable}</p>
                  {workspaceFormulaComponents.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-[color:var(--border)] pt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Adaptive Formula</div>
                      {workspaceFormulaComponents.map((part) => (
                        <div key={part.key} className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
                          <span className="truncate theme-text-muted">{part.label}</span>
                          <span className="font-semibold theme-text">{part.score} x {formatWeightPercent(part.multiplier)} = {part.contributionPoints}</span>
                        </div>
                      ))}
                      {workspaceScoreCalculation.rawScoreBeforeRounding != null && (
                        <div className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
                          <span className="theme-text-muted">Raw to rounded</span>
                          <span className="font-semibold theme-text">
                            {workspaceScoreCalculation.rawScoreBeforeRounding} -&gt; {workspaceScoreCalculation.finalRoundedScore ?? workspaceScoreCalculation.finalScore}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 space-y-1.5 border-t border-[color:var(--border)] pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Workspace Index Rows</div>
                    {workspaceScoreDomains.slice(0, 8).map((domain) => (
                      <div key={domain.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[11px]">
                        <span className="truncate theme-text-muted">{domain.label}</span>
                        <span className="font-semibold theme-text">{domain.score}/100</span>
                        <span className="font-semibold theme-text">{formatWeightPercent(domain.configuredWeight ?? domain.weight)}</span>
                        <span className="font-semibold text-[color:var(--primary)]">{domain.weightedContributionPoints}</span>
                      </div>
                    ))}
                  </div>
                  {workspaceAttendanceContribution && (
                    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Attendance Readiness</div>
                      <p className="mt-1 text-[11px] leading-snug theme-text-muted">
                        {workspaceAttendanceContribution.score}/100 x {formatWeightPercent(workspaceAttendanceContribution.configuredWeight ?? workspaceAttendanceContribution.weight)} =
                        {" "}{workspaceAttendanceContribution.weightedContributionPoints} weighted-mean points. Path: {workspaceAttendanceContribution.directOrIndirect || "direct"}.
                      </p>
                    </div>
                  )}
                  {workspaceScorePropagation && (
                    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">User Balance Propagation</div>
                      <p className="mt-1 text-[11px] leading-snug theme-text-muted">
                        {workspaceScorePropagation.summary}
                      </p>
                      <div className="mt-1 text-[11px] font-semibold theme-text">
                        Core {formatWeightPercent(workspaceScorePropagation.userScoreBalanceWeights?.core)} / Professional Discipline {formatWeightPercent(workspaceScorePropagation.userScoreBalanceWeights?.professionalDiscipline)}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>

    {liveAttendancePanel}

    <section className="border border-[color:var(--border)] rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Performance Intelligence
          </p>
          <h2 className="text-sm font-bold theme-text">Selected Period: {dashboardRangeLabel(dashboardRange)}</h2>
          <p className="text-[11px] theme-text-muted">
            Executive summary, trends, charts, and outlook below use this period.
          </p>
        </div>
        <div className="inline-flex h-9 items-center overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)]">
          {DASHBOARD_TIME_RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              title={range.description}
              onClick={() => setDashboardRange(range.value)}
              className={`h-full px-2.5 text-[11px] font-semibold transition-colors ${
                dashboardRange === range.value
                  ? "bg-[color:var(--primary)] text-[color:var(--primary-contrast)]"
                  : "theme-text-muted hover:theme-text hover:bg-[var(--surface)]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
    </section>

    {isAdmin && adminScoringGroups.length > 0 && (
      <section className="border border-[color:var(--border)] rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
              Scoring Weightage
            </p>
            <h2 className="text-sm font-bold theme-text">User Score Balance</h2>
            <p className="text-[11px] theme-text-muted max-w-2xl">
              Workspace admins control the canonical balance between core execution domains and Professional Discipline. Internal project, team, and workspace composition weights stay engine-owned.
            </p>
          </div>
          <button
            type="button"
            onClick={saveScoringConfiguration}
            disabled={scoringSaving}
            className="h-9 rounded-lg bg-[color:var(--primary)] px-3 text-xs font-semibold text-[color:var(--primary-contrast)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
          >
            {scoringSaving ? "Saving..." : "Save weightage"}
          </button>
        </div>
        <div className="mt-4 grid max-w-2xl gap-3">
          {adminScoringGroups.map((group) => {
            const entries = Object.entries(group.weights || {});
            const isPair = group.type === "pair";
            const totalPct = Math.round(entries.reduce((sum, [, value]) => sum + Number(value || 0), 0) * 100);
            return (
              <div key={group.key} className="rounded-lg border border-[color:var(--border)] p-3">
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold theme-text">{group.label}</h3>
                    <span className="text-[10px] font-bold uppercase theme-text-muted">{totalPct}%</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug theme-text-muted">{group.description}</p>
                </div>
                <div className="space-y-2">
                  {entries.map(([slotKey, weight]) => {
                    const label = group.slots?.[slotKey]?.label || slotKey;
                    const pct = weightPercent(weight);
                    return (
                      <div key={slotKey}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="truncate text-[11px] font-semibold theme-text-muted">{label}</span>
                          <span className="text-[11px] font-semibold text-[color:var(--primary)]">{pct}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="99"
                          step="1"
                          value={pct}
                          onChange={(event) => updateScoringDraftWeight(group.key, slotKey, event.target.value)}
                          className="w-full accent-[var(--primary)]"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-[10px] theme-text-muted">
                  {isPair ? "Two-way pair: changing one side automatically sets the paired side. Bounds are 1% to 99%." : "Backend normalizes this group to a deterministic 100% total."}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    )}

{/* ======================================
   AUTONOMOUS AI INSIGHT CARD
====================================== */}

{isAdmin && autonomousInsight && (
  <div className={`rounded-2xl border p-4 ${insightTone.panel}`}>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${insightTone.icon}`}>
          {autonomousInsight.type === "critical" || autonomousInsight.type === "warning" ? (
            <AlertTriangle className="h-5 w-5" />
          ) : autonomousInsight.type === "positive" ? (
            <CheckSquare className="h-5 w-5" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${insightTone.label}`}>AI Insight</span>
            <span className="text-sm font-bold theme-text">{autonomousInsight.headline}</span>
          </div>
          <p className="text-sm theme-text leading-relaxed">{autonomousInsight.message}</p>
        </div>
      </div>
      {autonomousInsight.stats && (
        <div className="grid grid-cols-3 gap-2">
          {autonomousInsight.stats.map((s, index) => (
            <div key={s.label} className={`rounded-lg border px-3 py-2.5 text-center ${index === 0 ? insightTone.metric : "bg-[color:var(--surface)] border-[color:var(--border)]"}`}>
              <span className={`block text-lg font-semibold leading-none ${index === 0 ? insightTone.metricText : s.color}`}>{s.value}</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase theme-text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="hidden">
      <div className="text-xl mt-0.5">
        {autonomousInsight.type === "critical" && "🔴"}
        {autonomousInsight.type === "warning"  && "⚠️"}
        {autonomousInsight.type === "positive" && "✅"}
        {autonomousInsight.type === "neutral"  && "🧠"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            autonomousInsight.type === "critical" ? "bg-[color:var(--overdue-bg)] text-[color:var(--overdue-text)]" :
            autonomousInsight.type === "warning"  ? "bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" :
            autonomousInsight.type === "positive" ? "bg-[color:var(--surface-soft)] text-[color:var(--text-soft)]" :
            "bg-[color:var(--surface-soft)] text-[color:var(--text-soft)]"
          }`}>AI Insight</span>
          <span className="text-sm font-semibold theme-text">{autonomousInsight.headline}</span>
        </div>
        <p className="text-sm theme-text-muted leading-relaxed mb-3">{autonomousInsight.message}</p>
        {autonomousInsight.stats && (
          <div className="flex gap-4 flex-wrap">
            {autonomousInsight.stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                <span className="text-xs theme-text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)}


{/* ================================
    EXECUTIVE INTELLIGENCE SUMMARY
================================ */}
{false && isAdmin && dashboardOverview?.executiveSummary && (
  <Card className="gradient-primary text-white border-primary-500">
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
  <div className="border border-[color:var(--border)] rounded-lg p-5">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg brand-orange-bg text-[#0a0a0b] flex items-center justify-center shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold theme-text">Executive Intelligence</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md brand-orange-text font-semibold border brand-orange-border shrink-0">
                Live
              </span>
            </div>
            <p className="text-[10px] theme-text-muted">Executive operational briefing</p>
          </div>
        </div>
        {dashboardOverview.executiveSummary.headline && (
          <p className="text-sm font-bold theme-text mb-2">
            {dashboardOverview.executiveSummary.headline}
          </p>
        )}
        <p className="text-xs theme-text-muted leading-relaxed line-clamp-3">
          {dashboardOverview.executiveSummary.narrative}
        </p>
      </div>
      <div className="rounded-lg border brand-orange-border p-3 self-stretch flex flex-col justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase brand-orange-text">Current signal</div>
          <div className="text-xs theme-text-muted mt-1">Operational summary ready</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openExecutiveDetail("summary")}
            className="text-xs font-semibold brand-orange-text hover:opacity-80 transition-opacity"
          >
            Read full summary →
          </button>
          <button
            onClick={() => openExecutiveDetail("reasoning")}
            className="text-xs font-semibold theme-text-muted hover:theme-text transition-colors"
          >
              View evidence
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{false && isAdmin && dashboardOverview?.executiveSummary && (
  <div className="theme-surface border theme-border rounded-xl overflow-hidden shadow-sm">
    {/* Accent header bar */}
    <div
      className="h-1 w-full"
      style={{
        background:
          "linear-gradient(90deg, var(--primary-hover), var(--primary), var(--primary-hover))",
      }}
    />
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center">
            <span className="text-sm">🧠</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold theme-text">Executive Intelligence</h2>
            <p className="text-[10px] theme-text-muted">AI-generated org analysis</p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full text-[color:var(--primary)] font-semibold border border-[color:var(--primary)]/20 shrink-0">
          Live
        </span>
      </div>
      {dashboardOverview.executiveSummary.headline && (
        <p className="text-sm font-semibold theme-text mb-1.5">
          {dashboardOverview.executiveSummary.headline}
        </p>
      )}
      <p className="text-xs theme-text-muted leading-relaxed line-clamp-3">
        {dashboardOverview.executiveSummary.narrative}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-[var(--border)]">
        <button
          onClick={() => openExecutiveDetail("summary")}
          className="text-xs font-medium text-[color:var(--primary)] hover:opacity-80 transition-opacity"
        >
          Read full summary →
        </button>
        <span className="theme-text-muted text-xs">·</span>
        <button
          onClick={() => openExecutiveDetail("reasoning")}
          className="text-xs font-medium theme-text-muted hover:theme-text transition-colors"
        >
          View reasoning
        </button>
      </div>
    </div>
  </div>
)}

{dashboardOverview?.scoreCard && (
  <div className="grid gap-4 lg:grid-cols-2">
    {intelligenceCharts.length > 0 ? intelligenceCharts.map((chart) => {
      const dataKey = chartDataKey(chart);
      const usablePoints = usableChartPoints(chart);
      const sparseLine = chart.type !== "bar" && usablePoints.length < 2;
      const chartRange = chart.range?.value || dashboardRange;
      const rangeLabel = chart.range?.label || dashboardRangeLabel(dashboardRange);
      const granularityLabel = chart.granularity ? `${chart.granularity} buckets` : chart.source;
      const singlePoint = usablePoints[0] || null;
      const tickInterval = dashboardChartTickInterval(chartRange, chart.data?.length || 0);

      return (
      <div key={chart.key} className="border border-[color:var(--border)] rounded-lg p-5 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold theme-text">{chart.title}</h2>
            <p className="text-[11px] theme-text-muted">
              {chart.source} · {rangeLabel} · {granularityLabel}
            </p>
          </div>
          <span className="text-[11px] font-semibold theme-text-muted">
            {chart.metric}
          </span>
        </div>
        <div className="h-[190px]">
          {sparseLine ? (
            <div className="h-full rounded-lg border border-[color:var(--border)] flex flex-col items-center justify-center text-center px-4">
              <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">
                {usablePoints.length === 1 ? "Single snapshot available" : "No trend history yet"}
              </div>
              <div className="mt-2 text-2xl font-semibold theme-text">
                {singlePoint ? Math.round(Number(singlePoint[dataKey])) : "-"}
              </div>
              <p className="mt-1 text-[11px] theme-text-muted max-w-[260px]">
                {singlePoint
                  ? `${chart.metric} has one valid point in ${rangeLabel}. Trendline will appear after another snapshot.`
                  : `${chart.metric} has no snapshot points in ${rangeLabel}.`}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chart.type === "bar" ? (
                <BarChart data={chart.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={0} height={42} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                    }}
                  />
                  <Bar dataKey={dataKey} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chart.data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipLabel || label}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                    }}
                  />
                  <Line type="monotone" dataKey={dataKey} stroke="var(--primary)" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
      );
    }) : (
      <div className="border border-[color:var(--border)] rounded-lg p-5 min-w-0 lg:col-span-2">
        <div className="h-[190px] flex items-center justify-center text-xs theme-text-muted">
          Intelligence charts will appear after repository snapshots are populated.
        </div>
      </div>
    )}
  </div>
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
    executionDiscipline: { label: "Execution Discipline", good: "high", icon: "⚡", tip: "% of assigned tasks completed" },
    timelinessIndex:     { label: "Timeliness",           good: "high", icon: "⏱", tip: "On-time completions / all deadline-tracked tasks (overdue count against this)" },
    workloadStress:      { label: "Workload Stress",       good: "low",  icon: "🔥", tip: "% of tasks currently overdue" },
    velocityScore:       { label: "Task Velocity",         good: "high", icon: "🚀", tip: "Speed of completion (50 = 7-day avg, 100 = instant)" },
  };
  const breakdown = myPerformance.breakdown || {};
  const scoreExplanation = myPerformance.scoreExplanation || {};
  const scoreNarrative = scoreExplanation.scoreNarrative || {};
  const scoreCalculation = scoreExplanation.scoreCalculation || {};
  const attendanceContribution = scoreExplanation.attendanceContribution || {};
  const scoreComposition = Array.isArray(scoreExplanation.scoreComposition) && scoreExplanation.scoreComposition.length
    ? scoreExplanation.scoreComposition.filter((row) => row?.score != null)
    : Array.isArray(scoreExplanation.domainRows)
      ? scoreExplanation.domainRows.filter((row) => row?.score != null)
      : [];
  const evidenceInputs = Array.isArray(scoreExplanation.evidenceInputs) && scoreExplanation.evidenceInputs.length
    ? scoreExplanation.evidenceInputs.filter((row) => row?.score != null)
    : [
        breakdown.attendanceScore != null && {
          key: "attendanceEvidence",
          label: "Attendance Evidence",
          score: breakdown.attendanceScore,
          parentDomain: "Professional Discipline",
          note: "Attendance supports Professional Discipline; it is not a peer final-score domain.",
        },
        breakdown.productivityScore != null && {
          key: "deliveryEvidence",
          label: "Delivery Evidence",
          score: breakdown.productivityScore,
          parentDomain: "Delivery Effectiveness",
          note: "Delivery evidence explains the Delivery Effectiveness domain.",
        },
      ].filter(Boolean);
  const diagnosticDrivers = Array.isArray(scoreExplanation.diagnosticDrivers) && scoreExplanation.diagnosticDrivers.length
    ? scoreExplanation.diagnosticDrivers.filter((row) => row?.value != null)
    : Object.entries(dims).map(([key, value]) => ({
        key,
        label: dimMeta[key]?.label || key.replace(/([A-Z])/g, " $1"),
        value,
        parentDomain: "Diagnostic Signal",
        direction: dimMeta[key]?.good === "low" ? "lower_is_better" : "higher_is_better",
        note: dimMeta[key]?.tip,
      }));
  const mainConcerns = scoreComposition
    .filter((row) => Number.isFinite(Number(row.score)))
    .sort((a, b) => Number(a.score) - Number(b.score))
    .slice(0, 2);
  const narrativeSummary = scoreNarrative.summary || scoreExplanation.summary || myPerformance.explanation || "";
  const liftSummary = scoreNarrative.liftSummary || "";
  const attendanceSummary = attendanceContribution.summary || "Attendance supports Professional Discipline; it is not shown as a peer final-score domain.";
  const visibleEvidenceInputs = evidenceInputs.filter((row) => !["deliveryEffectiveness", "deliveryEvidence"].includes(row.key));
  const visibleDiagnosticDrivers = diagnosticDrivers
    .filter((row) => row.value != null)
    .slice(0, 8);
  const scoreCalculationDomains = Array.isArray(scoreCalculation.domainContributions)
    ? scoreCalculation.domainContributions.filter((row) => row?.score != null)
    : [];
  const scoreCalculationFormation = scoreCalculation.professionalDisciplineFormation || {};
  const scoreCalculationAttendance = scoreCalculation.attendanceEffect || attendanceContribution || {};
  const scoreFormulaParts = [
    scoreCalculation.coreContributionPoints != null && {
      label: "Core block",
      value: `${scoreCalculation.coreScore ?? "-"} x ${scoreCalculation.coreMultiplier ?? "-"} = ${scoreCalculation.coreContributionPoints}`,
    },
    scoreCalculation.professionalDisciplineContributionPoints != null && {
      label: "Professional Discipline",
      value: `${scoreCalculation.professionalDisciplineScore ?? "-"} x ${scoreCalculation.professionalDisciplineMultiplier ?? "-"} = ${scoreCalculation.professionalDisciplineContributionPoints}`,
    },
    scoreCalculation.directAttendanceAdjustment != null && {
      label: "Attendance lift / drag",
      value: `${scoreCalculation.directAttendanceAdjustment >= 0 ? "+" : ""}${scoreCalculation.directAttendanceAdjustment}`,
    },
    scoreCalculation.rawScoreBeforeRounding != null && {
      label: "Rounded output",
      value: `${scoreCalculation.rawScoreBeforeRounding} -> ${scoreCalculation.finalScore ?? score}`,
    },
  ].filter(Boolean);
  const riskTone = risk?.level === "High" ? "danger" : risk?.level === "Medium" ? "warning" : risk?.level ? "good" : "neutral";

  const getDriverOptions = (driver) => {
    return driver?.direction === "lower_is_better"
      ? { direction: "low", goodAt: 40, warningAt: 70 }
      : { goodAt: 70, warningAt: 40 };
  };

  const getDriverText = (driver) => {
    return getScoreTextClass(driver.value, getDriverOptions(driver));
  };

  const getEvidenceTone = (item) => {
    if (item.effectTone === "positive") return SCORE_TEXT.good;
    if (item.effectTone === "negative") return SCORE_TEXT.danger;
    return "theme-text-muted";
  };

  return (
  <Card className="">
    <Card.Content className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] items-stretch">
        <div className="min-w-0">
          <div className="text-xs theme-text-muted font-bold uppercase tracking-wide mb-1">My Performance</div>
          <div className="text-xl font-bold theme-text">{monthLabel}</div>
          {narrativeSummary && (
            <p className="text-xs theme-text-muted mt-2 max-w-2xl leading-relaxed">{narrativeSummary}</p>
          )}
          {liftSummary && (
            <p className="text-[10px] theme-text-muted mt-1 max-w-2xl leading-relaxed">{liftSummary}</p>
          )}
        </div>
        <div className={`relative group rounded-lg border p-4 ${getScoreSurfaceClass(score)}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase theme-text-muted">
                <span>Score</span>
                {scoreCalculation.finalScore != null && (
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--border)] theme-text-muted hover:text-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
                    aria-label="Show score calculation"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className={`text-3xl font-semibold leading-none ${getScoreTextClass(score)}`}>
                {score}
                <span className={`text-base font-bold ${getScoreTextClass(score)}`}>/100</span>
              </div>
            </div>
            <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${SCORE_SURFACE[riskTone]} ${SCORE_TEXT[riskTone]}`}>
              {risk?.level || "No"} Risk
            </span>
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden">
            <div
              className={`h-1 rounded-full transition-all duration-700 ${getScoreBgClass(score)}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          {delta != null && (
            <div className={`mt-2 text-xs font-semibold ${delta >= 0 ? SCORE_TEXT.good : SCORE_TEXT.danger}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs previous intelligence point
            </div>
          )}
          {scoreCalculation.finalScore != null && (
            <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-30 hidden w-[min(92vw,420px)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left shadow-xl group-hover:block group-focus-within:block">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Score Calculation</div>
                  <div className="text-sm font-semibold theme-text">
                    {scoreCalculation.finalScore}/100 from {scoreCalculation.scoreAuthority || "user_intelligence.score"}
                  </div>
                </div>
                <span className="rounded-md bg-[color:var(--surface-soft)] px-2 py-1 text-[10px] font-bold theme-text-muted">Canonical</span>
              </div>
              <div className="space-y-1.5">
                {scoreFormulaParts.map((part) => (
                  <div key={part.label} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="theme-text-muted">{part.label}</span>
                    <span className="font-semibold theme-text">{part.value}</span>
                  </div>
                ))}
              </div>
              {scoreCalculationDomains.length > 0 && (
                <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide theme-text-muted">Domain Impact</div>
                  <div className="space-y-1.5">
                    {scoreCalculationDomains.slice(0, 5).map((domain) => (
                      <div key={domain.key} className="grid grid-cols-[1fr_auto] gap-3 text-[11px]">
                        <span className="truncate theme-text-muted">{domain.label}</span>
                        <span className={`font-semibold ${domain.finalScoreImpactVsNeutral >= 0 ? SCORE_TEXT.good : SCORE_TEXT.danger}`}>
                          {domain.finalScoreImpactVsNeutral >= 0 ? "+" : ""}{domain.finalScoreImpactVsNeutral} vs neutral
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-snug theme-text-muted">
                    Core domains are normalized together, so impact is shown as final-score movement versus a neutral 60/100 domain.
                  </p>
                </div>
              )}
              {scoreCalculationAttendance?.score != null && (
                <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Attendance Effect</div>
                  <p className="mt-1 text-[11px] leading-snug theme-text-muted">
                    Attendance {scoreCalculationAttendance.score}/100 feeds Professional Discipline. Without attendance evidence, Professional Discipline would be {scoreCalculationAttendance.professionalWithoutAttendanceSignal ?? "-"} and final score would be {scoreCalculationAttendance.finalWithoutAttendanceSignal ?? "-"}.
                  </p>
                  <div className={`mt-1 text-[11px] font-semibold ${Number(scoreCalculationAttendance.effectiveFinalLiftVsNoAttendanceSignal || 0) >= 0 ? SCORE_TEXT.good : SCORE_TEXT.danger}`}>
                    Final score effect: {Number(scoreCalculationAttendance.effectiveFinalLiftVsNoAttendanceSignal || 0) >= 0 ? "+" : ""}{scoreCalculationAttendance.effectiveFinalLiftVsNoAttendanceSignal ?? 0}
                  </div>
                </div>
              )}
              {Array.isArray(scoreCalculationFormation.inputs) && scoreCalculationFormation.inputs.length > 0 && (
                <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Professional Discipline Inputs</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] theme-text-muted">
                    {scoreCalculationFormation.inputs.map((input) => (
                      <div key={input.key} className="flex items-center justify-between gap-2">
                        <span className="truncate">{input.label}</span>
                        <span className={`font-semibold ${input.effect?.tone === "negative" ? SCORE_TEXT.danger : input.effect?.tone === "positive" ? SCORE_TEXT.good : "theme-text"}`}>
                          {input.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HEADER ROW */}
      <div className="hidden">
        <div>
          <div className="text-xs theme-text-muted font-medium uppercase tracking-wide mb-0.5">My Performance</div>
          <div className="text-lg font-bold theme-text">{monthLabel}</div>
          {myPerformance.explanation && (
            <p className="text-xs theme-text-muted mt-1 max-w-sm leading-relaxed">{myPerformance.explanation}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-3xl font-semibold ${getScoreTextClass(score)}`}>
            {score}
            <span className={`text-base font-normal ${getScoreTextClass(score)}`}>/100</span>
          </div>
          {delta != null && (
            <div className={`text-xs font-semibold mt-0.5 ${delta >= 0 ? SCORE_TEXT.good : SCORE_TEXT.danger}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs previous intelligence point
            </div>
          )}
          <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block ${
            risk?.level === "High" ? "bg-[color:var(--overdue-bg)] text-[color:var(--overdue-text)]" :
            risk?.level === "Medium" ? "bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" :
            "bg-[color:var(--surface-soft)] text-[color:var(--text-soft)]"
          }`}>
            {risk?.level || "—"} Risk
          </div>
        </div>
      </div>

      {/* SCORE BAR */}
      <div className="hidden">
        <div
          className={`h-1 rounded-full transition-all duration-700 ${getScoreBgClass(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>

      {/* SCORE COMPOSITION - canonical final-score domains */}
      {scoreComposition.length > 0 && (
        <div className="rounded-lg border border-[color:var(--primary)]/16 bg-[color:var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold theme-text-muted uppercase tracking-wide">Score Composition</div>
              <div className="text-xs theme-text-muted">These are the canonical score domains that directly produce the final score.</div>
            </div>
            <span className="rounded-md bg-[color:var(--surface-soft)] px-2 py-1 text-[10px] font-bold theme-text-muted">Enterprise</span>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {scoreComposition.map((row) => {
              const value = Math.round(Number(row.score ?? 0));
              return (
                <div key={row.key} className={`rounded-lg border p-3 ${getScoreSurfaceClass(value, { goodAt: 70, warningAt: 40 })}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold theme-text truncate">{row.label}</span>
                    <span className={`text-sm font-semibold ${getScoreTextClass(value, { goodAt: 70, warningAt: 40 })}`}>{row.score ?? "-"}</span>
                  </div>
                  <div className="mt-2 h-1 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden">
                    <div className={`h-1 rounded-full ${getScoreBgClass(value, { goodAt: 70, warningAt: 40 })}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
                  </div>
                  {mainConcerns.some((concern) => concern.key === row.key) && (
                    <div className={`mt-1 text-[10px] font-semibold ${SCORE_TEXT.warning}`}>Primary pressure</div>
                  )}
                </div>
              );
            })}
          </div>
          {mainConcerns.length > 0 && (
            <p className="mt-3 text-[10px] theme-text-muted leading-relaxed">
              Main drag: {mainConcerns.map((row) => `${row.label} ${row.score}/100`).join(" and ")}.
            </p>
          )}
        </div>
      )}

      {visibleEvidenceInputs.length > 0 && (
        <div>
          <div className="mb-2">
            <div className="text-xs font-semibold theme-text-muted uppercase tracking-wide">Evidence Inputs</div>
            <div className="text-xs theme-text-muted">These signals do not form a second score. They feed one or more score-composition domains above.</div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {visibleEvidenceInputs.map((item) => {
              const value = Math.round(Number(item.score ?? 0));
              const feedLabel = Array.isArray(item.feedsDomains) && item.feedsDomains.length
                ? item.feedsDomains.join(" / ")
                : item.parentDomain || "score domain";
              return (
                <div key={item.key} className="rounded-lg border border-[color:var(--border)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold theme-text">{item.label}</div>
                      <div className="text-[10px] theme-text-muted">Feeds {feedLabel}</div>
                    </div>
                    <span className={`text-sm font-semibold ${getScoreTextClass(value, { goodAt: 70, warningAt: 40 })}`}>{item.score ?? "-"}</span>
                  </div>
                  {item.effectLabel && (
                    <div className={`mt-1 text-[10px] font-semibold ${getEvidenceTone(item)}`}>{item.effectLabel}</div>
                  )}
                  <div className="mt-2 h-1 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden">
                    <div className={`h-1 rounded-full ${getScoreBgClass(value, { goodAt: 70, warningAt: 40 })}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
                  </div>
                  {item.note && (
                    <div className="mt-1 text-[10px] leading-snug theme-text-muted">{item.note}</div>
                  )}
                  {item.key === "attendanceEvidence" && breakdown.hasAttendanceTracking === false && (
                    <div className={`mt-1 text-[10px] font-semibold ${SCORE_TEXT.warning}`}>Attendance evidence not closed for this window</div>
                  )}
                </div>
              );
            })}
          </div>
          {attendanceContribution?.score != null && (
            <div className="mt-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-3 py-2 text-[10px] theme-text-muted">
              Attendance is supporting evidence for Professional Discipline. {attendanceSummary}
            </div>
          )}
        </div>
      )}

      {/* MY TASK STATS — outlines on canvas, status via text color */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "My Tasks",    value: myTotal,      color: "theme-text" },
          { label: "Completed",   value: myCompleted,  color: SCORE_TEXT.good },
          { label: "In Progress", value: myInProgress, color: "text-[color:var(--primary)]" },
          { label: "Overdue",     value: myOverdue,    color: myOverdue > 0 ? SCORE_TEXT.danger : "theme-text-muted" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-[color:var(--border)] p-3 text-center">
            <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] theme-text-muted mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* COMPLETION RATE BAR */}
      <div className="flex items-center gap-3">
        <span className="text-xs theme-text-muted w-28 shrink-0">Live completion</span>
        <div className="flex-1 bg-[var(--surface-soft)] rounded-full h-2">
          <div className="bg-[color:var(--text-soft)] h-2 rounded-full transition-all duration-700" style={{ width: `${myCompletionRate}%` }} />
        </div>
        <span className="text-xs font-bold text-[color:var(--text-soft)] w-8 text-right">{myCompletionRate}%</span>
      </div>

      {/* DIAGNOSTIC DRIVERS - behavioral drilldown */}
      {visibleDiagnosticDrivers.length > 0 && (
        <div>
          <div className="mb-3">
            <div className="text-xs font-semibold theme-text-muted uppercase tracking-wide">Behavioral / Diagnostic Drivers</div>
            <div className="text-xs theme-text-muted">Operating signals that explain the domains; these are not a separate score layer.</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleDiagnosticDrivers.map((driver) => {
              const value = Math.round(Number(driver.value ?? 0));
              const options = getDriverOptions(driver);
              const barColor = getScoreBgClass(value, options);
              const textColor = getDriverText(driver);
              const feedsLabel = Array.isArray(driver.feedsDomains) && driver.feedsDomains.length
                ? driver.feedsDomains.join(" / ")
                : driver.parentDomain;
              const impactLabel = driver.scoreAffecting === false
                ? "Context only"
                : driver.impactType === "direct_domain_input"
                  ? "Direct domain input"
                  : driver.impactType || "Domain signal";
              return (
                <div key={driver.key} className="border border-[color:var(--border)] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs theme-text font-semibold">{driver.label}</div>
                      <div className="truncate text-[10px] theme-text-muted">Feeds {feedsLabel}</div>
                    </div>
                    <span className={`text-sm font-semibold ${textColor}`}>{value}</span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase theme-text-muted">{impactLabel}</span>
                    {driver.effectLabel && (
                      <span className={`rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase ${driver.effectTone === "negative" ? SCORE_TEXT.danger : driver.effectTone === "positive" ? SCORE_TEXT.good : "theme-text-muted"}`}>
                        {driver.effectLabel}
                      </span>
                    )}
                  </div>
                  {driver.finalContributionLabel && (
                    <div className="mb-2 rounded-md bg-[color:var(--surface-soft)] px-2 py-1 text-[10px] theme-text-muted">
                      {driver.label} -&gt; {driver.domain || driver.parentDomain} -&gt; {driver.finalContributionLabel}
                    </div>
                  )}
                  <div className="w-full bg-[var(--surface-soft)] rounded-full h-1">
                    <div className={`${barColor} h-1 rounded-full transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
                  </div>
                  {driver.note && (
                    <div className="mt-1 text-[10px] theme-text-muted leading-snug">{driver.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RISK + SIGNALS — outline only, status via text color inside */}
      {risk && (
        <div className="rounded-lg border border-[color:var(--border)] p-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold theme-text-muted mb-1">Performance Risk</div>
            <div className={`text-xl font-semibold ${risk.level === "High" ? "text-[color:var(--overdue-text)]" : risk.level === "Medium" ? "text-[color:var(--text-soft)]" : "text-[color:var(--text-soft)]"}`}>
              {Math.round(risk.probability)}%
            </div>
            <div className="text-xs theme-text-muted mt-0.5">probability of underperformance</div>
          </div>
          {signals.length > 0 && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold theme-text-muted mb-1.5">Active Signals</div>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((s, i) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    risk.level === "High" ? "bg-[color:var(--overdue-bg)] text-[color:var(--overdue-text)]" : "bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]"
                  }`}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TREND */}
      {performanceTrend.length > 0 && (() => {
        const trendPoints = performanceTrend
          .map((point, index) => normalizeTrendPoint(point, index, dashboardRange, performanceTrend))
          .filter((point) => Number.isFinite(Number(point.score)));
        const singlePoint = trendPoints[0] || null;
        const tickInterval = dashboardChartTickInterval(dashboardRange, trendPoints.length);
        return (
        <div>
          <div className="text-xs font-semibold theme-text-muted uppercase tracking-wide mb-2">Score Trend</div>
          <div className="h-[120px] rounded-lg border border-[color:var(--border)] p-2">
            {trendPoints.length < 2 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-3">
                <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">
                  {trendPoints.length === 1 ? "Single snapshot available" : "No trend history yet"}
                </div>
                <div className="mt-1 text-xl font-semibold theme-text">
                  {singlePoint ? Math.round(Number(singlePoint.score)) : "-"}
                </div>
                <p className="mt-1 text-[10px] theme-text-muted">
                  {dashboardRangeLabel(dashboardRange)} needs at least two snapshots for a trendline.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendPoints} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipLabel || label}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        );
      })()}

      {/* PROJECT BREAKDOWN */}
      {projectPerformance.length > 0 && (
        <div>
          <div className="text-xs font-semibold theme-text-muted uppercase tracking-wide mb-2">By Project</div>
          <div className="space-y-2">
            {projectPerformance.map((proj) => (
              <div key={proj.project_id} className="flex items-center gap-3">
                <span className="text-xs theme-text-muted w-32 truncate shrink-0">{proj.project_name || proj.projectName}</span>
                <div className="flex-1 bg-[var(--surface-soft)] rounded-full h-2">
                  <div className={`h-2 rounded-full ${getScoreBgClass(proj.score)}`} style={{ width: `${proj.score || 0}%` }} />
                </div>
                <span className={`text-xs font-bold w-8 text-right ${getScoreTextClass(proj.score)}`}>{proj.score || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COACHING — outlined rows on canvas, no fills */}
      {coaching.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold theme-text-muted uppercase tracking-[0.14em] mb-2">Recommendations</div>
          <div className="space-y-2">
            {coaching.map((nudge, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 border border-[color:var(--border)] rounded-lg px-3 py-2.5"
              >
                <span className="text-[color:var(--primary)] mt-0.5 shrink-0 font-semibold">→</span>
                <span className="text-xs theme-text leading-relaxed">
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
{/* Workspace Overview — merged task counts + org intelligence */}
{isAdmin && (() => {
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const avg = intelligence?.orgScore?.averageScore;
  const scoreColor = getScoreTextClass(avg);
  const scoreBg = getScoreSurfaceClass(avg);

  const taskTiles = [
    {
      label: "Overdue Tasks",
      value: overdueCount,
      sub: overdueCount > 5 ? "⚠ High pressure" : overdueCount > 0 ? "Needs attention" : "✓ All on track",
      icon: <AlertTriangle className="w-4 h-4" />,
      valueClass: overdueCount > 0 ? SCORE_TEXT.danger : "theme-text-muted",
      bg: overdueCount > 0 ? SCORE_SURFACE.danger : SCORE_SURFACE.neutral,
      iconBg: overdueCount > 0 ? "bg-[color:var(--score-danger-bg)] text-[color:var(--score-danger)]" : "bg-[color:var(--surface-soft)] theme-text-muted",
    },
    {
      label: "In Progress",
      value: inProgressCount,
      sub: `of ${totalTasks} total tasks`,
      icon: <Clock className="w-4 h-4" />,
      valueClass: "text-[color:var(--primary)]",
      bg: "border-[color:var(--primary)]/20",
      iconBg: "text-[color:var(--primary)]",
    },
    {
      label: "Completed",
      value: completedCount,
      sub: totalTasks > 0 ? `${Math.round((completedCount / totalTasks) * 100)}% rate` : "No tasks yet",
      icon: <CheckSquare className="w-4 h-4" />,
      valueClass: SCORE_TEXT.good,
      bg: SCORE_SURFACE.good,
      iconBg: "bg-[color:var(--surface-soft)] text-[color:var(--primary)]",
    },
    {
      label: "Projects",
      value: totalProjects,
      sub: monthLabel,
      icon: <FolderKanban className="w-4 h-4" />,
      valueClass: "text-[color:var(--primary)]",
      bg: "border-[color:var(--primary)]/20",
      iconBg: "text-[color:var(--primary)]",
    },
  ];

  const intelligenceTiles = intelligence ? [
    {
      label: "Org Avg Score",
      value: avg != null ? Number(avg).toFixed(1) : "—",
      sub: monthLabel,
      icon: <BarChart2 className="w-4 h-4" />,
      valueClass: scoreColor,
      bg: scoreBg,
      iconBg: avg == null ? "bg-[var(--surface-strong)] theme-text-muted" : `${getScoreSurfaceClass(avg)} ${getScoreTextClass(avg)}`,
    },
    {
      label: "Total Members",
      value: intelligence.orgScore.userCount,
      sub: "in workspace",
      icon: <Users className="w-4 h-4" />,
      valueClass: "text-[color:var(--primary)]",
      bg: "border-[color:var(--primary)]/20",
      iconBg: "text-[color:var(--primary)]",
    },
    {
      label: "High Performers",
      value: intelligence.orgScore.highPerformers,
      sub: "score ≥ 80",
      icon: <TrendingUp className="w-4 h-4" />,
      valueClass: SCORE_TEXT.good,
      bg: SCORE_SURFACE.good,
      iconBg: "bg-[color:var(--surface-soft)] text-[color:var(--primary)]",
    },
    {
      label: "At Risk",
      value: intelligence.orgScore.atRiskUsers,
      sub: "need attention",
      icon: <AlertTriangle className="w-4 h-4" />,
      valueClass: intelligence.orgScore.atRiskUsers > 0 ? SCORE_TEXT.danger : "theme-text-muted",
      bg: intelligence.orgScore.atRiskUsers > 0 ? SCORE_SURFACE.danger : SCORE_SURFACE.neutral,
      iconBg: intelligence.orgScore.atRiskUsers > 0 ? "bg-[color:var(--score-danger-bg)] text-[color:var(--score-danger)]" : "bg-[var(--surface-strong)] theme-text-muted",
    },
  ] : [];

  const renderTile = (tile) => (
    <div key={tile.label} className={`rounded-lg border p-4 flex items-start gap-3 ${tile.bg}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tile.iconBg}`}>
        {tile.icon}
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-semibold leading-none ${tile.valueClass}`}>{tile.value}</div>
        <div className="text-[11px] font-semibold theme-text mt-1 truncate">{tile.label}</div>
        <div className="text-[10px] theme-text-muted truncate">{tile.sub}</div>
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl border border-[color:var(--border)] p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold theme-text">Workspace Overview</h2>
          <p className="text-xs theme-text-muted mt-0.5">{monthLabel}</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full text-[color:var(--primary)] font-semibold border border-[color:var(--primary)]/20">
          {intelligence ? "Intelligence" : "Live"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {taskTiles.map(renderTile)}
      </div>
      {intelligence && (
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[var(--border)]">
          {intelligenceTiles.map(renderTile)}
        </div>
      )}
    </section>
  );
})()}

      {/* Top Performers */}
      {isAdmin && intelligence?.leaderboard?.length > 0 && (() => {
  const medals = ["🥇", "🥈", "🥉"];
  const rankColors = [
    "bg-[color:var(--surface-strong)] border-[color:var(--border)] text-[color:var(--text-soft)]",
    "bg-[var(--surface-soft)] border-[var(--border)] theme-text-muted",
    "bg-[color:var(--surface-strong)] border-[color:var(--border)] text-[color:var(--text-soft)]",
  ];

  return (
    <section className="border border-[color:var(--border)] rounded-lg p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[color:var(--surface-strong)] flex items-center justify-center">
          <Trophy className="w-4 h-4 text-[color:var(--text-soft)]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold theme-text">Top Performers</h2>
          <p className="text-[10px] theme-text-muted">This month's leaderboard</p>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {intelligence.leaderboard.map((u, index) => {
          const score = Number(u.score) || 0;
          const scoreColor = getScoreTextClass(score);
          const barColor = getScoreBgClass(score);
          const initials  = (u.username || "?").slice(0, 2).toUpperCase();
          const isTop3    = index < 3;

          return (
            <div
              key={`${u.userId || u.username}-${index}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--surface-soft)] transition-colors group"
            >
              {/* Rank */}
              {isTop3 ? (
                <span className="text-base w-6 text-center shrink-0">{medals[index]}</span>
              ) : (
                <span className="text-xs font-bold theme-text-muted w-6 text-center shrink-0">
                  #{index + 1}
                </span>
              )}

              {/* Avatar */}
              {u.userId ? (
                <Link to={getUserProfilePath(u.userId, auth.user?.id)} className="flex items-center gap-3 min-w-0 flex-1 hover:text-[var(--primary)]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isTop3 ? rankColors[index] + " border" : "bg-[var(--surface-soft)] theme-text-muted border border-[var(--border)]"
                  }`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold theme-text truncate">{u.username}</div>
                    <div className="mt-1 w-full bg-[var(--surface-soft)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ) : (
                <>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isTop3 ? rankColors[index] + " border" : "bg-[var(--surface-soft)] theme-text-muted border border-[var(--border)]"
                  }`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold theme-text truncate">{u.username}</div>
                    <div className="mt-1 w-full bg-[var(--surface-soft)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Score */}
              <span className={`text-sm font-bold shrink-0 ${scoreColor}`}>{score}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
})()}
</div>

{isAdmin && dashboardForecast && (() => {
  const rawForecastTrend = dashboardForecast.trend || dashboardForecast.direction || "stable";
  const forecastTrend =
    rawForecastTrend === "up"
      ? "improving"
      : rawForecastTrend === "down"
      ? "declining"
      : rawForecastTrend === "flat"
      ? "stable"
      : rawForecastTrend;
  const predictedAverage = dashboardForecast.predictedAverage ?? dashboardForecast.currentScore ?? "Needs history";
  const riskProjection = dashboardForecast.riskProjection ?? intelligence?.execution?.risk ?? "unknown";
  const outlookText =
    dashboardOverview?.executiveSummary?.outlook ||
    executiveSummary?.outlook ||
    dashboardForecast?.reasoning ||
    null;
  const riskProjectionTone =
    String(riskProjection).toLowerCase() === "high"
      ? SCORE_TEXT.danger
      : String(riskProjection).toLowerCase() === "low"
      ? SCORE_TEXT.good
      : SCORE_TEXT.warning;
  const recommendedAction =
    forecastTrend === "declining"
      ? "Intervention recommended. Focus on overdue workload and coaching reinforcement."
      : forecastTrend === "improving"
      ? "Momentum positive. Maintain execution cadence and reinforce high performers."
      : "Performance stable. Monitor workload balance and prevent execution drift.";

  return (
  <section className="border border-[color:var(--border)] rounded-lg p-6 space-y-4">

    <div className="flex justify-between items-center">
      <h2 className="text-sm font-semibold">
        Next Month Outlook
      </h2>

      <span className="text-xs px-2 py-1 rounded-full theme-surface-soft theme-text font-medium">
        {forecastTrend} - {dashboardRangeLabel(dashboardRange)}
      </span>
    </div>

    {/* Data Signals */}
    <div className="grid md:grid-cols-3 gap-6 text-sm">

      <div>
        <div className="theme-text-muted">Predicted Average</div>
        <div className={`font-semibold ${typeof predictedAverage === "number" ? "text-2xl" : "text-sm theme-text-muted"}`}>
          {predictedAverage}
        </div>
      </div>

      <div>
        <div className="theme-text-muted">Trend Direction</div>
        <div className={`text-lg font-semibold ${
          forecastTrend === "declining"
            ? SCORE_TEXT.danger
            : forecastTrend === "improving"
            ? SCORE_TEXT.good
            : SCORE_TEXT.warning
        }`}>
          {forecastTrend}
        </div>
      </div>

      <div>
        <div className="theme-text-muted">Risk Projection</div>
        <div className={`text-lg font-semibold ${riskProjectionTone}`}>
          {riskProjection}
        </div>
      </div>

    </div>

    {/* AI Interpretation */}
    {outlookText && (
      <div className="border-t pt-4">
        <div className="text-xs font-semibold theme-text-muted mb-2">
          EXECUTIVE OUTLOOK INTERPRETATION
        </div>

        <p className="text-sm theme-text leading-relaxed">
          {outlookText}
        </p>
      </div>
    )}

    {/* AI Decision Guidance */}
<div className="border-t pt-4 mt-4">
  <div className="text-xs font-semibold theme-text-muted mb-2">
    RECOMMENDED ACTION
  </div>

  <p className="text-sm theme-text">
    {recommendedAction}
  </p>
</div>

    {/* ✅ AI Forecast Reasoning */}
{dashboardForecast?.reasoning && (
  <div className="mt-5 border-t pt-4">
    <button
      onClick={() => setForecastReasoningOpen(true)}
      className="text-xs font-semibold text-[color:var(--primary)] hover:opacity-80"
    >
      View forecast evidence
    </button>
  </div>
)}
  </section>
  );
})()}
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          {/* ===============================
   WORKSPACE HEALTH PULSE (admin only)
================================ */}
{isAdmin && (
<section className="rounded-lg p-4 border border-[color:var(--border)]">
  <div className="flex justify-between items-center mb-2">
    <div className="flex items-center gap-1.5">
      <h2 className="text-sm font-semibold">
        Workspace Health Pulse
      </h2>
      {workspaceScoreExplanation && (
        <div className="relative group">
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--border)] theme-text-muted hover:text-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
            aria-label="Show workspace health calculation"
          >
            <Info className="h-3 w-3" />
          </button>
          <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-30 hidden w-[min(94vw,500px)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left shadow-xl group-hover:block group-focus-within:block">
            <div className="text-[10px] font-bold uppercase tracking-wide theme-text-muted">Canonical Health Score</div>
            <div className="mt-1 text-sm font-semibold theme-text">
              {workspaceScoreCalculation.finalScore ?? workspaceScoreExplanation.finalScore}/100 from {workspaceScoreCalculation.scoreAuthority || "workspace_intelligence.score"}
            </div>
            <p className="mt-2 text-[11px] leading-snug theme-text-muted">{workspaceScoreCalculation.formulaReadable || workspaceScoreExplanation.summary}</p>
            {workspaceFormulaComponents.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-[color:var(--border)] pt-3">
                {workspaceFormulaComponents.slice(0, 5).map((part) => (
                  <div key={part.key} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="truncate theme-text-muted">{part.label}</span>
                    <span className="font-semibold theme-text">{part.contributionPoints}</span>
                  </div>
                ))}
                {workspaceScoreCalculation.rawScoreBeforeRounding != null && (
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="theme-text-muted">Raw to rounded</span>
                    <span className="font-semibold theme-text">{workspaceScoreCalculation.rawScoreBeforeRounding} -&gt; {workspaceScoreCalculation.finalRoundedScore ?? workspaceScoreCalculation.finalScore}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 space-y-1.5 border-t border-[color:var(--border)] pt-3">
              {workspaceScoreDomains.slice(0, 8).map((domain) => (
                <div key={domain.key} className="grid grid-cols-[1fr_auto_auto] gap-3 text-[11px]">
                  <span className="truncate theme-text-muted">{domain.label}</span>
                  <span className="font-semibold theme-text">{domain.score} x {formatWeightPercent(domain.configuredWeight ?? domain.weight)}</span>
                  <span className="font-semibold text-[color:var(--primary)]">{domain.weightedContributionPoints}</span>
                </div>
              ))}
            </div>
            {workspaceAttendanceContribution && (
              <div className="mt-3 border-t border-[color:var(--border)] pt-3 text-[11px] theme-text-muted">
                Attendance Readiness: {workspaceAttendanceContribution.score}/100 x {formatWeightPercent(workspaceAttendanceContribution.configuredWeight ?? workspaceAttendanceContribution.weight)} = {workspaceAttendanceContribution.weightedContributionPoints}; path {workspaceAttendanceContribution.directOrIndirect || "direct"}.
              </div>
            )}
            {workspaceScorePropagation && (
              <p className="mt-3 border-t border-[color:var(--border)] pt-3 text-[11px] leading-snug theme-text-muted">
                {workspaceScorePropagation.summary}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
    <span
  className={`text-xs font-semibold ${
    healthScore === null
      ? "theme-text-muted"
      : getScoreTextClass(healthScore)
  }`}
>
  {healthScore === null ? "Analyzing…" : `${Math.round(healthScore)}%`}
</span>
  </div>

  <div className="w-full theme-surface-soft rounded-full h-2 overflow-hidden">
    <div
      className={`h-2 rounded-full transition-all duration-700 ${healthScore === null ? SCORE_BG.neutral : getScoreBgClass(healthScore)}`}
      style={{
        width: `${healthScore ?? 0}%`,
      }}
    />
  </div>

  <p className="text-[11px] theme-text-muted mt-2">
    Live organizational health refreshed through canonical enterprise intelligence.
  </p>
</section>
)}
          <p className="text-xs theme-text-muted">
            Role: {role}. Showing an overview of projects and tasks you are allowed
            to access.
          </p>
        </div>
      </section>

      {/* High-level stats */}
      <section className="rounded-2xl border border-[color:var(--border)] p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
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
          <div className="text-lg font-semibold text-[color:var(--overdue-text)]">
            {overdueCount}
          </div>
        </div>
      </section>

      {/* ── Quick-glance row: My Tasks · Role · Projects ── */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* My Tasks card */}
        <div className="border border-[color:var(--border)] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[color:var(--primary)]" />
              <span className="text-sm font-semibold theme-text">My Tasks</span>
            </div>
            <Link
              to={isAdmin || isManager ? "/my-tasks?tab=mine" : "/my-tasks"}
              className="flex items-center gap-1 text-xs text-[color:var(--primary)] hover:opacity-80 font-medium"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[color:var(--border)] px-3 py-2.5 text-center">
              <div className="text-xl font-semibold text-[color:var(--text)]">{myTasks.length}</div>
              <div className="text-[10px] text-[color:var(--text-muted)] font-medium mt-0.5">Total assigned</div>
            </div>
            <Link
              to={isAdmin || isManager ? "/my-tasks?tab=mine" : "/my-tasks"}
              className="rounded-lg border border-[color:var(--border)] px-3 py-2.5 text-center block transition-colors hover:bg-[var(--surface-soft)]"
            >
              <div className={`text-xl font-semibold ${myOverdueTasks.length > 0 ? "text-[color:var(--overdue-text)]" : "text-[color:var(--text-soft)]"}`}>
                {myOverdueTasks.length}
              </div>
              <div className={`text-[10px] font-medium mt-0.5 ${myOverdueTasks.length > 0 ? "text-[color:var(--overdue-text)]" : "text-[color:var(--text-soft)]"}`}>
                {myOverdueTasks.length > 0 ? "Overdue" : "All on time"}
              </div>
            </Link>
          </div>
          {myTasks.filter(t => t.status === "in-progress" || t.status === "in_progress").length > 0 && (
            <div className="flex items-center gap-2 text-xs theme-text-muted">
              <Clock className="w-3 h-3 text-[color:var(--primary)]" />
              <span>{myTasks.filter(t => t.status === "in-progress" || t.status === "in_progress").length} in progress</span>
            </div>
          )}
        </div>

        {/* Role card */}
        <div className="border border-[color:var(--border)] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {isAdmin ? <Shield className="w-4 h-4 brand-orange-text" /> : <Users className="w-4 h-4 brand-orange-text" />}
            <span className="text-sm font-semibold theme-text capitalize">{role} Access</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full brand-orange-text border brand-orange-border font-semibold capitalize">{role}</span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "View & manage projects", to: "/projects" },
              { label: isAdmin ? "Admin panel & users" : "Team tasks", to: isAdmin ? "/admin/users" : "/my-tasks" },
              ...(isAdmin ? [{ label: "Enterprise settings", to: "/enterprise" }] : []),
              { label: "Goals", to: "/okr" },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[color:var(--surface-soft)] transition-colors group"
              >
                <span className="text-xs theme-text-muted group-hover:theme-text">{item.label}</span>
                <ChevronRight className="w-3 h-3 text-[color:var(--border)] group-hover:theme-text-muted" />
              </Link>
            ))}
          </div>
        </div>

        {/* Projects card */}
        <div className="border border-[color:var(--border)] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[color:var(--primary)]" />
              <span className="text-sm font-semibold theme-text">Projects</span>
            </div>
            <Link
              to="/projects"
              className="flex items-center gap-1 text-xs text-[color:var(--primary)] hover:opacity-80 font-medium"
            >
              All projects <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <p className="text-xs theme-text-muted text-center py-4">No projects yet</p>
            ) : (
              projects.slice(0, 8).map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[color:var(--surface-soft)] transition-colors group"
                >
                  <span className="text-xs font-medium theme-text truncate max-w-[150px]">{p.name}</span>
                  <ChevronRight className="w-3 h-3 text-[color:var(--border)] group-hover:theme-text-muted shrink-0" />
                </Link>
              ))
            )}
          </div>
          {projects.length > 8 && (
            <Link to="/projects" className="text-xs text-[color:var(--primary)] hover:opacity-80 text-center font-medium">
              +{projects.length - 8} more projects
            </Link>
          )}
        </div>
      </div>

      {/* Top overdue tasks */}
      <section className="rounded-2xl border border-[color:var(--border)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[color:var(--overdue-text)]" />
            <h2 className="text-sm font-semibold theme-text">Overdue Tasks</h2>
            {topOverdue.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--overdue-bg)] text-[color:var(--overdue-text)] border border-[color:var(--overdue-border)] font-bold">
                {topOverdue.length}
              </span>
            )}
          </div>
          <Link
            to="/my-tasks?tab=overdue"
            className="flex items-center gap-1 text-xs text-[color:var(--primary)] hover:opacity-80 font-medium"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading && (
          <div className="text-sm theme-text-muted">Loading...</div>
        )}

        {!loading && topOverdue.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-full bg-[color:var(--surface-soft)] flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-[color:var(--text-soft)]" />
            </div>
            <p className="text-sm font-medium text-[color:var(--text-soft)]">All tasks on track</p>
            <p className="text-xs theme-text-muted">No overdue tasks in your scope</p>
          </div>
        )}

        <div className="space-y-2">
          {topOverdue.map((t) => {
            const projectId = t.project_id || t._project?.id;
            const projectName = t.project_name || t._project?.name || "Unknown";
            const daysOverdue = t.due_date
              ? Math.floor((Date.now() - new Date(t.due_date)) / 86400000)
              : null;
            const priority = t.priority;
            const taskTitle = t.task || t.title;

            const card = (
              <div className="flex items-start justify-between gap-3 border border-[color:var(--overdue-border)] bg-[color:var(--overdue-bg)] hover:bg-[color:var(--overdue-bg)]/80 transition-colors rounded-lg px-4 py-3 cursor-pointer group">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0 w-2 h-2 rounded-full bg-[color:var(--overdue-text)] mt-1.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[color:var(--overdue-text)] truncate group-hover:opacity-80">
                      {taskTitle}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-[color:var(--overdue-text)] font-medium">
                        {projectName}
                      </span>
                      {priority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          priority === "high" ? "bg-[color:var(--overdue-bg)] text-[color:var(--overdue-text)]" :
                          priority === "medium" ? "bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" :
                          "bg-[color:var(--surface-soft)] theme-text-muted"
                        }`}>{priority}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-bold text-[color:var(--overdue-text)]">
                    {daysOverdue !== null ? `${daysOverdue}d` : ""}
                  </div>
                  <div className="text-[10px] text-[color:var(--overdue-text)] mt-0.5">overdue</div>
                </div>
              </div>
            );

            return projectId ? (
              <Link key={t.id} to={`/projects/${projectId}`}>
                {card}
              </Link>
            ) : (
              <div key={t.id}>{card}</div>
            );
          })}
        </div>
      </section>

      {/* ===============================
    FORECAST REASONING MODAL
================================ */}
{forecastReasoningOpen && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="theme-surface theme-text border theme-border w-full max-w-2xl rounded-lg shadow-xl p-6 relative">

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
  {dashboardForecast?.reasoning || "Forecast reasoning unavailable"}
</div>
    </div>
  </div>
)}

      {error && (
        <div className="text-sm theme-overdue-text theme-overdue-card border rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {executiveDetailOpen && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="theme-surface theme-text border theme-border rounded-lg shadow-xl w-[920px] max-w-[94%] p-6 relative max-h-[86vh] overflow-y-auto">

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
          Evidence
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

              {Array.isArray(executiveDetail.sections) && executiveDetail.sections.length > 0 ? (
                <div className="grid gap-3">
                  {executiveDetail.sections.map((section) => (
                    <div key={section.key || section.title} className="rounded-lg border border-[color:var(--border)] p-3">
                      <div className="text-xs font-semibold theme-text-muted mb-1">{section.title}</div>
                      <div className="text-sm theme-text leading-relaxed">{section.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="text-xs font-semibold theme-text-muted mb-2">FULL EXECUTIVE SUMMARY</div>
                  <div className="text-sm theme-text whitespace-pre-line leading-relaxed">
                    {executiveDetail.fullSummary}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold theme-text-muted mb-2">RECOMMENDATIONS</div>
                <ul className="space-y-2 text-sm theme-text list-disc list-inside">
                  {(executiveDetail.recommendations || executiveDetail.priorities || []).map((line, idx) => (
                    <li key={idx}>
                      {typeof line === "string"
                        ? line
                        : [line.priority, line.action, line.rationale].filter(Boolean).join(": ")}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {executiveModalView === "reasoning" && (
            <div>
              <div className="text-xs font-semibold theme-text-muted mb-2">EVIDENCE AND REUSE POLICY</div>
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
