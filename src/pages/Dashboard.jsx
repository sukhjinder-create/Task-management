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
 
// ASANA VIEWER STATE

const [asanaOpen, setAsanaOpen] = useState(false);
const [asanaProjects, setAsanaProjects] = useState([]);
const [asanaTasks, setAsanaTasks] = useState([]);
const [selectedAsanaProject, setSelectedAsanaProject] = useState(null);
const [asanaLoading, setAsanaLoading] = useState(false);
const [asanaPage, setAsanaPage] = useState(1);
const [asanaSearch, setAsanaSearch] = useState("");
const [asanaHasMore, setAsanaHasMore] = useState(false);
const [asanaMigrating, setAsanaMigrating] = useState(false);

// YOUTRACK VIEWER STATE

const [youtrackOpen, setYoutrackOpen] = useState(false);
const [youtrackProjects, setYoutrackProjects] = useState([]);
const [youtrackTasks, setYoutrackTasks] = useState([]);
const [selectedYoutrackProject, setSelectedYoutrackProject] = useState(null);
const [youtrackLoading, setYoutrackLoading] = useState(false);

  // ======================================
// INTEGRATIONS
// ======================================
function connectAsana() {
  const token = window.__AUTH_TOKEN__;

  if (!token) {
    toast.error("Authentication missing. Please login again.");
    return;
  }

  window.location.href =
    `${import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"}/oauth/asana/connect?token=${token}`;
}

async function connectYouTrack() {
  try {
    await api.post("/integrations/youtrack/connect", {
      baseUrl: "https://loop.youtrack.cloud",
      token: prompt("Paste YouTrack Permanent Token"),
    });

    toast.success("YouTrack connected");
  } catch (err) {
    toast.error("YouTrack connection failed");
  }
}

async function openAsanaViewer() {
  try {
    setAsanaOpen(true);
    setAsanaLoading(true);

    const res = await api.get("/integrations/asana/projects");

    setAsanaProjects(res.data || []);
  } catch (err) {
    toast.error("Failed to load Asana projects");
    console.error(err);
  } finally {
    setAsanaLoading(false);
  }
}

async function openYouTrackViewer() {
  try {
    setYoutrackOpen(true);
    setYoutrackLoading(true);

    const res = await api.get(
      "/integrations/youtrack/projects",
      {
        headers: { "Cache-Control": "no-cache" },
      }
    );

    // ✅ DEBUG — KEEP THIS
    console.log("RAW RESPONSE:", res);
    console.log("DATA:", res.data);

    // ✅ SAFE NORMALIZATION (handles ALL shapes)
    const projects =
      Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

    console.log("NORMALIZED PROJECTS:", projects);

    setYoutrackProjects(projects);

  } catch (err) {
    console.error("YouTrack load error:", err);
    toast.error("Failed to load YouTrack projects");
  } finally {
    setYoutrackLoading(false);
  }
}

async function loadAsanaProject(project, page = 1, search = "") {

  if (asanaLoading) return;

  try {
    setSelectedAsanaProject({
      gid: project.gid,
      name: project.name,
    });

    setAsanaLoading(true);

    const res = await api.get(
      `/integrations/asana/projects/${project.gid}/tasks`,
      {
        params: {
          page,
          limit: 25,
          search
        }
      }
    );

    setAsanaTasks(res.data.data || []);
    setAsanaHasMore(res.data.hasMore);
    setAsanaPage(page);

  } catch (err) {
    toast.error("Failed to load tasks");
  } finally {
    setAsanaLoading(false);
  }
}

async function loadYouTrackProject(project) {
  try {
    setSelectedYoutrackProject(project);
    setYoutrackLoading(true);

    const res = await api.get(
      `/integrations/youtrack/projects/${project.key}/tasks`
    );

    setYoutrackTasks(res.data.data || []);
  } catch {
    toast.error("Failed to load issues");
  } finally {
    setYoutrackLoading(false);
  }
}

async function migrateAsanaProject() {
  if (!selectedAsanaProject?.gid) return;

  try {
    setAsanaMigrating(true);

    await api.post(
      `/integrations/asana/projects/${selectedAsanaProject.gid}/migrate`
    );

    toast.success("✅ Project imported");

  } catch (err) {
    console.error(err);
    toast.error("Migration failed");
  } finally {
    setAsanaMigrating(false);
  }
}

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
  if (!selectedAsanaProject?.gid) return;

  loadAsanaProject(
    selectedAsanaProject,
    asanaPage,
    asanaSearch
  );

}, [asanaPage, asanaSearch]);

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
  if (!myPerformance) return null;

  const risk = myPerformance?.intelligence?.risk?.level;
  const overdue = overdueCount;
  const trend = intelligence?.forecast?.trend;

  if (risk === "High" && overdue > 3) {
    return {
      type: "critical",
      message:
        "Execution risk rising. Overdue workload and behavioral signals indicate potential performance decline.",
    };
  }

  if (trend === "declining") {
    return {
      type: "warning",
      message:
        "Performance momentum is declining. Early intervention recommended before productivity drops further.",
    };
  }

  if (trend === "improving" && risk === "Low") {
    return {
      type: "positive",
      message:
        "Performance momentum improving. Current execution patterns are strengthening organizational stability.",
    };
  }

  return {
    type: "neutral",
    message:
      "Workspace operating within normal parameters. No immediate intervention required.",
  };
}, [myPerformance, overdueCount, intelligence]);

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
  <div className="space-y-6">

{/* ======================================
   AUTONOMOUS AI INSIGHT CARD
====================================== */}

{autonomousInsight && (
  <Card
    className={
      autonomousInsight.type === "critical"
        ? "bg-danger-50 border-danger-200"
        : autonomousInsight.type === "warning"
        ? "bg-warning-50 border-warning-200"
        : autonomousInsight.type === "positive"
        ? "bg-success-50 border-success-200"
        : "theme-surface-soft theme-border"
    }
  >
    <Card.Content className="flex items-start gap-3">
      <div className="text-2xl">
        {autonomousInsight.type === "critical" && "🔴"}
        {autonomousInsight.type === "warning" && "⚠️"}
        {autonomousInsight.type === "positive" && "✅"}
        {autonomousInsight.type === "neutral" && "🧠"}
      </div>

      <div className="flex-1">
        <Badge
          color={
            autonomousInsight.type === "critical" ? "danger" :
            autonomousInsight.type === "warning" ? "warning" :
            autonomousInsight.type === "positive" ? "success" :
            "neutral"
          }
          size="sm"
          className="mb-2"
        >
          AI Autonomous Insight
        </Badge>

        <p className="text-sm theme-text leading-relaxed">
          {autonomousInsight.message}
        </p>
      </div>
    </Card.Content>
  </Card>
)}

      {/* ======================================
   WORKSPACE CONTROL CENTER — AI ATTENTION
====================================== */}

{(isAdmin || isManager || isUser) && (
  <Card className="theme-surface-strong theme-text border theme-border">
    <Card.Content>
      <h2 className="text-base font-semibold mb-4">
        Workspace Control Center
      </h2>

      <div className="grid md:grid-cols-4 gap-4">
        {/* Risk Status */}
        <div className="theme-surface-soft rounded-lg p-4 border theme-border">
          <div className="text-sm theme-text-muted">Current Risk State</div>
          <div className="text-xl font-semibold mt-1">
            {myPerformance?.intelligence?.risk?.level || "Analyzing"}
          </div>
        </div>

        {/* Overdue Pressure */}
        <div className="theme-surface-soft rounded-lg p-4 border theme-border">
          <div className="text-sm theme-text-muted">Execution Pressure</div>
          <div className="text-xl font-semibold mt-1">
            {overdueCount > 5
              ? "High"
              : overdueCount > 0
              ? "Moderate"
              : "Stable"}
          </div>
        </div>

        {/* Momentum */}
        <div className="theme-surface-soft rounded-lg p-4 border theme-border">
          <div className="text-sm theme-text-muted">Performance Momentum</div>
          <div className="text-xl font-semibold mt-1">
            {intelligence?.forecast?.trend || "Stable"}
          </div>
        </div>

        {/* Integrations */}
        <div className="theme-surface-soft rounded-lg p-4 border theme-border">
          <div className="text-sm theme-text-muted mb-3">External Integrations</div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={connectAsana} size="xs" variant="primary">
              Asana Connect
            </Button>

            <Button onClick={openAsanaViewer} size="xs" variant="secondary">
              Asana Open
            </Button>

            <Button onClick={connectYouTrack} size="xs" className="bg-warning-600 hover:bg-warning-700">
              YouTrack
            </Button>

            <Button onClick={openYouTrackViewer} size="xs" variant="secondary">
              YT Open
            </Button>
          </div>

          <div className="text-xs theme-text-muted mt-2">
            Allow AI to observe external work activity.
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
{myPerformance && (
  <Card>
    <Card.Content className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <Card.Title>
          My Performance – {new Date().toISOString().slice(0, 7)}
        </Card.Title>

        <div className="text-right">
          <div className="text-4xl font-bold text-primary-600">
            {myPerformance.score}
          </div>
          <Badge
            color={
              myPerformance.score >= 75 ? "success" :
              myPerformance.score >= 50 ? "warning" :
              "danger"
            }
            size="sm"
            className="mt-1"
          >
            {getRiskLevel(myPerformance.score).label}
          </Badge>
        </div>
      </div>

    {/* PROGRESS BAR */}
    <div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${myPerformance.score}%` }}
        />
      </div>
    </div>

    {/* EXPLANATION */}
    {myPerformance.explanation && (
      <div className="text-sm text-slate-600">
        {myPerformance.explanation}
      </div>
    )}

    {/* TREND (LAST 3 MONTHS) */}
    {performanceTrend.length > 0 && (
      <div>
        <h3 className="text-sm font-semibold mb-2">Performance Trend</h3>
        <div className="flex gap-4">
          {performanceTrend.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center text-xs"
            >
              <div className="text-slate-500">{item.month}</div>
              <div className="font-semibold text-indigo-600">
                {item.score}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* PROJECT-WISE PERFORMANCE */}
    {projectPerformance.length > 0 && (
      <div>
        <h3 className="text-sm font-semibold mb-2">
          Project-wise Productivity
        </h3>

        <div className="space-y-2">
          {projectPerformance.map((proj) => (
            <div
              key={proj.project_id}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs"
            >
              <div className="flex justify-between mb-1">
                <span className="font-semibold">
                  {proj.project_name || proj.projectName}
                </span>
                <span className="font-bold text-indigo-600">
                  {proj.score || 0}
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full"
                  style={{ width: `${proj.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ================================
    BEHAVIORAL INTELLIGENCE
================================ */}
{myPerformance.intelligence && (
  <div className="mt-6 space-y-5">

    <h3 className="text-sm font-semibold">
      Behavioral Intelligence Profile
    </h3>

    {/* DIMENSIONS */}
    <div className="grid md:grid-cols-2 gap-4 text-xs">
      {Object.entries(myPerformance.intelligence.dimensions).map(
        ([key, value]) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <span className="capitalize text-slate-600">
                {key.replace(/([A-Z])/g, " $1")}
              </span>
              <span className="font-semibold">
                {Math.round(value)}
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        )
      )}
    </div>

    {/* RISK */}
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
      <div className="flex justify-between">
        <span className="font-semibold">Risk Probability</span>
        <span className={`font-bold ${
          myPerformance.intelligence.risk.level === "High"
            ? "text-red-600"
            : myPerformance.intelligence.risk.level === "Medium"
            ? "text-amber-600"
            : "text-emerald-600"
        }`}>
          {Math.round(myPerformance.intelligence.risk.probability)}%
          {" "}({myPerformance.intelligence.risk.level})
        </span>
      </div>
    </div>

    {/* SIGNALS */}
    {myPerformance.intelligence.signals?.length > 0 && (
      <div>
        <h4 className="text-xs font-semibold mb-2">
          Detected Behavioral Signals
        </h4>

        <div className="flex flex-wrap gap-2">
          {myPerformance.intelligence.signals.map((s, idx) => (
            <span
              key={idx}
              className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
)}

    {/* COACHING */}
    {Array.isArray(myPerformance.coaching) &&
      myPerformance.coaching.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Coaching Suggestions
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {myPerformance.coaching.map((nudge, idx) => (
  <li
    key={idx}
    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
  >
    {typeof nudge === "string"
      ? nudge
      : nudge.message || nudge.action}
  </li>
))}
          </ul>
        </div>
      )}
    </Card.Content>
  </Card>
)}
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

{/* =====================================
   ASANA FULLSCREEN VIEWER
===================================== */}
{asanaOpen && (
  <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">

    {/* HEADER */}
    <div className="theme-surface px-6 py-4 flex justify-between items-center border-b theme-border">
      <div className="flex items-center gap-3">

  {selectedAsanaProject && (
    <button
      onClick={() => {
        setSelectedAsanaProject(null);
        setAsanaTasks([]);
      }}
      className="text-xs theme-surface-soft theme-text px-2 py-1 rounded"
    >
      ← Back
    </button>
  )}

  <h2 className="font-semibold">
    {selectedAsanaProject
      ? `Asana — ${selectedAsanaProject.name}`
      : "Asana Projects"}
  </h2>

</div>

      <button
        onClick={() => {
          setAsanaOpen(false);
          setSelectedAsanaProject(null);
          setAsanaTasks([]);
        }}
        className="theme-text-muted hover:text-[var(--text)]"
      >
        ✕
      </button>
    </div>

    {/* BODY */}
    <div className="flex-1 theme-bg overflow-auto p-6">

      {asanaLoading && (
  <div className="animate-pulse text-sm theme-text-soft">
    Syncing live Asana data...
  </div>
)}

      {/* PROJECT LIST */}
      {!selectedAsanaProject && (
        <div className="grid md:grid-cols-3 gap-4">
          {asanaProjects.map((p) => (
            <div
              key={p.gid}
              onClick={() => {
  setAsanaPage(1);
  setAsanaSearch("");
  loadAsanaProject(p, 1, "");
}}
              className="theme-surface border theme-border rounded-lg p-4 cursor-pointer hover:shadow"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs theme-text-muted">
                Click to view tasks
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TASK TABLE */}
      {selectedAsanaProject && (
        <div className="theme-surface rounded-lg border theme-border overflow-hidden">
          {/* ✅ SEARCH BAR */}
    <div className="p-3 border-b flex gap-2 items-center justify-between">

  <input
    placeholder="Search tasks..."
    value={asanaSearch}
    onChange={(e) => {
      setAsanaPage(1);
      setAsanaSearch(e.target.value);
    }}
    className="theme-input border theme-border rounded px-2 py-1 text-xs w-64"
  />

  <button
    onClick={migrateAsanaProject}
    disabled={asanaMigrating}
    className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
  >
    {asanaMigrating ? "Importing..." : "Import 🚀"}
  </button>

</div>
          <table className="w-full text-xs">
            <thead className="theme-surface-soft">
              <tr>
                <th className="p-3 text-left">Task</th>
                <th className="p-3 text-left">Assignee</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Last Modified</th>
              </tr>
            </thead>
            <tbody>
  {asanaTasks.map((t) => (
    <tr key={t.gid} className="border-t">

  <td className="p-3">{t.name}</td>

  <td className="p-3">
    {t.assignee?.name || "—"}
  </td>

  <td className="p-3">
    <button
      onClick={async () => {
        try {
          await api.patch(
            `/integrations/asana/tasks/${t.gid}/status`,
            { completed: !t.completed }
          );

          setAsanaTasks(prev =>
            prev.map(task =>
              task.gid === t.gid
                ? { ...task, completed: !task.completed }
                : task
            )
          );

        } catch {
          toast.error("Failed to update task");
        }
      }}
      className={`px-2 py-1 rounded text-[11px] ${
        t.completed
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      {t.completed ? "✅ Done" : "Mark Done"}
    </button>
  </td>

  <td className="p-3">
    {new Date(t.modified_at).toLocaleString()}
  </td>

</tr>
  ))}
</tbody>
          </table>
          <div className="flex justify-between items-center p-3 border-t text-xs">

  <button
    disabled={asanaPage === 1}
    onClick={() => setAsanaPage(p => p - 1)}
    className="px-3 py-1 theme-surface-soft theme-text rounded disabled:opacity-40"
  >
    Previous
  </button>

  <span className="font-medium">
    Page {asanaPage}
    <input
  type="number"
  min="1"
  value={asanaPage}
  onChange={(e) => {
    const val = Number(e.target.value);
    if (val > 0) setAsanaPage(val);
  }}
  className="w-16 theme-input border theme-border rounded px-1 py-0.5 text-center"
/>
  </span>

  <button
    disabled={!asanaHasMore}
    onClick={() => setAsanaPage(p => p + 1)}
    className="px-3 py-1 theme-surface-soft theme-text rounded disabled:opacity-40"
  >
    Next
  </button>

</div>
        </div>
      )}
    </div>
  </div>
)}

{/* =====================================
   YOUTRACK FULLSCREEN VIEWER
===================================== */}
{youtrackOpen && (
  <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">

    <div className="theme-surface px-6 py-4 flex justify-between border-b theme-border">
      <h2 className="font-semibold">
        {selectedYoutrackProject
          ? `YouTrack — ${selectedYoutrackProject.name}`
          : "YouTrack Projects"}
      </h2>

      <button
        onClick={() => {
          setYoutrackOpen(false);
          setSelectedYoutrackProject(null);
          setYoutrackTasks([]);
        }}
      >
        ✕
      </button>
    </div>

    <div className="flex-1 theme-bg overflow-auto p-6">

      {!selectedYoutrackProject && (

  <>
    {youtrackLoading && (
      <div className="text-sm theme-text-soft">
        Loading YouTrack projects...
      </div>
    )}

    {!youtrackLoading && youtrackProjects.length === 0 && (
      <div className="text-sm theme-text-muted">
        No projects found or access not granted.
      </div>
    )}

    <div className="grid md:grid-cols-3 gap-4">
      <div className="text-xs text-red-500">
  Projects loaded: {youtrackProjects.length}
</div>
      {youtrackProjects.map(p => (
        <div
          key={p.id}
          onClick={() => loadYouTrackProject(p)}
          className="theme-surface border theme-border rounded-lg p-4 cursor-pointer hover:shadow"
        >
          <div className="font-semibold">{p.name}</div>
        </div>
      ))}
    </div>
  </>
)}

      {selectedYoutrackProject && (
        <table className="w-full text-xs theme-surface rounded border theme-border">
          <thead className="theme-surface-soft">
  <tr>
    <th className="p-3 text-left">Issue</th>
    <th className="p-3 text-left">Assignee</th>
    <th className="p-3 text-left">Status</th>
    <th className="p-3 text-left">Last Modified</th>
  </tr>
</thead>
          <tbody>
  {youtrackTasks.map(t => (
    <tr key={t.id} className="border-t">

      {/* Issue */}
      <td className="p-3">
        {t.title || t.name || "—"}
      </td>

      {/* Assignee */}
      <td className="p-3">
        {t.assignee?.name ||
         t.assignee ||
         "—"}
      </td>

      <td className="p-3">
  <button
    onClick={async () => {
      await api.patch(
        `/integrations/youtrack/tasks/${t.id}/status`,
        { completed: !t.completed }
      );

      setYoutrackTasks(prev =>
        prev.map(task =>
          task.id === t.id
            ? { ...task, completed: !task.completed }
            : task
        )
      );
    }}
    className={`px-2 py-1 rounded text-[11px] ${
      t.completed
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700"
    }`}
  >
    {t.completed ? "✅ Done" : "Mark Done"}
  </button>
</td>

      {/* Last Modified */}
      <td className="p-3">
        {t.lastModified || t.updated
          ? new Date(
              t.lastModified || t.updated
            ).toLocaleString()
          : "—"}
      </td>

    </tr>
  ))}
</tbody>
        </table>
      )}

    </div>
  </div>
)}

    </div>
  );
}
