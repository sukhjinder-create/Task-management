// src/pages/OKR.jsx — Goals (replaces OKR/Objectives)
import { useState, useEffect } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/ui";
import toast from "react-hot-toast";
import {
  Target, Plus, ChevronDown, ChevronRight,
  Trash2, Link2, Link2Off, EyeOff, CheckCircle2,
  Clock, AlertCircle, Layers, TrendingUp, TrendingDown,
  Minus, Edit2, Check, X,
} from "lucide-react";

const STATUS_COLOR = {
  on_track:  { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  label: "On Track"  },
  at_risk:   { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  label: "At Risk"   },
  off_track: { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "Off Track" },
  done:      { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500", label: "Done"      },
};

const PACE_ICON = {
  ahead:    <TrendingUp  className="w-3.5 h-3.5 text-green-500" />,
  on_track: <Minus       className="w-3.5 h-3.5 text-blue-500"  />,
  at_risk:  <TrendingDown className="w-3.5 h-3.5 text-amber-500"/>,
  overdue:  <AlertCircle className="w-3.5 h-3.5 text-red-500"  />,
  complete: <CheckCircle2 className="w-3.5 h-3.5 text-green-500"/>,
};

const SPRINT_STATUS_COLOR = {
  planning:  { bg: "bg-slate-100", text: "text-slate-600" },
  active:    { bg: "bg-blue-100",  text: "text-blue-700"  },
  completed: { bg: "bg-green-100", text: "text-green-700" },
};

const PERIODS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "2026", "2027"];

export default function OKR() {
  const api   = useApi();
  const { auth } = useAuth();
  const isAdmin   = auth.user?.role === "admin" || auth.user?.role === "superadmin";
  const isManager = auth.user?.role === "manager";
  const canManage = isAdmin || isManager;

  const [goals,     setGoals]     = useState([]);
  const [period,    setPeriod]    = useState("Q2 2026");
  const [showNew,   setShowNew]   = useState(false);
  const [form,      setForm]      = useState({ title: "", description: "" });
  const [expanded,  setExpanded]  = useState({});
  const [assessments, setAssessments] = useState({}); // goalId → assessment data

  // Sprint link modal
  const [linkModal,   setLinkModal]   = useState(null);
  const [allSprints,  setAllSprints]  = useState([]);

  // ─── Load goals ────────────────────────────────────────────────────────────
  const load = () => {
    api.get(`/goals/goals?timePeriod=${encodeURIComponent(period)}`)
      .then(r => setGoals(r.data || []))
      .catch(() => {});
  };

  const loadSprints = () => {
    api.get("/sprints")
      .then(r => setAllSprints(r.data || []))
      .catch(() => {});
  };

  const loadAssessment = (goalId) => {
    api.get(`/goals/goals/${goalId}/assessment`)
      .then(r => setAssessments(a => ({ ...a, [goalId]: r.data })))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [period]);

  // ─── CRUD ──────────────────────────────────────────────────────────────────
  const createGoal = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    try {
      await api.post("/goals/goals", { ...form, time_period: period });
      setShowNew(false);
      setForm({ title: "", description: "" });
      load();
      toast.success("Goal created");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const deleteGoal = async (id) => {
    if (!confirm("Delete this goal?")) return;
    await api.delete(`/goals/goals/${id}`).catch(() => {});
    load();
    toast.success("Goal deleted");
  };

  // Manual progress update (only when no sprints linked)
  const updateProgress = async (id, progress) => {
    try {
      await api.put(`/goals/goals/${id}`, { progress });
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  // ─── Sprint linking ────────────────────────────────────────────────────────
  const openLinkModal = (goalId) => {
    setLinkModal(goalId);
    loadSprints();
  };

  const linkSprint = async (goalId, sprintId) => {
    try {
      await api.post(`/goals/goals/${goalId}/sprints`, { sprint_id: sprintId });
      toast.success("Sprint linked — progress will sync automatically");
      load();
      if (assessments[goalId]) loadAssessment(goalId);
    } catch (err) { toast.error(err.response?.data?.error || "Failed to link sprint"); }
  };

  const unlinkSprint = async (goalId, sprintId) => {
    try {
      await api.delete(`/goals/goals/${goalId}/sprints/${sprintId}`);
      toast.success("Sprint unlinked");
      load();
      if (assessments[goalId]) loadAssessment(goalId);
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  // Toggle expand + load assessment on first open
  const toggleExpand = (goalId) => {
    setExpanded(e => {
      const next = !e[goalId];
      if (next && !assessments[goalId]) loadAssessment(goalId);
      return { ...e, [goalId]: next };
    });
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const overallProgress = goals.length > 0
    ? Math.round(goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length)
    : 0;
  const doneCount = goals.filter(g => g.status === "done" || g.progress >= 100).length;

  const currentGoal      = linkModal ? goals.find(g => g.id === linkModal) : null;
  const linkedSprintIds  = new Set((currentGoal?.linked_sprints || []).map(s => s.sprint_id));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold theme-text flex items-center gap-2">
            <Target className="w-6 h-6 text-indigo-500" /> Goals
          </h1>
          <p className="theme-text-muted text-sm mt-1">
            Set team goals, link sprints, and let the intelligence layer track progress automatically.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text">
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {canManage && (
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Add Goal
            </button>
          )}
        </div>
      </div>

      {/* ── Overall progress strip ───────────────────────────────────────────── */}
      {goals.length > 0 && (
        <div className="theme-surface-card rounded-xl p-5 border theme-border mb-6 flex items-center gap-6">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                strokeDasharray={`${overallProgress} ${100 - overallProgress}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-600">
              {overallProgress}%
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold theme-text">Overall — {period}</p>
            <p className="text-sm theme-text-muted">
              {goals.length} goal{goals.length !== 1 ? "s" : ""} · {doneCount} completed
            </p>
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-4 text-center">
            {[
              { label: "On Track", count: goals.filter(g => g.status === "on_track").length, color: "text-green-600" },
              { label: "At Risk",  count: goals.filter(g => g.status === "at_risk").length,  color: "text-amber-600" },
              { label: "Done",     count: doneCount,                                          color: "text-indigo-600" },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs theme-text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New goal form ────────────────────────────────────────────────────── */}
      {showNew && (
        <div className="theme-surface-card rounded-xl p-5 border theme-border mb-4 space-y-3">
          <h3 className="font-medium theme-text">New Goal</h3>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="What do you want to achieve? (e.g. Launch mobile app by Q2)"
            className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
            autoFocus
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Why does this goal matter? (optional)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text resize-none"
          />
          <p className="text-xs theme-text-muted">
            Tip: Link sprints after creating the goal — progress will update automatically when sprints complete.
          </p>
          <div className="flex gap-2">
            <button onClick={createGoal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              Create Goal
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border theme-border rounded-lg text-sm theme-text">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Goal list ────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {goals.map(goal => (
          <GoalCard
            key={goal.id}
            goal={goal}
            canManage={canManage}
            expanded={!!expanded[goal.id]}
            assessment={assessments[goal.id]}
            onToggle={() => toggleExpand(goal.id)}
            onDelete={() => deleteGoal(goal.id)}
            onUpdateProgress={p => updateProgress(goal.id, p)}
            onLinkSprints={() => openLinkModal(goal.id)}
            onUnlinkSprint={sprintId => unlinkSprint(goal.id, sprintId)}
          />
        ))}

        {goals.length === 0 && (
          <div className="text-center py-16">
            <Target className="w-14 h-14 mx-auto mb-4 text-indigo-200" />
            <h3 className="font-medium theme-text mb-1">No goals for {period}</h3>
            <p className="theme-text-muted text-sm max-w-xs mx-auto">
              Create a goal, link it to sprints, and the intelligence layer will track it automatically.
            </p>
            {canManage && (
              <button onClick={() => setShowNew(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                Add First Goal
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sprint link modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={!!linkModal} onClose={() => setLinkModal(null)} size="sm">
        <Modal.Header>
          <h2 className="font-semibold theme-text flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-500" /> Link Sprints to Goal
          </h2>
          <p className="text-xs theme-text-muted mt-1">
            When a linked sprint completes, this goal's progress updates automatically.<br />
            Progress = completed sprints ÷ total linked sprints × 100
          </p>
        </Modal.Header>
        <Modal.Body>
          {/* Already linked */}
          {(currentGoal?.linked_sprints || []).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2">
                Linked Sprints
              </p>
              <div className="space-y-2">
                {(currentGoal.linked_sprints || []).map(s => {
                  const sc = SPRINT_STATUS_COLOR[s.sprint_status] || SPRINT_STATUS_COLOR.planning;
                  return (
                    <div key={s.sprint_id}
                      className="flex items-center gap-3 bg-[var(--surface-soft)] rounded-lg px-3 py-2">
                      {s.is_hidden && <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Hidden sprint" />}
                      <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium theme-text truncate">{s.sprint_name}</p>
                        <p className="text-xs theme-text-muted">{s.project_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                        {s.sprint_status}
                      </span>
                      {s.sprint_status === "completed"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <Clock className="w-4 h-4 text-slate-400 shrink-0" />}
                      <button onClick={() => unlinkSprint(linkModal, s.sprint_id)}
                        className="p-1 text-red-400 hover:text-red-600 rounded shrink-0" title="Unlink">
                        <Link2Off className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available sprints */}
          <p className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2">
            Available Sprints
          </p>
          {allSprints.filter(s => !linkedSprintIds.has(s.id)).length === 0 ? (
            <p className="text-sm theme-text-muted">All sprints are already linked, or none exist yet.</p>
          ) : (
            <div className="space-y-2">
              {allSprints.filter(s => !linkedSprintIds.has(s.id)).map(s => {
                const sc = SPRINT_STATUS_COLOR[s.status] || SPRINT_STATUS_COLOR.planning;
                return (
                  <div key={s.id}
                    className="flex items-center gap-3 border theme-border rounded-lg px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
                    {s.is_hidden && <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Hidden sprint" />}
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium theme-text truncate">{s.name}</p>
                      <p className="text-xs theme-text-muted">{s.project_name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{s.status}</span>
                    <button onClick={() => linkSprint(linkModal, s.id)}
                      className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shrink-0">
                      Link
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button onClick={() => setLinkModal(null)}
            className="w-full px-4 py-2 border theme-border rounded-lg text-sm theme-text hover:bg-[var(--surface-soft)]">
            Done
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({ goal, canManage, expanded, assessment, onToggle, onDelete, onUpdateProgress, onLinkSprints, onUnlinkSprint }) {
  const sc           = STATUS_COLOR[goal.status] || STATUS_COLOR.on_track;
  const linkedSprints = goal.linked_sprints || [];
  const sprintDriven  = linkedSprints.length > 0;

  // Manual progress editing (only when no sprints linked)
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressVal, setProgressVal]         = useState(goal.progress || 0);

  const saveProgress = () => {
    const v = Math.max(0, Math.min(100, Number(progressVal)));
    onUpdateProgress(v);
    setEditingProgress(false);
  };

  return (
    <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">

      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />
            <h3 className="font-semibold theme-text">{goal.title}</h3>
            {sprintDriven && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                <Layers className="w-3 h-3" /> {linkedSprints.length} sprint{linkedSprints.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {goal.description && (
            <p className="text-sm theme-text-muted truncate">{goal.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Status badge */}
          <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>
            {sc.label}
          </span>

          {/* Progress bar */}
          <div className="w-24 hidden sm:flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${goal.progress || 0}%` }} />
            </div>
            <span className="text-xs theme-text-muted w-8 text-right">{Math.round(goal.progress || 0)}%</span>
          </div>

          {/* Link sprints (admin/manager) */}
          {canManage && (
            <button onClick={e => { e.stopPropagation(); onLinkSprints(); }}
              className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Link sprints to this goal">
              <Link2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete (admin/manager) */}
          {canManage && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete goal">
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {expanded
            ? <ChevronDown  className="w-4 h-4 theme-text-muted" />
            : <ChevronRight className="w-4 h-4 theme-text-muted" />}
        </div>
      </div>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t theme-border px-5 py-4 space-y-5">

          {/* Progress (manual when no sprints, read-only when sprint-driven) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold theme-text-muted uppercase tracking-wider">
                Progress
              </h4>
              {!sprintDriven && canManage && !editingProgress && (
                <button onClick={() => { setProgressVal(goal.progress || 0); setEditingProgress(true); }}
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Update
                </button>
              )}
            </div>

            {/* Manual progress editor */}
            {!sprintDriven && editingProgress ? (
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="100" value={progressVal}
                  onChange={e => setProgressVal(e.target.value)}
                  className="flex-1 accent-indigo-600" />
                <span className="text-sm font-semibold theme-text w-10 text-right">{progressVal}%</span>
                <button onClick={saveProgress} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingProgress(false)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${goal.progress || 0}%` }} />
                </div>
                <span className="text-sm font-semibold theme-text w-10 text-right">
                  {Math.round(goal.progress || 0)}%
                </span>
              </div>
            )}

            {sprintDriven && (
              <p className="text-xs theme-text-muted mt-1.5">
                Automatically tracked · {linkedSprints.filter(s => s.sprint_status === "completed").length}/{linkedSprints.length} sprints done
              </p>
            )}
            {!sprintDriven && !editingProgress && (
              <p className="text-xs theme-text-muted mt-1.5">
                Manually tracked · Link sprints for automatic updates
              </p>
            )}
          </div>

          {/* Intelligence Assessment */}
          {assessment && (
            <AssessmentPanel assessment={assessment} />
          )}

          {/* Linked sprints detail */}
          {sprintDriven && (
            <div>
              <h4 className="text-sm font-semibold theme-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Linked Sprints
              </h4>
              <div className="space-y-2">
                {linkedSprints.map(s => {
                  const sc2 = SPRINT_STATUS_COLOR[s.sprint_status] || SPRINT_STATUS_COLOR.planning;
                  return (
                    <div key={s.sprint_id}
                      className="flex items-center gap-3 bg-[var(--surface-soft)] rounded-lg px-3 py-2">
                      {s.is_hidden && <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium theme-text truncate">{s.sprint_name}</p>
                        <p className="text-xs theme-text-muted">{s.project_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sc2.bg} ${sc2.text}`}>
                        {s.sprint_status}
                      </span>
                      {s.sprint_status === "completed"
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        : <Clock        className="w-4 h-4 text-slate-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state — no sprints */}
          {!sprintDriven && (
            <div className="rounded-lg border border-dashed theme-border p-4 text-center">
              <Layers className="w-6 h-6 mx-auto mb-2 text-indigo-300" />
              <p className="text-sm theme-text-muted mb-2">No sprints linked yet.</p>
              {canManage && (
                <button onClick={onLinkSprints}
                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Link a Sprint
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Intelligence Assessment Panel ───────────────────────────────────────────
/*
  Shows the intelligence assessment for a goal in a user-friendly way.
  All numbers are explained in plain English so any user understands what they mean.
*/
function AssessmentPanel({ assessment }) {
  const { assessment: a, signals, sprintSummary } = assessment;
  if (!a) return null;

  const healthColor =
    a.healthScore >= 70 ? "text-green-600 bg-green-50 border-green-200" :
    a.healthScore >= 45 ? "text-amber-600 bg-amber-50 border-amber-200" :
                          "text-red-600   bg-red-50   border-red-200";

  const signalStyle = {
    success:  "bg-green-50  border-green-200  text-green-700",
    warning:  "bg-amber-50  border-amber-200  text-amber-700",
    critical: "bg-red-50    border-red-200    text-red-700",
    info:     "bg-blue-50   border-blue-200   text-blue-700",
  };

  return (
    <div className="rounded-xl border theme-border bg-[var(--surface-soft)] p-4 space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold theme-text flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-indigo-500" /> Intelligence Assessment
        </h4>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${healthColor}`}>
          {PACE_ICON[a.paceLabel] || PACE_ICON.on_track}
          Health {a.healthScore}/100
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric
          label="Actual Progress"
          value={`${a.actualProgress}%`}
          sub="current"
        />
        <Metric
          label="Expected by Now"
          value={`${a.expectedProgress}%`}
          sub={`${a.daysElapsed}d elapsed of ${a.totalDays}d`}
        />
        <Metric
          label="Gap"
          value={`${a.progressGap > 0 ? "+" : ""}${a.progressGap}%`}
          sub={a.progressGap >= 0 ? "ahead of pace" : "behind pace"}
          valueColor={a.progressGap >= 0 ? "text-green-600" : "text-red-600"}
        />
        <Metric
          label="Est. Completion"
          value={a.estimatedCompletionDate ? a.estimatedCompletionDate : "—"}
          sub={a.willCompleteOnTime === true ? "✓ on time" : a.willCompleteOnTime === false ? "⚠ late" : "no data yet"}
          valueColor={a.willCompleteOnTime === false ? "text-red-600" : a.willCompleteOnTime === true ? "text-green-600" : ""}
        />
      </div>

      {/* Sprint velocity (only when sprints exist) */}
      {sprintSummary && sprintSummary.total > 0 && (
        <div className="flex items-center gap-4 text-xs theme-text-muted border-t theme-border pt-3">
          <span><b className="theme-text">{sprintSummary.completed}</b>/{sprintSummary.total} sprints done</span>
          {sprintSummary.active > 0 && <span><b className="theme-text">1</b> active now</span>}
          {sprintSummary.avgVelocity !== null && (
            <span>
              Sprint completion rate: <b className={
                sprintSummary.avgVelocity >= 80 ? "text-green-600" :
                sprintSummary.avgVelocity >= 60 ? "text-amber-600" : "text-red-600"
              }>{sprintSummary.avgVelocity}%</b>
            </span>
          )}
          <span className="ml-auto">Forecast confidence: <b className="theme-text">{a.confidence}</b></span>
        </div>
      )}

      {/* Signals */}
      {signals && signals.length > 0 && (
        <div className="space-y-1.5 border-t theme-border pt-3">
          {signals.map((s, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${signalStyle[s.type] || signalStyle.info}`}>
              {s.type === "critical" && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {s.type === "warning"  && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {s.type === "success"  && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {s.type === "info"     && <Target       className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              {s.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, valueColor = "theme-text" }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs font-medium theme-text">{label}</p>
      <p className="text-xs theme-text-muted">{sub}</p>
    </div>
  );
}
