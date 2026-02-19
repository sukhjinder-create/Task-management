import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { getAdminInsights, getExecutiveSummary } from "../services/intelligence.api";
import { getSocket } from "../socket";

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
  const [showReasoning, setShowReasoning] = useState(false);
  const [forecastReasoningOpen, setForecastReasoningOpen] = useState(false);
  const [healthScore, setHealthScore] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
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
      // Fetch executive summary (current month)    
if (isAdmin) {
  try {
    setSummaryLoading(true);
    const month = new Date().toISOString().slice(0, 7);

    const summaryRes = await api.get(
      `/intelligence/admin/executive-summary?month=${month}`
    );

    setExecutiveSummary(summaryRes.data);
  } catch (err) {
    console.warn("Executive summary not available yet");
  } finally {
    setSummaryLoading(false);
  }
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
        const proj = projectsRes.data || [];
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

  const onPulse = (data) => {
    if (typeof data?.health !== "number") return;

    // ✅ use authoritative value from server
    setHealthScore(Math.max(0, Math.min(100, data.health)));
  };

  socket.on("workspace:health-pulse", onPulse);

  return () => {
    socket.off("workspace:health-pulse", onPulse);
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

  // 🔥 Auto-refresh executive summary while AI is generating
useEffect(() => {
  if (!executiveSummary || executiveSummary.status !== "processing") {
    return;
  }

  const interval = setInterval(async () => {
    try {
      const month = new Date().toISOString().slice(0, 7);

      const res = await api.get(
        `/intelligence/admin/executive-summary?month=${month}`
      );

      setExecutiveSummary(res.data);
    } catch (err) {
      console.warn("Auto-refresh failed");
    }
  }, 5000); // check every 5 seconds

  return () => clearInterval(interval);
}, [executiveSummary, api]);

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

  const totalProjects = projects.length;
  const totalTasks = tasksForStats.length;
  const pendingCount = tasksForStats.filter((t) => t.status === "pending").length;
  const inProgressCount = tasksForStats.filter(
    (t) => t.status === "in-progress"
  ).length;
  const completedCount = tasksForStats.filter(
    (t) => t.status === "completed"
  ).length;
  const overdueCount = tasksForStats.filter((t) => isTaskOverdue(t)).length;


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

  // Top overdue tasks list (limit 5)
  const topOverdue = useMemo(() => {
    const arr = tasksForStats.filter((t) => isTaskOverdue(t));
    // sort by due_date ascending
    arr.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return arr.slice(0, 5);
  }, [tasksForStats]);

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
  <section
    className={`rounded-xl shadow p-5 border ${
      autonomousInsight.type === "critical"
        ? "bg-red-50 border-red-200"
        : autonomousInsight.type === "warning"
        ? "bg-amber-50 border-amber-200"
        : autonomousInsight.type === "positive"
        ? "bg-emerald-50 border-emerald-200"
        : "bg-slate-50 border-slate-200"
    }`}
  >
    <div className="flex items-start gap-3">

      <div className="text-lg">
        {autonomousInsight.type === "critical" && "🔴"}
        {autonomousInsight.type === "warning" && "⚠️"}
        {autonomousInsight.type === "positive" && "✅"}
        {autonomousInsight.type === "neutral" && "🧠"}
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">
          AI Autonomous Insight
        </div>

        <p className="text-sm text-slate-800 leading-relaxed">
          {autonomousInsight.message}
        </p>
      </div>

    </div>
  </section>
)}

      {/* ======================================
   WORKSPACE CONTROL CENTER — AI ATTENTION
====================================== */}

{(isAdmin || isManager || isUser) && (
  <section className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl shadow p-5">

    <h2 className="text-sm font-semibold mb-3">
      Workspace Control Center
    </h2>

    <div className="grid md:grid-cols-3 gap-4 text-xs">

      {/* Risk Status */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-slate-300">Current Risk State</div>
        <div className="text-lg font-semibold mt-1">
          {myPerformance?.intelligence?.risk?.level || "Analyzing"}
        </div>
      </div>

      {/* Overdue Pressure */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-slate-300">Execution Pressure</div>
        <div className="text-lg font-semibold mt-1">
          {overdueCount > 5
            ? "High"
            : overdueCount > 0
            ? "Moderate"
            : "Stable"}
        </div>
      </div>

      {/* Momentum */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="text-slate-300">Performance Momentum</div>
        <div className="text-lg font-semibold mt-1">
          {intelligence?.forecast?.trend || "Stable"}
        </div>
      </div>

    </div>

  </section>
)}

{/* ================================
    EXECUTIVE INTELLIGENCE SUMMARY
================================ */}
{isAdmin && executiveSummary && (
  <section className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl shadow p-6">
    <h2 className="text-lg font-semibold mb-2">
      Executive Intelligence Insight
    </h2>

    {executiveSummary.status === "processing" && (
      <p className="text-sm opacity-90">
        🧠 AI is analyzing organizational performance...
      </p>
    )}

    {executiveSummary.status === "ready" && (
      <>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
  {executiveSummary.text}
</div>

        {executiveSummary.reasoning && (
  <button
    onClick={() => setShowReasoning(true)}
    className="mt-4 text-xs font-semibold text-white/90 underline hover:text-white"
  >
    View AI analyst reasoning
  </button>
)}
      </>
    )}
  </section>
)}

{/* ================================
    MY PERFORMANCE SNAPSHOT
================================ */}
{myPerformance && (
  <section className="bg-white rounded-xl shadow p-6 border border-slate-200 space-y-6">

    {/* HEADER */}
    <div className="flex justify-between items-center">
      <h2 className="text-lg font-semibold">
        My Performance – {new Date().toISOString().slice(0, 7)}
      </h2>

      <div className="text-right">
        <div className="text-3xl font-bold text-indigo-600">
          {myPerformance.score}
        </div>
        <div
          className={`text-xs font-semibold ${
            getRiskLevel(myPerformance.score).color
          }`}
        >
          {getRiskLevel(myPerformance.score).label}
        </div>
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
  </section>
)}
      <section className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
{/* 🔥 Org Intelligence Overview */}
{isAdmin && intelligence && (
  <section className="bg-white rounded-xl shadow p-6 grid md:grid-cols-4 gap-6">
    <div>
      <div className="text-xs text-slate-500">Average Score</div>
      <div className="text-2xl font-bold">
        {intelligence.orgScore.averageScore ?? "-"}
      </div>
    </div>

    <div>
      <div className="text-xs text-slate-500">Total Users</div>
      <div className="text-2xl font-bold">
        {intelligence.orgScore.userCount}
      </div>
    </div>

    <div>
      <div className="text-xs text-slate-500">High Performers</div>
      <div className="text-2xl font-bold text-green-600">
        {intelligence.orgScore.highPerformers}
      </div>
    </div>

    <div>
      <div className="text-xs text-slate-500">At Risk</div>
      <div className="text-2xl font-bold text-red-600">
        {intelligence.orgScore.atRiskUsers}
      </div>
    </div>
  </section>
)}
{/* 🔥 Performance Leaderboard */}
{isAdmin && intelligence?.leaderboard && (
  <section className="bg-slate-50 border border-slate-200 rounded-xl p-6">
    <h2 className="text-sm font-semibold mb-4">Top Performers</h2>

    <div className="space-y-2">
      {intelligence.leaderboard.map((u, index) => (
        <div
          key={u.userId}
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
  <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">

    <div className="flex justify-between items-center">
      <h2 className="text-sm font-semibold">
        Next Month Outlook
      </h2>

      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 font-medium">
        {intelligence.forecast.trend}
      </span>
    </div>

    {/* Data Signals */}
    <div className="grid md:grid-cols-3 gap-6 text-sm">

      <div>
        <div className="text-slate-500">Predicted Average</div>
        <div className="text-2xl font-semibold">
          {intelligence.forecast.predictedAverage ?? "-"}
        </div>
      </div>

      <div>
        <div className="text-slate-500">Trend Direction</div>
        <div className="text-lg font-semibold text-emerald-600">
          {intelligence.forecast.trend}
        </div>
      </div>

      <div>
        <div className="text-slate-500">Risk Projection</div>
        <div className="text-lg font-semibold text-red-600">
          {intelligence.forecast.riskProjection ?? "-"}
        </div>
      </div>

    </div>

    {/* AI Interpretation */}
    {executiveSummary?.outlook && (
      <div className="border-t pt-4">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          AI PERFORMANCE INTERPRETATION
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          {executiveSummary.outlook}
        </p>
      </div>
    )}

    {/* AI Decision Guidance */}
<div className="border-t pt-4 mt-4">
  <div className="text-xs font-semibold text-slate-500 mb-2">
    RECOMMENDED ACTION
  </div>

  <p className="text-sm text-slate-700">
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
<section className="bg-white rounded-xl shadow p-4 border border-slate-200">
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

  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
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

  <p className="text-[11px] text-slate-500 mt-2">
    Live organizational health reacting to task execution in real time.
  </p>
</section>
          <p className="text-xs text-slate-500">
            Role: {role}. Showing an overview of projects and tasks you are allowed
            to access.
          </p>
        </div>
      </section>

      {/* High-level stats */}
      <section className="bg-white rounded-xl shadow p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div>
          <div className="text-slate-500">Projects</div>
          <div className="text-lg font-semibold">{totalProjects}</div>
        </div>
        <div>
          <div className="text-slate-500">
            {isUser ? "My tasks" : "Total tasks"}
          </div>
          <div className="text-lg font-semibold">{totalTasks}</div>
        </div>
        <div>
          <div className="text-slate-500">Pending</div>
          <div className="text-lg font-semibold">{pendingCount}</div>
        </div>
        <div>
          <div className="text-slate-500">In progress</div>
          <div className="text-lg font-semibold">{inProgressCount}</div>
        </div>
        <div>
          <div className="text-slate-500">Overdue</div>
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
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">Top overdue tasks</h2>

        {loading && (
          <div className="text-sm text-slate-500">Loading overdue tasks...</div>
        )}

        {!loading && topOverdue.length === 0 && (
          <div className="text-sm text-slate-500">
            No overdue tasks in your scope. 🎉
          </div>
        )}

        <div className="space-y-2">
          {topOverdue.map((t) => (
            <div
              key={t.id}
              className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-[11px]">
                    {t.task}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Project:{" "}
                    <span className="font-semibold">
                      {t._project?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Due:{" "}
                    {t.due_date
                      ? new Date(t.due_date).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
                {t.assigned_to && (
                  <div className="text-[10px] text-slate-500">
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
    <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl p-6 relative">

      <button
        onClick={() => setForecastReasoningOpen(false)}
        className="absolute top-3 right-4 text-slate-400 hover:text-slate-700"
      >
        ✕
      </button>

      <h2 className="text-lg font-semibold mb-4">
        AI Forecast Reasoning
      </h2>

      <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed max-h-[60vh] overflow-y-auto">
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
      {showReasoning && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl w-[720px] max-w-[92%] p-6 relative">

      <button
        onClick={() => setShowReasoning(false)}
        className="absolute top-3 right-4 text-slate-500 hover:text-black"
      >
        ✕
      </button>

      <h3 className="text-lg font-semibold mb-4">
        AI Analyst Reasoning
      </h3>

      <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
        {executiveSummary?.reasoning || "Reasoning not available."}
      </div>

    </div>
  </div>
)}
    </div>
  );
}
