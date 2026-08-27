import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FolderKanban,
  Link2,
  Plus,
  ShieldCheck,
  Target,
  User,
} from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button, EmptyState, Modal, Spinner } from "../components/ui";
import AssuranceNav from "../components/AssuranceNav";

const MANAGER_ROLES = new Set(["admin", "manager"]);
const STATE_META = {
  verified: { label: "Verified", tone: "text-[color:var(--score-good)]", dot: "bg-[color:var(--score-good)]" },
  on_track: { label: "On track", tone: "text-[color:var(--score-good)]", dot: "bg-[color:var(--score-good)]" },
  at_risk: { label: "Needs attention", tone: "text-[color:var(--score-warning)]", dot: "bg-[color:var(--score-warning)]" },
  off_track: { label: "Off track", tone: "text-[color:var(--score-danger)]", dot: "bg-[color:var(--score-danger)]" },
  needs_evidence: { label: "Add evidence", tone: "text-[color:var(--score-warning)]", dot: "bg-[color:var(--score-warning)]" },
  insufficient_evidence: { label: "Connect work", tone: "text-[color:var(--text-muted)]", dot: "bg-[color:var(--text-soft)]" },
};

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  outcome: "",
  successMeasure: "",
  targetDate: dateAfter(30),
  ownerId: "",
  primaryProjectId: "",
  sprintIds: [],
};

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date)
    : String(value);
}

function statusMeta(state) {
  return STATE_META[state] || STATE_META.insufficient_evidence;
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[color:var(--text)]">{label}</span>
      {hint && <span className="ml-2 text-[11px] text-[color:var(--text-soft)]">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const inputClass = "h-11 w-full rounded-[8px] border border-[color:var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]";

function OutcomeForm({ form, setForm, owners, projects, sprints, saving, onSubmit, onCancel, editing = false }) {
  const projectSprints = sprints.filter((sprint) => sprint.project_id === form.primaryProjectId);
  return (
    <form id="outcome-form" onSubmit={onSubmit} className="rounded-[10px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-5">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">{editing ? "Edit outcome" : "New outcome"}</p>
        <h2 className="mt-1 text-lg font-semibold text-[color:var(--text)]">{editing ? "Keep the commitment clear." : "Four answers are enough to begin."}</h2>
        <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">Asystence handles monitoring, evidence, and governance behind the scenes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="What are you trying to achieve?">
            <input
              className={inputClass}
              value={form.outcome}
              onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))}
              placeholder="Launch the customer portal"
              maxLength={500}
              autoFocus
              required
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="How will you know it is complete?">
            <input
              className={inputClass}
              value={form.successMeasure}
              onChange={(event) => setForm((current) => ({ ...current, successMeasure: event.target.value }))}
              placeholder="Customers can activate without support and no critical issues remain"
              maxLength={2000}
              required
            />
          </Field>
        </div>
        <Field label="By when?">
          <input
            type="date"
            className={inputClass}
            value={form.targetDate}
            onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
            required
          />
        </Field>
        <Field label="Who owns it?">
          <select
            className={inputClass}
            value={form.ownerId}
            onChange={(event) => setForm((current) => ({ ...current, ownerId: event.target.value }))}
            required
          >
            <option value="">Choose an owner</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.username}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Connect a project" hint="Optional — this lets progress update automatically.">
            <select
              className={inputClass}
              value={form.primaryProjectId}
              onChange={(event) => setForm((current) => ({ ...current, primaryProjectId: event.target.value, sprintIds: [] }))}
            >
              <option value="">I will connect work later</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </Field>
          {form.primaryProjectId && projectSprints.length > 0 && (
            <fieldset className="mt-3 rounded-[8px] border border-[color:var(--border)] bg-[var(--surface)] p-3">
              <legend className="px-1 text-[11px] font-semibold text-[color:var(--text)]">Delivery sprints <span className="font-normal text-[color:var(--text-soft)]">Optional</span></legend>
              <p className="mb-2 text-[10px] text-[color:var(--text-muted)]">Select the sprints that deliver this outcome. Leave all clear only when the whole project contributes.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {projectSprints.map((sprint) => (
                  <label key={sprint.id} className="flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                    <input
                      type="checkbox"
                      checked={form.sprintIds.includes(sprint.id)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        sprintIds: event.target.checked
                          ? [...current.sprintIds, sprint.id]
                          : current.sprintIds.filter((id) => id !== sprint.id),
                      }))}
                    />
                    <span>{sprint.name} · {sprint.status}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="submit" loading={saving} rightIcon={<ArrowRight className="h-4 w-4" />}>{editing ? "Save outcome" : "Create outcome"}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <span className="text-[11px] text-[color:var(--text-soft)]">No score is created until real workspace evidence exists.</span>
      </div>
    </form>
  );
}

function SummaryCard({ label, value, note }) {
  return (
    <div className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{value}</p>
      <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{note}</p>
    </div>
  );
}

function EvidenceTimeline({ detail, canManage, currentUserId, busyId, onStartExperiment, onRecordExperiment }) {
  const evidence = detail?.evidence || [];
  const decisions = detail?.decisions || [];
  const materialDecisions = detail?.operating?.decisions || [];
  const experiments = detail?.operating?.experiments || [];
  return (
    <div className="mt-4 grid gap-4 border-t border-[color:var(--border)] pt-4 lg:grid-cols-2">
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Evidence</h4>
        <div className="mt-2 space-y-2">
          {evidence.length ? evidence.map((item) => (
            <div key={item.id} className="rounded-[7px] border border-[color:var(--border)] px-3 py-2">
              <p className="text-[12px] font-medium text-[color:var(--text)]">{item.label}</p>
              <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">
                {item.evidence_type} · {item.recorded_by_name || "Workspace user"} · {formatDate(item.recorded_at)}
              </p>
              {item.note && <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-muted)]">{item.note}</p>}
            </div>
          )) : <p className="text-[12px] text-[color:var(--text-muted)]">No result evidence has been recorded yet.</p>}
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Governed actions</h4>
        <div className="mt-2 space-y-2">
          {decisions.length ? decisions.map((item) => (
            <div key={item.id} className="rounded-[7px] border border-[color:var(--border)] px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[12px] font-medium text-[color:var(--text)]">{item.title}</p>
                <span className="text-[10px] font-semibold uppercase text-[color:var(--text-soft)]">{item.status}</span>
              </div>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.summary}</p>
            </div>
          )) : <p className="text-[12px] text-[color:var(--text-muted)]">No intervention has been requested.</p>}
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Decision memory</h4>
        <div className="mt-2 space-y-2">
          {materialDecisions.length ? materialDecisions.map((item) => (
            <div key={item.id} className="rounded-[7px] border border-[color:var(--border)] px-3 py-2">
              <p className="text-[12px] font-medium text-[color:var(--text)]">{item.question}</p>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Chose: {item.selected_option}</p>
              <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">{item.reversibility?.replaceAll("_", " ")} · {item.latest_review_id ? `observed result: ${item.latest_effectiveness}` : "awaiting observed-result review"}</p>
            </div>
          )) : <p className="text-[12px] text-[color:var(--text-muted)]">No material decision has been recorded.</p>}
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Reversible experiments</h4>
        <div className="mt-2 space-y-2">
          {experiments.length ? experiments.map((item) => {
            const canUpdate = canManage || String(item.owner_id) === String(currentUserId);
            return (
              <div key={item.id} className="rounded-[7px] border border-[color:var(--border)] px-3 py-2">
                <div className="flex items-center justify-between gap-3"><p className="text-[12px] font-medium text-[color:var(--text)]">{item.title}</p><span className="text-[10px] font-semibold uppercase text-[color:var(--text-soft)]">{item.status}</span></div>
                <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.smallest_test}</p>
                {canUpdate && item.status === "planned" && <Button className="mt-2" size="sm" variant="ghost" loading={busyId === item.id} onClick={() => onStartExperiment(item)}>Start test</Button>}
                {canUpdate && item.status === "active" && <Button className="mt-2" size="sm" variant="ghost" onClick={() => onRecordExperiment(item)}>Record result</Button>}
                {item.status === "completed" && <p className="mt-2 text-[10px] font-semibold text-[color:var(--score-good)]">{item.result_status}: {item.observed_result}</p>}
              </div>
            );
          }) : <p className="text-[12px] text-[color:var(--text-muted)]">No experiment is active.</p>}
        </div>
      </div>
    </div>
  );
}

export default function Outcomes() {
  const api = useApi();
  const { auth } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const canManage = MANAGER_ROLES.has(auth.user?.role);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ownerId: auth.user?.id || "" }));
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);
  const [evidenceDialog, setEvidenceDialog] = useState(null);
  const [evidenceForm, setEvidenceForm] = useState({ label: "", note: "" });
  const [connectDialog, setConnectDialog] = useState(null);
  const [connectProjectId, setConnectProjectId] = useState("");
  const [connectSprintIds, setConnectSprintIds] = useState([]);
  const [experimentDialog, setExperimentDialog] = useState(null);
  const [experimentForm, setExperimentForm] = useState({ resultStatus: "supported", observedResult: "" });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/assurance/overview");
      setData(response.data || null);
      setLoadError("");
      const owners = response.data?.options?.owners || [];
      if (owners.length) {
        setForm((current) => ({
          ...current,
          ownerId: current.ownerId || (owners.some((owner) => owner.id === auth.user?.id) ? auth.user.id : owners[0].id),
        }));
      }
    } catch (error) {
      const message = error.response?.data?.error || "Could not load outcomes";
      toast.error(message);
      setLoadError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, auth.user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && canManage) setShowForm(true);
  }, [searchParams, canManage]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, ownerId: auth.user?.id || "" });
    if (searchParams.has("new")) {
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  };

  const saveOutcome = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const savedId = editingId;
      const payload = {
        ...form,
        primaryProjectId: form.primaryProjectId || null,
      };
      if (editingId) await api.patch(`/assurance/commitments/${editingId}`, payload);
      else await api.post("/assurance/commitments", payload);
      toast.success(editingId ? "Outcome updated" : "Outcome created");
      if (savedId) {
        setDetail((current) => {
          const next = { ...current };
          delete next[savedId];
          return next;
        });
      }
      closeForm();
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not save outcome");
    } finally {
      setSaving(false);
    }
  };

  const scrollToForm = () => {
    window.requestAnimationFrame(() => {
      document.getElementById("outcome-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, ownerId: auth.user?.id || data?.options?.owners?.[0]?.id || "" });
    setShowForm(true);
    scrollToForm();
  };

  const startEdit = (commitment) => {
    setEditingId(commitment.id);
    setForm({
      outcome: commitment.title || "",
      successMeasure: commitment.success_measure || "",
      targetDate: commitment.target_date || dateAfter(30),
      ownerId: commitment.owner_id || "",
      primaryProjectId: commitment.primary_project_id || "",
      sprintIds: commitment.linked_sprint_ids || [],
    });
    setShowForm(true);
    scrollToForm();
  };

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(id);
    try {
      const [response, operating] = await Promise.all([
        api.get(`/assurance/commitments/${id}`),
        api.get(`/assurance/commitments/${id}/operating-record`),
      ]);
      setDetail((current) => ({ ...current, [id]: { ...response.data, operating: operating.data } }));
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not load outcome evidence");
    } finally {
      setDetailLoading(null);
    }
  }, [api]);

  const toggleDetail = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (detail[id]) return;
    await loadDetail(id);
  };

  const openEvidence = (commitment, mode) => {
    setEvidenceDialog({ commitment, mode });
    setEvidenceForm({ label: "", note: "" });
  };

  const submitEvidence = async (event) => {
    event.preventDefault();
    if (!evidenceDialog) return;
    const { commitment, mode } = evidenceDialog;
    setBusyId(commitment.id);
    try {
      if (mode === "complete") {
        const payload = { evidenceLabel: evidenceForm.label, note: evidenceForm.note };
        if (canApproveCompletion) {
          await api.post(`/assurance/commitments/${commitment.id}/complete`, payload);
          toast.success("Outcome completed with result evidence");
        } else {
          await api.post(`/assurance/commitments/${commitment.id}/approval-requests`, {
            ...payload,
            actionType: "complete",
          });
          toast.success("Completion sent for approval");
        }
      } else {
        await api.post(`/assurance/commitments/${commitment.id}/evidence`, {
          evidenceType: "result",
          label: evidenceForm.label,
          note: evidenceForm.note,
        });
        toast.success("Evidence recorded");
      }
      setEvidenceDialog(null);
      setDetail((current) => {
        const next = { ...current };
        delete next[commitment.id];
        return next;
      });
      await load();
      if (expandedId === commitment.id) await loadDetail(commitment.id);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not record evidence");
    } finally {
      setBusyId(null);
    }
  };

  const openConnect = (commitment) => {
    setConnectDialog(commitment);
    setConnectProjectId(commitment.primary_project_id || "");
    setConnectSprintIds(commitment.linked_sprint_ids || []);
  };

  const connectWork = async (event) => {
    event.preventDefault();
    if (!connectDialog) return;
    setBusyId(connectDialog.id);
    try {
      await api.patch(`/assurance/commitments/${connectDialog.id}`, {
        primaryProjectId: connectProjectId || null,
        sprintIds: connectSprintIds,
      });
      toast.success(connectProjectId ? "Project connected" : "Project connection removed");
      setConnectDialog(null);
      setDetail((current) => {
        const next = { ...current };
        delete next[connectDialog.id];
        return next;
      });
      await load();
      if (expandedId === connectDialog.id) await loadDetail(connectDialog.id);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not connect the project");
    } finally {
      setBusyId(null);
    }
  };

  const createRecoveryTask = async (commitment) => {
    setBusyId(commitment.id);
    try {
      if (canApproveRecovery) {
        const response = await api.post(`/assurance/commitments/${commitment.id}/recovery-task`);
        const reference = response.data?.displayId || response.data?.createdTaskId;
        toast.success(reference ? `Recovery task ${reference} created` : "Recovery task created");
      } else {
        await api.post(`/assurance/commitments/${commitment.id}/approval-requests`, { actionType: "recovery" });
        toast.success("Recovery task sent for approval");
      }
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not create recovery task");
    } finally {
      setBusyId(null);
    }
  };

  const startExperiment = async (experiment) => {
    setBusyId(experiment.id);
    try {
      await api.patch(`/assurance/experiments/${experiment.id}`, { status: "active" });
      toast.success("Experiment started");
      await loadDetail(experiment.goal_id);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not start the experiment");
    } finally {
      setBusyId(null);
    }
  };

  const completeExperiment = async (event) => {
    event.preventDefault();
    if (!experimentDialog) return;
    setBusyId(experimentDialog.id);
    try {
      await api.patch(`/assurance/experiments/${experimentDialog.id}`, { status: "completed", ...experimentForm });
      toast.success("Experiment result recorded");
      const goalId = experimentDialog.goal_id;
      setExperimentDialog(null);
      setExperimentForm({ resultStatus: "supported", observedResult: "" });
      await Promise.all([load(), loadDetail(goalId)]);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not record the experiment result");
    } finally {
      setBusyId(null);
    }
  };

  const owners = data?.options?.owners || [];
  const projects = data?.options?.projects || [];
  const sprints = data?.options?.sprints || [];
  const commitments = useMemo(() => data?.commitments || [], [data?.commitments]);
  const summary = data?.summary || { total: 0, needsAttention: 0, verified: 0, pendingDecisions: 0 };
  const canRequestCompletion = data?.capabilities?.canRequestCompletion ?? canManage;
  const canApproveCompletion = data?.capabilities?.canApproveCompletion ?? canManage;
  const canRequestRecovery = data?.capabilities?.canRequestRecovery ?? canManage;
  const canApproveRecovery = data?.capabilities?.canApproveRecovery ?? canManage;
  const showEmptyForm = canManage && commitments.length === 0;
  const attentionByCommitment = useMemo(
    () => new Map((data?.attention || []).map((item) => [item.commitmentId, item])),
    [data?.attention]
  );

  useEffect(() => {
    if (loading || !commitments.length || !location.hash.startsWith("#outcome-")) return undefined;
    const id = location.hash.slice("#outcome-".length);
    if (!commitments.some((item) => String(item.id) === id)) return undefined;
    setExpandedId(id);
    if (!detail[id]) loadDetail(id);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`outcome-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [commitments, detail, loadDetail, loading, location.hash]);

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (!data) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Outcomes could not load"
        description={loadError || "The workspace connection was interrupted. Your existing work has not been changed."}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Execution assurance</p>
          <h1 className="mt-1 flex items-center gap-2 text-[26px] font-semibold tracking-tight text-[color:var(--text)]">
            <Target className="h-6 w-6 text-[color:var(--primary)]" /> Outcomes
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-[color:var(--text-muted)]">
            Define what must happen. Asystence connects the work, surfaces exceptions, and keeps the result provable.
          </p>
        </div>
        {canManage && commitments.length > 0 && (
          <Button onClick={showForm ? closeForm : startCreate} leftIcon={showForm ? null : <Plus className="h-4 w-4" />}>
            {showForm ? "Cancel" : "Add outcome"}
          </Button>
        )}
      </header>

      <AssuranceNav />

      {(showForm || showEmptyForm) && (
        <OutcomeForm
          form={form}
          setForm={setForm}
          owners={owners}
          projects={projects}
          sprints={sprints}
          saving={saving}
          onSubmit={saveOutcome}
          onCancel={commitments.length ? closeForm : null}
          editing={Boolean(editingId)}
        />
      )}

      {commitments.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Outcomes" value={summary.total} note="Visible in your role" />
            <SummaryCard label="Needs attention" value={summary.needsAttention} note="One next action each" />
            <SummaryCard label="Verified" value={summary.verified} note="Backed by result evidence" />
            <SummaryCard label="Awaiting decision" value={summary.pendingDecisions} note="No silent automation" />
          </section>

          <section className="space-y-3">
            {commitments.map((commitment) => {
              const assurance = commitment.assurance || {};
              const meta = statusMeta(assurance.state);
              const attention = attentionByCommitment.get(commitment.id);
              const progress = assurance.taskProgress ?? commitment.progress;
              const expanded = expandedId === commitment.id;
              const canUpdateOutcome = canManage || String(commitment.owner_id) === String(auth.user?.id);
              return (
                <article key={commitment.id} id={`outcome-${commitment.id}`} className="rounded-[10px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        <span className={`text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>
                        <span className="text-[10px] text-[color:var(--text-soft)]">{commitment.priority} priority</span>
                      </div>
                      <h2 className="mt-2 text-[17px] font-semibold text-[color:var(--text)]">{commitment.title}</h2>
                      <p className="mt-2 text-[12px] leading-5 text-[color:var(--text-muted)]">
                        <span className="font-semibold text-[color:var(--text)]">Done means:</span> {commitment.success_measure}
                      </p>
                    </div>
                    <div className="grid min-w-[210px] gap-1 text-[11px] text-[color:var(--text-muted)]">
                      <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {commitment.owner_name || "No owner"}</span>
                      <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(commitment.target_date)}</span>
                      <span className="flex items-center gap-2"><FolderKanban className="h-3.5 w-3.5" /> {commitment.project_name || "Work not connected"}{commitment.linked_sprints?.length ? ` · ${commitment.linked_sprints.length} sprint${commitment.linked_sprints.length === 1 ? "" : "s"}` : ""}</span>
                    </div>
                  </div>

                  {assurance.evidenceStatus === "observed" && progress != null && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] text-[color:var(--text-soft)]">
                        <span>Connected work</span><span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                    <p className="flex min-w-0 items-start gap-2 text-[11px] leading-5 text-[color:var(--text-muted)]">
                      {attention ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--score-warning)]" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--score-good)]" />}
                      <span>{assurance.explanation}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canManage && canRequestRecovery && attention?.action === "create_recovery_task" && (
                        <Button size="sm" loading={busyId === commitment.id} onClick={() => createRecoveryTask(commitment)}>{canApproveRecovery ? "Create recovery task" : "Request recovery task"}</Button>
                      )}
                      {canManage && attention?.action === "connect_work" && (
                        <Button size="sm" variant="secondary" onClick={() => openConnect(commitment)} leftIcon={<Link2 className="h-3.5 w-3.5" />}>
                          Connect work
                        </Button>
                      )}
                      {canUpdateOutcome && assurance.state !== "verified" && (
                        <Button size="sm" variant="secondary" onClick={() => openEvidence(commitment, "evidence")} leftIcon={<FileCheck2 className="h-3.5 w-3.5" />}>Add evidence</Button>
                      )}
                      {canUpdateOutcome && canRequestCompletion && assurance.state !== "verified" && (
                        <Button size="sm" variant="ghost" onClick={() => openEvidence(commitment, "complete")}>{canApproveCompletion ? "Mark complete" : "Request completion"}</Button>
                      )}
                      {canManage && assurance.state !== "verified" && (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(commitment)}>Edit</Button>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={() => toggleDetail(commitment.id)} className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[color:var(--primary)]">
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {expanded ? "Hide evidence" : "View evidence and decisions"}
                  </button>
                  {expanded && (detailLoading === commitment.id
                    ? <div className="flex justify-center py-6"><Spinner size="sm" /></div>
                    : <EvidenceTimeline
                        detail={detail[commitment.id]}
                        canManage={canManage}
                        currentUserId={auth.user?.id}
                        busyId={busyId}
                        onStartExperiment={startExperiment}
                        onRecordExperiment={(experiment) => {
                          setExperimentDialog(experiment);
                          setExperimentForm({ resultStatus: "supported", observedResult: "" });
                        }}
                      />)}
                </article>
              );
            })}
          </section>
        </>
      )}

      {!canManage && commitments.length === 0 && (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="No outcomes are assigned to you"
          description="When an outcome is assigned, you will see its definition, connected work, and evidence here."
        />
      )}

      <Modal isOpen={Boolean(evidenceDialog)} onClose={() => setEvidenceDialog(null)} size="sm">
        <Modal.Header>
          <div>
            <Modal.Title>{evidenceDialog?.mode === "complete" ? (canApproveCompletion ? "Complete with evidence" : "Request completion") : "Record result evidence"}</Modal.Title>
            <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{evidenceDialog?.commitment?.title}</p>
          </div>
        </Modal.Header>
        <form onSubmit={submitEvidence}>
          <Modal.Body className="space-y-4">
            <Field label="What result was observed?">
              <input
                className={inputClass}
                value={evidenceForm.label}
                onChange={(event) => setEvidenceForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Activation improved to 42% in the production report"
                maxLength={500}
                required
                autoFocus
              />
            </Field>
            <Field label="Supporting note" hint="Optional">
              <textarea
                className={`${inputClass} h-24 resize-none py-3`}
                value={evidenceForm.note}
                onChange={(event) => setEvidenceForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Where the result came from or what was checked"
                maxLength={4000}
              />
            </Field>
            <p className="text-[11px] leading-5 text-[color:var(--text-soft)]">Evidence is retained in the workspace audit trail. Corrections are added as new records instead of silently rewriting history.</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setEvidenceDialog(null)}>Cancel</Button>
            <Button type="submit" loading={busyId === evidenceDialog?.commitment?.id}>
              {evidenceDialog?.mode === "complete" ? (canApproveCompletion ? "Complete outcome" : "Send for approval") : "Record evidence"}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal isOpen={Boolean(connectDialog)} onClose={() => setConnectDialog(null)} size="sm">
        <Modal.Header>
          <div>
            <Modal.Title>Connect work</Modal.Title>
            <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{connectDialog?.title}</p>
          </div>
        </Modal.Header>
        <form onSubmit={connectWork}>
          <Modal.Body className="space-y-4">
            {projects.length ? (
              <Field label="Which project delivers this outcome?">
                <select
                  className={inputClass}
                  value={connectProjectId}
                  onChange={(event) => { setConnectProjectId(event.target.value); setConnectSprintIds([]); }}
                  required
                  autoFocus
                >
                  <option value="">Choose a project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </Field>
            ) : (
              <div className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-[12px] font-semibold text-[color:var(--text)]">Create your first project</p>
                <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Projects provide the task evidence that keeps this outcome current.</p>
                <Link to="/projects" onClick={() => setConnectDialog(null)} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--primary)]">
                  Go to projects <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
            {connectProjectId && sprints.some((sprint) => sprint.project_id === connectProjectId) && (
              <fieldset className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-3">
                <legend className="px-1 text-[11px] font-semibold text-[color:var(--text)]">Delivery sprints <span className="font-normal text-[color:var(--text-soft)]">Optional</span></legend>
                <p className="mb-2 text-[10px] text-[color:var(--text-muted)]">Selected sprints make progress outcome-specific. Leave all clear only when every task in the project contributes.</p>
                <div className="space-y-2">
                  {sprints.filter((sprint) => sprint.project_id === connectProjectId).map((sprint) => (
                    <label key={sprint.id} className="flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={connectSprintIds.includes(sprint.id)}
                        onChange={(event) => setConnectSprintIds((current) => event.target.checked
                          ? [...current, sprint.id]
                          : current.filter((id) => id !== sprint.id))}
                      />
                      <span>{sprint.name} · {sprint.status}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setConnectDialog(null)}>Cancel</Button>
            {projects.length > 0 && (
              <Button type="submit" loading={busyId === connectDialog?.id} disabled={!connectProjectId}>Connect project</Button>
            )}
          </Modal.Footer>
        </form>
      </Modal>

      <Modal isOpen={Boolean(experimentDialog)} onClose={() => setExperimentDialog(null)} size="sm">
        <Modal.Header>
          <div>
            <Modal.Title>Record experiment result</Modal.Title>
            <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{experimentDialog?.title}</p>
          </div>
        </Modal.Header>
        <form onSubmit={completeExperiment}>
          <Modal.Body className="space-y-4">
            <Field label="What did the test show?">
              <select className={inputClass} value={experimentForm.resultStatus} onChange={(event) => setExperimentForm((value) => ({ ...value, resultStatus: event.target.value }))}>
                <option value="supported">Supported the hypothesis</option>
                <option value="refuted">Refuted the hypothesis</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
            </Field>
            <Field label="Observed result">
              <textarea className={`${inputClass} h-24 resize-none py-3`} value={experimentForm.observedResult} onChange={(event) => setExperimentForm((value) => ({ ...value, observedResult: event.target.value }))} required autoFocus maxLength={4000} />
            </Field>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setExperimentDialog(null)}>Cancel</Button>
            <Button type="submit" loading={busyId === experimentDialog?.id}>Record result</Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}
