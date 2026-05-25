// src/pages/OKR.jsx — Goals (replaces OKR/Objectives)
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  on_track:  { bg: "",                   text: "text-emerald-400",  dot: "bg-emerald-500",  label: "On Track"  },
  at_risk:   { bg: "",                   text: "text-amber-400",    dot: "bg-amber-500",    label: "At Risk"   },
  off_track: { bg: "",                   text: "text-red-400",      dot: "bg-red-500",      label: "Off Track" },
  done:      { bg: "bg-[var(--surface-soft)]", text: "text-[color:var(--primary)]", dot: "bg-[color:var(--primary)]", label: "Done" },
};

const PACE_ICON = {
  ahead:    <TrendingUp   className="w-3.5 h-3.5 text-emerald-400" />,
  on_track: <Minus        className="w-3.5 h-3.5 text-[color:var(--primary)]" />,
  at_risk:  <TrendingDown className="w-3.5 h-3.5 text-amber-400" />,
  overdue:  <AlertCircle  className="w-3.5 h-3.5 text-red-400"  />,
  complete: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
};

const SPRINT_STATUS_COLOR = {
  planning:  { bg: "bg-[var(--surface-soft)]", text: "text-[color:var(--text-muted)]" },
  active:    { bg: "bg-[var(--surface-soft)]",  text: "text-[color:var(--primary)]"  },
  completed: { bg: "",                         text: "text-emerald-400"             },
};

const PERIODS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "2026", "2027"];

export default function OKR() {
  const api   = useApi();
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin   = auth.user?.role === "admin" || auth.user?.role === "superadmin";
  const isManager = auth.user?.role === "manager";
  const canManage = isAdmin || isManager;
  const requestedPeriod = searchParams.get("period");
  const requestedGoalId = searchParams.get("goal");

  const [goals,     setGoals]     = useState([]);
  const [period,    setPeriod]    = useState(PERIODS.includes(requestedPeriod) ? requestedPeriod : "Q2 2026");
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

  useEffect(() => {
    if (!requestedPeriod || requestedPeriod === period || !PERIODS.includes(requestedPeriod)) return;
    setPeriod(requestedPeriod);
  }, [requestedPeriod, period]);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("period", period);
      return next;
    }, { replace: true });
  }, [period, setSearchParams]);

  useEffect(() => {
    if (!requestedGoalId || !goals.length) return;
    const target = goals.find((goal) => String(goal.id) === String(requestedGoalId));
    if (!target) return;

    setExpanded((current) => {
      if (current[target.id]) return current;
      return { ...current, [target.id]: true };
    });

    if (!assessments[target.id]) {
      loadAssessment(target.id);
    }

    const timer = window.setTimeout(() => {
      document.getElementById(`goal-${target.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [requestedGoalId, goals, assessments]);

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

  const inputCls = "w-full bg-[var(--surface)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)] resize-none";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Planning
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-[color:var(--primary)]" /> Goals
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            Set team goals, link sprints, and let the intelligence layer track progress automatically.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]">
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {canManage && (
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Add Goal
            </button>
          )}
        </div>
      </header>

      {/* ── Overall progress strip ───────────────────────────────────────────── */}
      {goals.length > 0 && (
        <div className="border border-[color:var(--border)] rounded-lg p-5 mb-6 flex items-center gap-6">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--primary)" strokeWidth="3"
                strokeDasharray={`${overallProgress} ${100 - overallProgress}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[color:var(--primary)]">
              {overallProgress}%
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[color:var(--text)]">Overall — {period}</p>
            <p className="text-sm text-[color:var(--text-muted)]">
              {goals.length} goal{goals.length !== 1 ? "s" : ""} · {doneCount} completed
            </p>
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-4 text-center">
            {[
              { label: "On Track", count: goals.filter(g => g.status === "on_track").length, color: "text-emerald-400" },
              { label: "At Risk",  count: goals.filter(g => g.status === "at_risk").length,  color: "text-amber-400" },
              { label: "Done",     count: doneCount,                                          color: "text-[color:var(--primary)]" },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-[color:var(--text-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New goal form ────────────────────────────────────────────────────── */}
      {showNew && (
        <div className="border border-[color:var(--border)] rounded-lg p-5 mb-4 space-y-3">
          <h3 className="font-medium text-[color:var(--text)]">New Goal</h3>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="What do you want to achieve? (e.g. Launch mobile app by Q2)"
            className={inputCls}
            autoFocus
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Why does this goal matter? (optional)"
            rows={2}
            className={inputCls}
          />
          <p className="text-xs text-[color:var(--text-muted)]">
            Tip: Link sprints after creating the goal — progress will update automatically when sprints complete.
          </p>
          <div className="flex gap-2">
            <button onClick={createGoal} className="px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              Create Goal
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
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
            highlighted={String(goal.id) === String(requestedGoalId || "")}
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
            <Target className="w-14 h-14 mx-auto mb-4 text-[color:var(--text-soft)]" />
            <h3 className="font-medium text-[color:var(--text)] mb-1">No goals for {period}</h3>
            <p className="text-[color:var(--text-muted)] text-sm max-w-xs mx-auto">
              Create a goal, link it to sprints, and the intelligence layer will track it automatically.
            </p>
            {canManage && (
              <button onClick={() => setShowNew(true)}
                className="mt-4 px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Add First Goal
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sprint link modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={!!linkModal} onClose={() => setLinkModal(null)} size="sm">
        <Modal.Header>
          <h2 className="font-semibold text-[color:var(--text)] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[color:var(--primary)]" /> Link Sprints to Goal
          </h2>
          <p className="text-xs text-[color:var(--text-muted)] mt-1">
            When a linked sprint completes, this goal's progress updates automatically.<br />
            Progress = completed sprints ÷ total linked sprints × 100
          </p>
        </Modal.Header>
        <Modal.Body>
          {/* Already linked */}
          {(currentGoal?.linked_sprints || []).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2">
                Linked Sprints
              </p>
              <div className="space-y-2">
                {(currentGoal.linked_sprints || []).map(s => {
                  const sc = SPRINT_STATUS_COLOR[s.sprint_status] || SPRINT_STATUS_COLOR.planning;
                  return (
                    <div key={s.sprint_id}
                      className="flex items-center gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2">
                      {s.is_hidden && <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Hidden sprint" />}
                      <Layers className="w-3.5 h-3.5 text-[color:var(--primary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[color:var(--text)] truncate">{s.sprint_name}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">{s.project_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] ${sc.text}`}>
                        {s.sprint_status}
                      </span>
                      {s.sprint_status === "completed"
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <Clock className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />}
                      <button onClick={() => unlinkSprint(linkModal, s.sprint_id)}
                        className="p-1 text-red-400 hover:text-red-300 rounded shrink-0" title="Unlink">
                        <Link2Off className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available sprints */}
          <p className="text-xs font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2">
            Available Sprints
          </p>
          {allSprints.filter(s => !linkedSprintIds.has(s.id)).length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)]">All sprints are already linked, or none exist yet.</p>
          ) : (
            <div className="space-y-2">
              {allSprints.filter(s => !linkedSprintIds.has(s.id)).map(s => {
                const sc = SPRINT_STATUS_COLOR[s.status] || SPRINT_STATUS_COLOR.planning;
                return (
                  <div key={s.id}
                    className="flex items-center gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2 hover:bg-[var(--surface-soft)] transition-colors">
                    {s.is_hidden && <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Hidden sprint" />}
                    <Layers className="w-3.5 h-3.5 text-[color:var(--text-muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[color:var(--text)] truncate">{s.name}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">{s.project_name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] ${sc.text}`}>{s.status}</span>
                    <button onClick={() => linkSprint(linkModal, s.id)}
                      className="text-xs px-3 py-1 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg hover:opacity-90 transition-opacity shrink-0">
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
            className="w-full px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
            Done
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({ goal, highlighted = false, canManage, expanded, assessment, onToggle, onDelete, onUpdateProgress, onLinkSprints, onUnlinkSprint }) {
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
    <div
      id={`goal-${goal.id}`}
      className={`border rounded-lg overflow-hidden transition-shadow ${
        highlighted
          ? "border-[color:var(--primary)]"
          : "border-[color:var(--border)]"
      }`}
    >

      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />
            <h3 className="font-semibold text-[color:var(--text)]">{goal.title}</h3>
            {sprintDriven && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] text-[color:var(--primary)]">
                <Layers className="w-3 h-3" /> {linkedSprints.length} sprint{linkedSprints.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {goal.description && (
            <p className="text-sm text-[color:var(--text-muted)] truncate">{goal.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Status badge */}
          <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium border border-[color:var(--border)] ${sc.text}`}>
            {sc.label}
          </span>

          {/* Progress bar */}
          <div className="w-24 hidden sm:flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full bg-[color:var(--primary)] rounded-full transition-all"
                style={{ width: `${goal.progress || 0}%` }} />
            </div>
            <span className="text-xs text-[color:var(--text-muted)] w-8 text-right">{Math.round(goal.progress || 0)}%</span>
          </div>

          {/* Link sprints (admin/manager) */}
          {canManage && (
            <button onClick={e => { e.stopPropagation(); onLinkSprints(); }}
              className="p-1.5 text-[color:var(--primary)] hover:bg-[var(--surface-soft)] rounded-lg transition-colors"
              title="Link sprints to this goal">
              <Link2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete (admin/manager) */}
          {canManage && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-[var(--surface-soft)] rounded-lg transition-colors"
              title="Delete goal">
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {expanded
            ? <ChevronDown  className="w-4 h-4 text-[color:var(--text-muted)]" />
            : <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)]" />}
        </div>
      </div>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[color:var(--border)] px-5 py-4 space-y-5">

          {/* Progress (manual when no sprints, read-only when sprint-driven) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[color:var(--text-muted)] uppercase tracking-wider">
                Progress
              </h4>
              {!sprintDriven && canManage && !editingProgress && (
                <button onClick={() => { setProgressVal(goal.progress || 0); setEditingProgress(true); }}
                  className="text-xs text-[color:var(--primary)] hover:underline flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Update
                </button>
              )}
            </div>

            {/* Manual progress editor */}
            {!sprintDriven && editingProgress ? (
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="100" value={progressVal}
                  onChange={e => setProgressVal(e.target.value)}
                  className="flex-1 accent-[var(--primary)]" />
                <span className="text-sm font-semibold text-[color:var(--text)] w-10 text-right">{progressVal}%</span>
                <button onClick={saveProgress} className="p-1.5 text-emerald-400 hover:bg-[var(--surface-soft)] rounded-lg">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingProgress(false)} className="p-1.5 text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[color:var(--primary)] rounded-full transition-all"
                    style={{ width: `${goal.progress || 0}%` }} />
                </div>
                <span className="text-sm font-semibold text-[color:var(--text)] w-10 text-right">
                  {Math.round(goal.progress || 0)}%
                </span>
              </div>
            )}

            {sprintDriven && (
              <p className="text-xs text-[color:var(--text-muted)] mt-1.5">
                Automatically tracked · {linkedSprints.filter(s => s.sprint_status === "completed").length}/{linkedSprints.length} sprints done
              </p>
            )}
            {!sprintDriven && !editingProgress && (
              <p className="text-xs text-[color:var(--text-muted)] mt-1.5">
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
              <h4 className="text-sm font-semibold text-[color:var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Linked Sprints
              </h4>
              <div className="space-y-2">
                {linkedSprints.map(s => {
                  const sc2 = SPRINT_STATUS_COLOR[s.sprint_status] || SPRINT_STATUS_COLOR.planning;
                  return (
                    <div key={s.sprint_id}
                      className="flex items-center gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2">
                      {s.is_hidden && <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[color:var(--text)] truncate">{s.sprint_name}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">{s.project_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border border-[color:var(--border)] ${sc2.text}`}>
                        {s.sprint_status}
                      </span>
                      {s.sprint_status === "completed"
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <Clock        className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state — no sprints */}
          {!sprintDriven && (
            <div className="rounded-lg border border-dashed border-[color:var(--border)] p-4 text-center">
              <Layers className="w-6 h-6 mx-auto mb-2 text-[color:var(--text-soft)]" />
              <p className="text-sm text-[color:var(--text-muted)] mb-2">No sprints linked yet.</p>
              {canManage && (
                <button onClick={onLinkSprints}
                  className="text-xs px-3 py-1.5 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg hover:opacity-90 transition-opacity">
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
function AssessmentPanel({ assessment }) {
  const { assessment: a, signals, sprintSummary } = assessment;
  if (!a) return null;

  const healthColor =
    a.healthScore >= 70 ? "text-emerald-400 border-emerald-800" :
    a.healthScore >= 45 ? "text-amber-400 border-amber-800" :
                          "text-red-400 border-red-800";

  const signalStyle = {
    success:  "border-emerald-800 text-emerald-300",
    warning:  "border-amber-800  text-amber-300",
    critical: "border-red-800    text-red-300",
    info:     "border-[color:var(--border)] text-[color:var(--text-muted)]",
  };

  return (
    <div className="rounded-lg border border-[color:var(--border)] p-4 space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[color:var(--text)] flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-[color:var(--primary)]" /> Intelligence Assessment
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
          valueColor={a.progressGap >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <Metric
          label="Est. Completion"
          value={a.estimatedCompletionDate ? a.estimatedCompletionDate : "—"}
          sub={a.willCompleteOnTime === true ? "on time" : a.willCompleteOnTime === false ? "late" : "no data yet"}
          valueColor={a.willCompleteOnTime === false ? "text-red-400" : a.willCompleteOnTime === true ? "text-emerald-400" : ""}
        />
      </div>

      {/* Sprint velocity (only when sprints exist) */}
      {sprintSummary && sprintSummary.total > 0 && (
        <div className="flex items-center gap-4 text-xs text-[color:var(--text-muted)] border-t border-[color:var(--border)] pt-3">
          <span><b className="text-[color:var(--text)]">{sprintSummary.completed}</b>/{sprintSummary.total} sprints done</span>
          {sprintSummary.active > 0 && <span><b className="text-[color:var(--text)]">1</b> active now</span>}
          {sprintSummary.avgVelocity !== null && (
            <span>
              Sprint completion rate: <b className={
                sprintSummary.avgVelocity >= 80 ? "text-emerald-400" :
                sprintSummary.avgVelocity >= 60 ? "text-amber-400" : "text-red-400"
              }>{sprintSummary.avgVelocity}%</b>
            </span>
          )}
          <span className="ml-auto">Forecast confidence: <b className="text-[color:var(--text)]">{a.confidence}</b></span>
        </div>
      )}

      {/* Signals */}
      {signals && signals.length > 0 && (
        <div className="space-y-1.5 border-t border-[color:var(--border)] pt-3">
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

function Metric({ label, value, sub, valueColor = "text-[color:var(--text)]" }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs font-medium text-[color:var(--text)]">{label}</p>
      <p className="text-xs text-[color:var(--text-muted)]">{sub}</p>
    </div>
  );
}
