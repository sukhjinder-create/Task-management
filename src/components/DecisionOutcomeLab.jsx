import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FlaskConical,
  GitCompareArrows,
  Lightbulb,
  Play,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useApi } from "../api";
import { Button, EmptyState, Modal, Spinner } from "./ui";

const inputClass = "h-10 w-full rounded-[8px] border border-[color:var(--border)] bg-[var(--surface)] px-3 text-[12px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]";
const textAreaClass = `${inputClass} h-24 resize-none py-3`;

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-[color:var(--text)]">{label}</span>
      {hint && <span className="ml-2 text-[10px] text-[color:var(--text-soft)]">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function dateLabel(value) {
  if (!value) return "No review date";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date)
    : String(value);
}

function toneForDirection(direction) {
  if (direction === "improved") return "text-[color:var(--score-good)]";
  if (direction === "worsened") return "text-[color:var(--score-danger)]";
  return "text-[color:var(--text-muted)]";
}

const EMPTY_DECISION = {
  question: "",
  selectedOption: "",
  alternatives: "",
  rationale: "",
  expectedEffect: "",
  confidence: "",
  reversibility: "reversible",
};

const EMPTY_EXPERIMENT = {
  title: "",
  hypothesis: "",
  smallestTest: "",
  successMeasure: "",
  expectedInformation: "",
  dueDate: "",
};

export default function DecisionOutcomeLab() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState(searchParams.get("outcome") || "");
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionForm, setDecisionForm] = useState(EMPTY_DECISION);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [experimentForm, setExperimentForm] = useState(EMPTY_EXPERIMENT);
  const [reviewing, setReviewing] = useState(null);
  const [reviewForm, setReviewForm] = useState({ effectiveness: "effective", observedResult: "" });
  const [completing, setCompleting] = useState(null);
  const [experimentResult, setExperimentResult] = useState({ resultStatus: "supported", observedResult: "" });
  const [scenarioType, setScenarioType] = useState("resolve_blockers");
  const [scenario, setScenario] = useState(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/assurance/overview");
      const next = response.data || { commitments: [] };
      setOverview(next);
      setError("");
      setSelectedId((current) => current || next.commitments?.[0]?.id || "");
    } catch (requestError) {
      setOverview(null);
      setError(requestError.response?.data?.error || "Could not load decision guidance");
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadBundle = useCallback(async (goalId) => {
    if (!goalId) { setBundle(null); return; }
    setBundleLoading(true);
    try {
      const [lab, record] = await Promise.all([
        api.get(`/assurance/commitments/${goalId}/decision-lab`),
        api.get(`/assurance/commitments/${goalId}/operating-record`),
      ]);
      setBundle({ lab: lab.data, record: record.data });
      setError("");
    } catch (requestError) {
      setBundle(null);
      setError(requestError.response?.data?.error || "Could not load this outcome's decision record");
    } finally {
      setBundleLoading(false);
    }
  }, [api]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { if (selectedId) loadBundle(selectedId); }, [loadBundle, selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const next = new URLSearchParams(searchParams);
    if (next.get("outcome") === selectedId) return;
    next.set("outcome", selectedId);
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedId, setSearchParams]);

  const selected = useMemo(
    () => (overview?.commitments || []).find((item) => item.id === selectedId) || null,
    [overview?.commitments, selectedId]
  );

  const refresh = async () => {
    await Promise.all([loadOverview(), loadBundle(selectedId)]);
  };

  const startSuggestedExperiment = async () => {
    const draft = bundle?.lab?.recommendation?.experimentDraft;
    if (!draft) return;
    setBusy("suggested-experiment");
    try {
      await api.post(`/assurance/commitments/${selectedId}/experiments`, { ...draft, startNow: true });
      toast.success("The reversible test is active");
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not start the experiment");
    } finally {
      setBusy("");
    }
  };

  const saveDecision = async (event) => {
    event.preventDefault();
    setBusy("decision");
    try {
      await api.post(`/assurance/commitments/${selectedId}/decisions`, {
        ...decisionForm,
        alternatives: decisionForm.alternatives.split("\n").map((item) => item.trim()).filter(Boolean),
        confidence: decisionForm.confidence === "" ? null : Number(decisionForm.confidence),
      });
      setDecisionOpen(false);
      setDecisionForm(EMPTY_DECISION);
      toast.success("Decision and review date recorded");
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not record the decision");
    } finally {
      setBusy("");
    }
  };

  const saveDecisionReview = async (event) => {
    event.preventDefault();
    if (!reviewing) return;
    setBusy(`review-${reviewing.id}`);
    try {
      await api.post(`/assurance/decisions/${reviewing.id}/reviews`, reviewForm);
      setReviewing(null);
      setReviewForm({ effectiveness: "effective", observedResult: "" });
      toast.success("Observed decision result recorded");
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not record the observed result");
    } finally {
      setBusy("");
    }
  };

  const saveExperiment = async (event) => {
    event.preventDefault();
    setBusy("new-experiment");
    try {
      await api.post(`/assurance/commitments/${selectedId}/experiments`, {
        ...experimentForm,
        startNow: true,
      });
      setExperimentOpen(false);
      setExperimentForm(EMPTY_EXPERIMENT);
      toast.success("The reversible test is active");
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not start the experiment");
    } finally {
      setBusy("");
    }
  };

  const updateExperiment = async (experiment, payload, message) => {
    setBusy(`experiment-${experiment.id}`);
    try {
      await api.patch(`/assurance/experiments/${experiment.id}`, payload);
      toast.success(message);
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not update the experiment");
    } finally {
      setBusy("");
    }
  };

  const completeExperiment = async (event) => {
    event.preventDefault();
    if (!completing) return;
    await updateExperiment(completing, { status: "completed", ...experimentResult }, "Experiment result recorded");
    setCompleting(null);
    setExperimentResult({ resultStatus: "supported", observedResult: "" });
  };

  const compareScenario = async () => {
    if (!selected) return;
    const blockerCount = Number(selected.assurance?.counts?.blockedTasks || 0) + Number(selected.assurance?.counts?.blockedDependencies || 0);
    const payloads = {
      resolve_blockers: { name: "Resolve known blockers", resolveBlockedItems: Math.max(1, blockerCount) },
      add_capacity: { name: "Add focused capacity", capacityDeltaPercent: 10 },
      move_date: { name: "Move target by seven days", targetDateShiftDays: 7 },
      reduce_scope: { name: "Reduce reversible scope", scopeReductionPercent: 10 },
      validate_first: { name: "Validate before committing", runValidationExperiment: true },
    };
    setBusy("scenario");
    try {
      const response = await api.post(`/assurance/commitments/${selectedId}/scenarios`, payloads[scenarioType]);
      setScenario(response.data.scenario);
      toast.success("Scenario compared without changing work");
      await loadBundle(selectedId);
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not compare the scenario");
    } finally {
      setBusy("");
    }
  };

  const generateReceipt = async () => {
    setBusy("receipt");
    try {
      const created = await api.post(`/assurance/commitments/${selectedId}/receipts`, {
        includePeople: false,
        includeEvidenceNotes: false,
        includeDecisionRationale: true,
      });
      const receipt = created.data.receipt;
      const response = await api.get(`/assurance/receipts/${receipt.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `outcome-receipt-v${receipt.version}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Tamper-evident outcome receipt downloaded");
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not generate the receipt");
    } finally {
      setBusy("");
    }
  };

  const downloadExistingReceipt = async (receipt) => {
    setBusy(`receipt-${receipt.id}`);
    try {
      const response = await api.get(`/assurance/receipts/${receipt.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `outcome-receipt-v${receipt.version}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Outcome receipt v${receipt.version} downloaded`);
    } catch (requestError) {
      toast.error(requestError.response?.data?.error || "Could not download the receipt");
    } finally {
      setBusy("");
    }
  };

  if (loading) return <div className="flex min-h-[260px] items-center justify-center"><Spinner size="lg" /></div>;
  if (!overview) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Decision guidance could not load" description={error} action={<Button onClick={loadOverview}>Try again</Button>} />;
  if (!(overview.commitments || []).length) return <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="Create an outcome first" description="Decision guidance begins only after a manager defines a measurable outcome." />;

  const record = bundle?.record || {};
  const recommendation = bundle?.lab?.recommendation;
  const displayedScenario = scenario || record.scenarios?.[0] || null;
  const scenarioResult = displayedScenario?.result || null;

  return (
    <div className="space-y-5">
      <section className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <Field label="Outcome to decide">
          <select className={inputClass} value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setScenario(null); }}>
            {(overview.commitments || []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </Field>
      </section>

      {bundleLoading ? <div className="flex min-h-[240px] items-center justify-center"><Spinner size="lg" /></div> : !bundle ? (
        <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="This decision record could not load" description={error} action={<Button onClick={() => loadBundle(selectedId)}>Try again</Button>} />
      ) : (
        <>
          <section className="rounded-[10px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">One next decision</p>
                <h2 className="mt-2 text-[17px] font-semibold text-[color:var(--text)]">{recommendation?.label || "No intervention needed"}</h2>
                <p className="mt-2 text-[12px] leading-5 text-[color:var(--text-muted)]">{recommendation?.why}</p>
                <p className="mt-2 text-[10px] text-[color:var(--text-soft)]">Confidence: {recommendation?.confidence || "not available"}. No work or policy changes automatically.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendation?.experimentDraft && <Button loading={busy === "suggested-experiment"} onClick={startSuggestedExperiment} leftIcon={<FlaskConical className="h-4 w-4" />}>Start suggested test</Button>}
                <Button variant="secondary" onClick={() => setExperimentOpen(true)} leftIcon={<FlaskConical className="h-4 w-4" />}>Design a test</Button>
                <Button variant="secondary" onClick={() => setDecisionOpen(true)} leftIcon={<Scale className="h-4 w-4" />}>Record decision</Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2"><GitCompareArrows className="h-4 w-4 text-[color:var(--primary)]" /><h2 className="text-[13px] font-semibold text-[color:var(--text)]">Compare one change</h2></div>
              <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Directional decision support only. Comparing does not alter tasks, dates, capacity, or scores.</p>
              <div className="mt-4 flex gap-2">
                <select className={inputClass} value={scenarioType} onChange={(event) => setScenarioType(event.target.value)}>
                  <option value="resolve_blockers">Resolve known blockers</option>
                  <option value="add_capacity">Add 10% focused capacity</option>
                  <option value="move_date">Move target by seven days</option>
                  <option value="reduce_scope">Reduce reversible scope by 10%</option>
                  <option value="validate_first">Validate before committing</option>
                </select>
                <Button loading={busy === "scenario"} onClick={compareScenario}>Compare</Button>
              </div>
              {scenarioResult && (
                <div className="mt-4 rounded-[8px] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-[color:var(--text)]">Latest comparison</p><span className={`text-[11px] font-semibold capitalize ${toneForDirection(scenarioResult.direction)}`}>{scenarioResult.direction}</span></div>
                  <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">Confidence: {scenarioResult.confidenceLabel}. Evidence: {scenarioResult.evidenceStatus?.replaceAll("_", " ")}.</p>
                  {scenarioResult.proposed?.materialChanges?.length > 0 && <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">Compared: {scenarioResult.proposed.materialChanges.join(", ")}.</p>}
                  {scenarioResult.remainingRisks?.length > 0 && <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Still exposed: {scenarioResult.remainingRisks.join("; ")}.</p>}
                  {scenarioResult.unknowns?.length > 0 && <p className="mt-1 text-[10px] leading-4 text-[color:var(--text-soft)]">Unknown: {scenarioResult.unknowns.join(" ")}</p>}
                </div>
              )}
            </div>

            <div className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[color:var(--primary)]" /><h2 className="text-[13px] font-semibold text-[color:var(--text)]">Proof-of-execution receipt</h2></div>
              <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-muted)]">Download the outcome, evidence, decisions, experiments, and approvals as an immutable SHA-256 package. People and evidence notes are excluded by default.</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[10px] text-[color:var(--text-soft)]">{record.receipts?.length || 0} receipt version(s)</span>
                <div className="flex flex-wrap justify-end gap-2">
                  {record.receipts?.[0] && <Button variant="ghost" loading={busy === `receipt-${record.receipts[0].id}`} onClick={() => downloadExistingReceipt(record.receipts[0])}>Download latest</Button>}
                  <Button loading={busy === "receipt"} onClick={generateReceipt} leftIcon={<Download className="h-4 w-4" />}>Generate new</Button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[13px] font-semibold text-[color:var(--text)]">Decision memory</h2>
              <div className="mt-3 space-y-2">
                {record.decisions?.length ? record.decisions.map((item) => (
                  <article key={item.id} className="rounded-[8px] bg-[var(--surface-soft)] p-3">
                    <p className="text-[11px] font-semibold text-[color:var(--text)]">{item.question}</p>
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Chose: {item.selected_option}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[color:var(--text-soft)]">Why: {item.rationale}</p>
                    <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">{item.reversibility?.replaceAll("_", " ")} · review {dateLabel(item.review_due_at)}</p>
                    {item.latest_review_id ? <><p className="mt-2 flex items-start gap-1 text-[10px] font-semibold text-[color:var(--score-good)]"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" /> {item.latest_effectiveness}: {item.latest_observed_result}</p><Button className="mt-1" size="sm" variant="ghost" onClick={() => setReviewing(item)}>Add later review</Button></> : <Button className="mt-2" size="sm" variant="ghost" onClick={() => setReviewing(item)}>Review result</Button>}
                  </article>
                )) : <p className="text-[11px] text-[color:var(--text-soft)]">No material decisions are recorded yet.</p>}
              </div>
            </div>

            <div className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-[13px] font-semibold text-[color:var(--text)]">Reversible experiments</h2>
              <div className="mt-3 space-y-2">
                {record.experiments?.length ? record.experiments.map((item) => (
                  <article key={item.id} className="rounded-[8px] bg-[var(--surface-soft)] p-3">
                    <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-semibold text-[color:var(--text)]">{item.title}</p><span className="text-[10px] font-semibold uppercase text-[color:var(--text-soft)]">{item.status}</span></div>
                    <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.smallest_test}</p>
                    <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">Owner: {item.owner_name || "Unassigned"} · due {dateLabel(item.due_date)}</p>
                    {item.status === "planned" && <Button className="mt-2" size="sm" variant="ghost" loading={busy === `experiment-${item.id}`} onClick={() => updateExperiment(item, { status: "active" }, "Experiment started")} leftIcon={<Play className="h-3 w-3" />}>Start</Button>}
                    {item.status === "active" && <Button className="mt-2" size="sm" variant="ghost" onClick={() => setCompleting(item)}>Record result</Button>}
                    {item.status === "completed" && <p className="mt-2 text-[10px] font-semibold text-[color:var(--score-good)]">{item.result_status}: {item.observed_result}</p>}
                  </article>
                )) : <p className="text-[11px] text-[color:var(--text-soft)]">No experiment is needed unless a material uncertainty appears.</p>}
              </div>
            </div>
          </section>
        </>
      )}

      <Modal isOpen={decisionOpen} onClose={() => setDecisionOpen(false)} size="md">
        <Modal.Header><Modal.Title>Record a material decision</Modal.Title></Modal.Header>
        <form onSubmit={saveDecision}>
          <Modal.Body className="space-y-4">
            <Field label="What decision was required?"><input className={inputClass} value={decisionForm.question} onChange={(event) => setDecisionForm((value) => ({ ...value, question: event.target.value }))} maxLength={1000} required autoFocus /></Field>
            <Field label="What was chosen?"><input className={inputClass} value={decisionForm.selectedOption} onChange={(event) => setDecisionForm((value) => ({ ...value, selectedOption: event.target.value }))} maxLength={1000} required /></Field>
            <Field label="Why?" hint="Required for an auditable record"><textarea className={textAreaClass} value={decisionForm.rationale} onChange={(event) => setDecisionForm((value) => ({ ...value, rationale: event.target.value }))} maxLength={4000} required /></Field>
            <Field label="What do you expect to change?" hint="Optional"><input className={inputClass} value={decisionForm.expectedEffect} onChange={(event) => setDecisionForm((value) => ({ ...value, expectedEffect: event.target.value }))} maxLength={2000} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Reversibility"><select className={inputClass} value={decisionForm.reversibility} onChange={(event) => setDecisionForm((value) => ({ ...value, reversibility: event.target.value }))}><option value="reversible">Reversible</option><option value="partially_reversible">Partly reversible</option><option value="irreversible">Irreversible</option></select></Field>
              <Field label="Confidence" hint="Optional, 0-100"><input type="number" min="0" max="100" className={inputClass} value={decisionForm.confidence} onChange={(event) => setDecisionForm((value) => ({ ...value, confidence: event.target.value }))} /></Field>
            </div>
            <Field label="Other options considered" hint="Optional, one per line"><textarea className={textAreaClass} value={decisionForm.alternatives} onChange={(event) => setDecisionForm((value) => ({ ...value, alternatives: event.target.value }))} /></Field>
          </Modal.Body>
          <Modal.Footer><Button variant="ghost" onClick={() => setDecisionOpen(false)}>Cancel</Button><Button type="submit" loading={busy === "decision"}>Record decision</Button></Modal.Footer>
        </form>
      </Modal>

      <Modal isOpen={experimentOpen} onClose={() => setExperimentOpen(false)} size="md">
        <Modal.Header><Modal.Title>Design the smallest reversible test</Modal.Title></Modal.Header>
        <form onSubmit={saveExperiment}>
          <Modal.Body className="space-y-4">
            <Field label="Test name"><input className={inputClass} value={experimentForm.title} onChange={(event) => setExperimentForm((value) => ({ ...value, title: event.target.value }))} maxLength={500} required autoFocus /></Field>
            <Field label="What must be true?" hint="Hypothesis"><textarea className={textAreaClass} value={experimentForm.hypothesis} onChange={(event) => setExperimentForm((value) => ({ ...value, hypothesis: event.target.value }))} maxLength={3000} required /></Field>
            <Field label="What is the smallest safe test?"><textarea className={textAreaClass} value={experimentForm.smallestTest} onChange={(event) => setExperimentForm((value) => ({ ...value, smallestTest: event.target.value }))} maxLength={3000} required /></Field>
            <Field label="What result will answer it?"><input className={inputClass} value={experimentForm.successMeasure} onChange={(event) => setExperimentForm((value) => ({ ...value, successMeasure: event.target.value }))} maxLength={2000} required /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="What will you learn?" hint="Optional"><input className={inputClass} value={experimentForm.expectedInformation} onChange={(event) => setExperimentForm((value) => ({ ...value, expectedInformation: event.target.value }))} maxLength={2000} /></Field>
              <Field label="Result due" hint="Optional"><input type="date" min={new Date().toISOString().slice(0, 10)} className={inputClass} value={experimentForm.dueDate} onChange={(event) => setExperimentForm((value) => ({ ...value, dueDate: event.target.value }))} /></Field>
            </div>
          </Modal.Body>
          <Modal.Footer><Button variant="ghost" onClick={() => setExperimentOpen(false)}>Cancel</Button><Button type="submit" loading={busy === "new-experiment"}>Start test</Button></Modal.Footer>
        </form>
      </Modal>

      <Modal isOpen={Boolean(reviewing)} onClose={() => setReviewing(null)} size="sm">
        <Modal.Header><div><Modal.Title>Review the observed result</Modal.Title><p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{reviewing?.selected_option}</p></div></Modal.Header>
        <form onSubmit={saveDecisionReview}>
          <Modal.Body className="space-y-4">
            <Field label="What happened?"><select className={inputClass} value={reviewForm.effectiveness} onChange={(event) => setReviewForm((value) => ({ ...value, effectiveness: event.target.value }))}><option value="effective">Effective</option><option value="mixed">Partly effective</option><option value="ineffective">Ineffective</option><option value="inconclusive">Inconclusive</option></select></Field>
            <Field label="Observed result"><textarea className={textAreaClass} value={reviewForm.observedResult} onChange={(event) => setReviewForm((value) => ({ ...value, observedResult: event.target.value }))} required autoFocus maxLength={4000} /></Field>
          </Modal.Body>
          <Modal.Footer><Button variant="ghost" onClick={() => setReviewing(null)}>Cancel</Button><Button type="submit" loading={busy === `review-${reviewing?.id}`}>Record result</Button></Modal.Footer>
        </form>
      </Modal>

      <Modal isOpen={Boolean(completing)} onClose={() => setCompleting(null)} size="sm">
        <Modal.Header><div><Modal.Title>Record experiment result</Modal.Title><p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{completing?.title}</p></div></Modal.Header>
        <form onSubmit={completeExperiment}>
          <Modal.Body className="space-y-4">
            <Field label="What did the test show?"><select className={inputClass} value={experimentResult.resultStatus} onChange={(event) => setExperimentResult((value) => ({ ...value, resultStatus: event.target.value }))}><option value="supported">Supported the hypothesis</option><option value="refuted">Refuted the hypothesis</option><option value="inconclusive">Inconclusive</option></select></Field>
            <Field label="Observed result"><textarea className={textAreaClass} value={experimentResult.observedResult} onChange={(event) => setExperimentResult((value) => ({ ...value, observedResult: event.target.value }))} required autoFocus maxLength={4000} /></Field>
          </Modal.Body>
          <Modal.Footer><Button variant="ghost" onClick={() => setCompleting(null)}>Cancel</Button><Button type="submit" loading={busy === `experiment-${completing?.id}`}>Complete experiment</Button></Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}
