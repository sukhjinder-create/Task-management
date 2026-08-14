import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  FileBarChart,
  GitBranch,
  FlaskConical,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import AssuranceNav from "../components/AssuranceNav";
import DecisionOutcomeLab from "../components/DecisionOutcomeLab";
import { Button, EmptyState, Spinner } from "../components/ui";

const MANAGER_ROLES = new Set(["admin", "manager"]);
const CONFIGURE_ROLES = new Set(["admin"]);
const inputClass = "h-10 w-full rounded-[8px] border border-[color:var(--border)] bg-[var(--surface)] px-3 text-[12px] text-[color:var(--text)] outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]";

function Header({ section }) {
  const meta = {
    inbox: { icon: BellRing, title: "Decision inbox", description: "Every outcome exception and approval that needs a human decision, in one place." },
    lab: { icon: FlaskConical, title: "Decision lab", description: "Record material decisions, test uncertainty, compare one change, and preserve proof without changing work automatically." },
    portfolio: { icon: BriefcaseBusiness, title: "Commitment portfolio", description: "See cross-project commitments and the dependencies that could hold them up." },
    insights: { icon: FileBarChart, title: "Executive assurance", description: "Verified delivery evidence, observed patterns, and compliance-ready exports." },
    policy: { icon: Settings2, title: "Assurance policy", description: "Set the few workspace rules that govern evidence, approvals, and escalation." },
  }[section];
  const Icon = meta.icon;
  return (
    <header>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Execution assurance</p>
      <h1 className="mt-1 flex items-center gap-2 text-[26px] font-semibold tracking-tight text-[color:var(--text)]"><Icon className="h-6 w-6 text-[color:var(--primary)]" /> {meta.title}</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-[color:var(--text-muted)]">{meta.description}</p>
    </header>
  );
}

function Summary({ label, value, note }) {
  return (
    <div className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{value}</p>
      <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{note}</p>
    </div>
  );
}

function useRemote(load) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await load(), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.response?.data?.error || "Could not load this assurance view" });
    }
  }, [load]);
  useEffect(() => {
    let active = true;
    load()
      .then((data) => { if (active) setState({ loading: false, data, error: "" }); })
      .catch((error) => {
        if (active) setState({ loading: false, data: null, error: error.response?.data?.error || "Could not load this assurance view" });
      });
    return () => { active = false; };
  }, [load]);
  return { ...state, reload };
}

function InboxView() {
  const api = useApi();
  const load = useCallback(async () => (await api.get("/assurance/inbox")).data, [api]);
  const state = useRemote(load);
  const [busy, setBusy] = useState(null);

  const decide = async (approval, decision) => {
    setBusy(approval.id);
    try {
      await api.post(`/assurance/approval-requests/${approval.id}/decision`, { decision });
      toast.success(`Request ${decision}`);
      await state.reload();
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not save the decision");
    } finally {
      setBusy(null);
    }
  };

  if (state.loading) return <Spinner size="lg" />;
  if (!state.data) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Decision inbox could not load" description={state.error} action={<Button onClick={state.reload}>Try again</Button>} />;
  const { approvals = [], attention = [], decisionsNeedingReview = [], experimentsNeedingAttention = [], summary = {} } = state.data;
  if (!approvals.length && !attention.length && !decisionsNeedingReview.length && !experimentsNeedingAttention.length) return <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Nothing needs a decision" description="Outcome evidence, decision reviews, and active experiments have no open exceptions for you." />;
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3"><Summary label="Open items" value={summary.total || 0} note="Only items in your role" /><Summary label="Awaiting approval" value={summary.pendingApprovals || 0} note="Human decision required" /></section>
      {approvals.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold text-[color:var(--text)]">Approval requests</h2>
          <div className="space-y-2">
            {approvals.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4">
                <div><p className="text-[13px] font-semibold text-[color:var(--text)]">{item.goal_title}</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.requested_by_name || "Workspace user"} requested {item.action_type === "complete" ? "completion verification" : "a recovery task"}.</p></div>
                {item.canApprove ? <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => decide(item, "rejected")}>Reject</Button><Button size="sm" loading={busy === item.id} onClick={() => decide(item, "approved")}>Approve</Button></div> : <span className="text-[11px] text-[color:var(--text-soft)]">Waiting for an approver</span>}
              </article>
            ))}
          </div>
        </section>
      )}
      {decisionsNeedingReview.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold text-[color:var(--text)]">Decisions ready for an outcome review</h2>
          <div className="space-y-2">{decisionsNeedingReview.map((item) => <Link key={item.id} to={`/outcomes/lab?outcome=${item.goal_id}`} className="flex items-center justify-between gap-3 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4 hover:border-[color:var(--border-strong)]"><div><p className="text-[13px] font-semibold text-[color:var(--text)]">{item.goal_title}</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.selected_option}</p></div><span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[color:var(--primary)]">Review result <ArrowRight className="h-3.5 w-3.5" /></span></Link>)}</div>
        </section>
      )}
      {experimentsNeedingAttention.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold text-[color:var(--text)]">Experiments due for a result</h2>
          <div className="space-y-2">{experimentsNeedingAttention.map((item) => <Link key={item.id} to={`/outcomes/lab?outcome=${item.goal_id}`} className="flex items-center justify-between gap-3 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4 hover:border-[color:var(--border-strong)]"><div><p className="text-[13px] font-semibold text-[color:var(--text)]">{item.title}</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.goal_title}</p></div><span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[color:var(--primary)]">Record result <ArrowRight className="h-3.5 w-3.5" /></span></Link>)}</div>
        </section>
      )}
      {attention.length > 0 && (
        <section>
          <h2 className="mb-2 text-[12px] font-semibold text-[color:var(--text)]">Delivery exceptions</h2>
          <div className="space-y-2">{attention.map((item) => <Link key={item.id} to={`/outcomes#outcome-${item.commitmentId}`} className="flex items-center justify-between gap-3 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4 hover:border-[color:var(--border-strong)]"><div><p className="text-[13px] font-semibold text-[color:var(--text)]">{item.title}</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{item.reason}</p></div><span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[color:var(--primary)]">{item.actionLabel} <ArrowRight className="h-3.5 w-3.5" /></span></Link>)}</div>
        </section>
      )}
    </div>
  );
}

function PortfolioView() {
  const api = useApi();
  const load = useCallback(async () => (await api.get("/assurance/portfolio")).data, [api]);
  const state = useRemote(load);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [portfolioId, setPortfolioId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [predecessorGoalId, setPredecessorGoalId] = useState("");
  const [successorGoalId, setSuccessorGoalId] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (work, success) => {
    setBusy(true);
    try { await work(); toast.success(success); await state.reload(); }
    catch (error) { toast.error(error.response?.data?.error || "Could not save the portfolio"); }
    finally { setBusy(false); }
  };
  const create = (event) => { event.preventDefault(); run(() => api.post("/assurance/portfolios", { name, targetDate: targetDate || null }), "Portfolio created").then(() => { setName(""); setTargetDate(""); }); };
  const link = (event) => { event.preventDefault(); run(() => api.put(`/assurance/portfolios/${portfolioId}/commitments/${goalId}`), "Outcome added to portfolio"); };
  const depend = (event) => { event.preventDefault(); run(() => api.post("/assurance/dependencies", { predecessorGoalId, successorGoalId, dependencyType: "blocks" }), "Dependency recorded"); };

  if (state.loading) return <Spinner size="lg" />;
  if (!state.data) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Portfolio could not load" description={state.error} action={<Button onClick={state.reload}>Try again</Button>} />;
  const portfolios = state.data.portfolios || [];
  const manageablePortfolios = portfolios.filter((item) => item.canManage);
  const commitments = state.data.availableCommitments || [];
  const dependencies = state.data.dependencies || [];
  return (
    <div className="space-y-6">
      <section className="grid gap-3 lg:grid-cols-3">
        <form onSubmit={create} className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-4"><p className="text-[12px] font-semibold text-[color:var(--text)]">Create a portfolio</p><div className="mt-3 space-y-2"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enterprise launch" required maxLength={200} /><input className={inputClass} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /><Button type="submit" size="sm" loading={busy} leftIcon={<Plus className="h-3.5 w-3.5" />}>Create</Button></div></form>
        <form onSubmit={link} className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-4"><p className="text-[12px] font-semibold text-[color:var(--text)]">Add an outcome</p><div className="mt-3 space-y-2"><select className={inputClass} value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} required><option value="">Choose portfolio</option>{manageablePortfolios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className={inputClass} value={goalId} onChange={(e) => setGoalId(e.target.value)} required><option value="">Choose outcome</option>{commitments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button type="submit" size="sm" loading={busy} disabled={!manageablePortfolios.length}>Add</Button></div></form>
        <form onSubmit={depend} className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-4"><p className="text-[12px] font-semibold text-[color:var(--text)]">Connect a dependency</p><div className="mt-3 space-y-2"><select className={inputClass} value={predecessorGoalId} onChange={(e) => setPredecessorGoalId(e.target.value)} required><option value="">Must finish first</option>{commitments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select className={inputClass} value={successorGoalId} onChange={(e) => setSuccessorGoalId(e.target.value)} required><option value="">Outcome it blocks</option>{commitments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button type="submit" size="sm" loading={busy} leftIcon={<GitBranch className="h-3.5 w-3.5" />}>Connect</Button></div></form>
      </section>
      <section className="grid gap-3 lg:grid-cols-2">{portfolios.map((portfolio) => <article key={portfolio.id} className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[14px] font-semibold text-[color:var(--text)]">{portfolio.name}</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{portfolio.summary.verified}/{portfolio.summary.total} verified · {portfolio.summary.needsAttention} need attention</p></div><span className="text-[10px] text-[color:var(--text-soft)]">{portfolio.owner_name || "No owner"}</span></div><div className="mt-3 space-y-1.5">{portfolio.commitments.length ? portfolio.commitments.map((item) => <Link key={item.id} to={`/outcomes#outcome-${item.id}`} className="flex items-center justify-between rounded-[7px] bg-[var(--surface-soft)] px-3 py-2 text-[11px]"><span className="truncate font-medium text-[color:var(--text)]">{item.title}</span><span className="ml-3 shrink-0 text-[color:var(--text-muted)]">{item.assurance.state.replaceAll("_", " ")}</span></Link>) : <p className="text-[11px] text-[color:var(--text-soft)]">No outcomes in this portfolio yet.</p>}</div></article>)}</section>
      {dependencies.length > 0 && <section><h2 className="mb-2 text-[12px] font-semibold text-[color:var(--text)]">Cross-project dependencies</h2><div className="space-y-2">{dependencies.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--border)] bg-[var(--surface)] p-3"><p className="text-[11px] text-[color:var(--text-muted)]"><span className="font-semibold text-[color:var(--text)]">{item.predecessor_title}</span> blocks <span className="font-semibold text-[color:var(--text)]">{item.successor_title}</span></p><button className="text-[color:var(--text-soft)] hover:text-[color:var(--score-danger)]" onClick={() => run(() => api.delete(`/assurance/dependencies/${item.id}`), "Dependency removed")} aria-label="Remove dependency"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></section>}
    </div>
  );
}

function InsightsView() {
  const api = useApi();
  const load = useCallback(async () => (await api.get("/assurance/executive-report")).data, [api]);
  const state = useRemote(load);
  const [downloading, setDownloading] = useState("");
  const download = async (format) => {
    setDownloading(format);
    try {
      const response = await api.get(`/assurance/export?format=${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = `assurance-${new Date().toISOString().slice(0, 10)}.${format}`; link.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} assurance export created`);
      await state.reload();
    } catch (error) { toast.error(error.response?.data?.error || "Could not generate the export"); }
    finally { setDownloading(""); }
  };
  if (state.loading) return <Spinner size="lg" />;
  if (!state.data) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Executive assurance could not load" description={state.error} action={<Button onClick={state.reload}>Try again</Button>} />;
  const report = state.data;
  const coverage = report.evidenceCoverage || {};
  const learning = report.learning || {};
  const decisionOutcome = report.decisionOutcome || {};
  const decisionLearning = decisionOutcome.decisions || {};
  const experiments = decisionOutcome.experiments || {};
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="Outcomes" value={report.summary.total || 0} note="Workspace commitments" /><Summary label="Verified" value={report.summary.verified || 0} note="Result evidence recorded" /><Summary label="Evidence records" value={coverage.total || 0} note={`${coverage.external || 0} captured from integrations`} /><Summary label="Open decisions" value={report.summary.pendingDecisions || 0} note="Awaiting a human" /></section>
      <section className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[12px] font-semibold text-[color:var(--text)]">Organizational memory</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Patterns appear only after {learning.requiredSampleSize || 3} verified outcomes. No estimate is shown before that threshold.</p></div><span className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[10px] text-[color:var(--text-soft)]">{learning.sampleSize || 0} verified samples</span></div><div className="mt-4 space-y-2">{learning.patterns?.length ? learning.patterns.map((pattern) => <div key={pattern.id || pattern.pattern_key} className="rounded-[8px] bg-[var(--surface-soft)] p-3"><div className="flex items-center justify-between gap-3"><p className="text-[12px] font-semibold text-[color:var(--text)]">{pattern.title}</p><span className="text-[10px] text-[color:var(--text-soft)]">{pattern.confidence_label}</span></div><p className="mt-1 text-[11px] leading-5 text-[color:var(--text-muted)]">{pattern.statement}</p></div>) : <p className="text-[12px] text-[color:var(--text-soft)]">Learning will begin as real outcomes are verified.</p>}</div></section>
      <section className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[12px] font-semibold text-[color:var(--text)]">Decision-to-outcome intelligence</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Material choices, reversible tests, and observed results. Decision activity never increases employee or workspace scores.</p></div><span className="rounded-full border border-[color:var(--border)] px-2 py-1 text-[10px] text-[color:var(--text-soft)]">{decisionLearning.effectivenessStatus || "learning"}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="Decisions" value={decisionLearning.total || 0} note={`${decisionLearning.reviewed || 0} observed-result reviews`} /><Summary label="Effectiveness" value={decisionLearning.effectiveRate == null ? "Learning" : `${decisionLearning.effectiveRate}%`} note="Observed, not causal" /><Summary label="Experiments" value={experiments.completed || 0} note={`${experiments.active || 0} active now`} /><Summary label="Proof receipts" value={decisionOutcome.receiptsIssued || 0} note={`${decisionOutcome.scenarioAnalyses || 0} scenario comparisons`} /></div>
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-5"><div><p className="text-[12px] font-semibold text-[color:var(--text)]">Compliance export</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Each export is workspace-scoped, audit logged, and has a stored SHA-256 manifest.</p></div><div className="flex gap-2"><Button variant="secondary" loading={downloading === "csv"} onClick={() => download("csv")} leftIcon={<Download className="h-3.5 w-3.5" />}>CSV</Button><Button loading={downloading === "json"} onClick={() => download("json")} leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}>Assurance package</Button></div></section>
    </div>
  );
}

function PolicyView() {
  const api = useApi();
  const { auth } = useAuth();
  const canConfigure = CONFIGURE_ROLES.has(String(auth.user?.role || "").toLowerCase());
  const load = useCallback(async () => {
    const [policy, adaptive] = await Promise.all([
      api.get("/assurance/policy"),
      api.get("/assurance/adaptive-policy-proposals"),
    ]);
    return { policy: policy.data.policy, adaptive: adaptive.data };
  }, [api]);
  const state = useRemote(load);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [proposalBusy, setProposalBusy] = useState("");
  useEffect(() => { if (state.data?.policy) setForm(state.data.policy); }, [state.data]);
  const toggleRole = (action, permission, role) => {
    setForm((current) => {
      const existing = current.approvalMatrix?.[action]?.[permission] || [];
      const nextRoles = existing.includes(role) ? existing.filter((item) => item !== role) : [...existing, role];
      return {
        ...current,
        approvalMatrix: {
          ...current.approvalMatrix,
          [action]: { ...current.approvalMatrix[action], [permission]: nextRoles },
        },
      };
    });
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try { const response = await api.put("/assurance/policy", form); setForm(response.data.policy); toast.success("Assurance policy updated"); await state.reload(); }
    catch (error) { toast.error(error.response?.data?.error || "Could not update the policy"); }
    finally { setSaving(false); }
  };
  const refreshProposals = async () => {
    setProposalBusy("refresh");
    try {
      await api.post("/assurance/adaptive-policy-proposals/refresh");
      toast.success("Policy evidence reviewed");
      await state.reload();
    } catch (error) { toast.error(error.response?.data?.error || "Could not review policy evidence"); }
    finally { setProposalBusy(""); }
  };
  const decideProposal = async (proposal, decision) => {
    setProposalBusy(proposal.id);
    try {
      await api.post(`/assurance/adaptive-policy-proposals/${proposal.id}/decision`, {
        decision,
        acknowledgeObservationalEvidence: decision === "approved",
        note: decision === "approved"
          ? "Admin acknowledged the observational evidence and applied the bounded recommendation."
          : "Admin retained the current workspace policy.",
      });
      toast.success(decision === "approved" ? "Policy proposal applied" : "Policy proposal rejected");
      await state.reload();
    } catch (error) { toast.error(error.response?.data?.error || "Could not review the policy proposal"); }
    finally { setProposalBusy(""); }
  };
  if (state.loading) return <Spinner size="lg" />;
  if (!state.data) return <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="Policy could not load" description={state.error} action={<Button onClick={state.reload}>Try again</Button>} />;
  if (!form) return <Spinner size="lg" />;
  return (
    <form onSubmit={save} className="space-y-5">
      <section className="grid gap-4 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5 md:grid-cols-3"><label className="text-[12px] font-semibold text-[color:var(--text)]">Warn before target date<span className="mt-1 block text-[11px] font-normal text-[color:var(--text-muted)]">Days before an unfinished outcome needs review.</span><input type="number" min="1" max="90" disabled={!canConfigure} className={`${inputClass} mt-2`} value={form.riskWindowDays} onChange={(e) => setForm((v) => ({ ...v, riskWindowDays: Number(e.target.value) }))} /></label><label className="text-[12px] font-semibold text-[color:var(--text)]">Learning threshold<span className="mt-1 block text-[11px] font-normal text-[color:var(--text-muted)]">Verified outcomes required before a pattern is published.</span><input type="number" min="3" max="100" disabled={!canConfigure} className={`${inputClass} mt-2`} value={form.minimumPatternSample} onChange={(e) => setForm((v) => ({ ...v, minimumPatternSample: Number(e.target.value) }))} /></label><label className="text-[12px] font-semibold text-[color:var(--text)]">Decision review window<span className="mt-1 block text-[11px] font-normal text-[color:var(--text-muted)]">Days before a recorded decision asks for its observed result.</span><input type="number" min="1" max="180" disabled={!canConfigure} className={`${inputClass} mt-2`} value={form.decisionReviewDays} onChange={(e) => setForm((v) => ({ ...v, decisionReviewDays: Number(e.target.value) }))} /></label></section>
      <section className="space-y-3 rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5"><p className="text-[12px] font-semibold text-[color:var(--text)]">Evidence and alerts</p><div className="flex items-start gap-3 rounded-[8px] bg-[var(--surface-soft)] p-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-[color:var(--score-good)]" /><span><span className="block text-[12px] font-medium text-[color:var(--text)]">Result evidence is always required</span><span className="mt-0.5 block text-[11px] text-[color:var(--text-muted)]">An outcome cannot be verified from a status change alone. This assurance safeguard cannot be disabled.</span></span></div>{[["automaticExternalEvidence", "Capture evidence from connected enterprise systems", "Completed and blocked external work is retained with provider provenance."], ["notifyOnStateChange", "Notify owners when assurance state changes", "Actionable transitions appear in the unified notification inbox."]].map(([key, title, description]) => <label key={key} className="flex items-start gap-3 rounded-[8px] bg-[var(--surface-soft)] p-3"><input type="checkbox" className="mt-0.5" disabled={!canConfigure} checked={Boolean(form[key])} onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.checked }))} /><span><span className="block text-[12px] font-medium text-[color:var(--text)]">{title}</span><span className="mt-0.5 block text-[11px] text-[color:var(--text-muted)]">{description}</span></span></label>)}</section>
      <section className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
        <p className="text-[12px] font-semibold text-[color:var(--text)]">Approval matrix</p>
        <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Choose which leadership roles may verify completion or authorize recovery. At least one approver is always retained.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[{ action: "complete", title: "Verify completion" }, { action: "recovery", title: "Authorize recovery" }].map(({ action, title }) => (
            <div key={action} className="rounded-[8px] bg-[var(--surface-soft)] p-3">
              <p className="text-[11px] font-semibold text-[color:var(--text)]">{title}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {["manager", "admin"].map((role) => (
                  <label key={role} className="flex items-center gap-1.5 text-[11px] capitalize text-[color:var(--text-muted)]">
                    <input
                      type="checkbox"
                      disabled={!canConfigure || ((form.approvalMatrix?.[action]?.approveRoles?.includes(role) || false) && form.approvalMatrix[action].approveRoles.length === 1)}
                      checked={form.approvalMatrix?.[action]?.approveRoles?.includes(role) || false}
                      onChange={() => toggleRole(action, "approveRoles", role)}
                    /> {role}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-[8px] bg-[var(--surface-soft)] p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            disabled={!canConfigure}
            checked={form.approvalMatrix?.complete?.requestRoles?.includes("user") || false}
            onChange={(event) => setForm((current) => {
              const base = (current.approvalMatrix.complete.requestRoles || []).filter((role) => role !== "user");
              const requestRoles = event.target.checked ? [...base, "user"] : base;
              return { ...current, approvalMatrix: { ...current.approvalMatrix, complete: { ...current.approvalMatrix.complete, requestRoles } } };
            })}
          />
          <span><span className="block text-[12px] font-medium text-[color:var(--text)]">Users may request completion</span><span className="mt-0.5 block text-[11px] text-[color:var(--text-muted)]">Only the assigned outcome owner can request it, and a manager or admin still decides.</span></span>
        </label>
      </section>
      <section className="rounded-[9px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[12px] font-semibold text-[color:var(--text)]">Adaptive policy review</p><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">Asystence may propose a bounded review-window change after enough verified outcomes. It can never apply a proposal without an admin decision.</p></div>
          <Button type="button" size="sm" variant="secondary" loading={proposalBusy === "refresh"} onClick={refreshProposals}>Review current evidence</Button>
        </div>
        <p className="mt-3 text-[10px] text-[color:var(--text-soft)]">{state.data?.adaptive?.sampleSize || 0} of {state.data?.adaptive?.requiredSampleSize || form.minimumPatternSample} verified samples available.</p>
        <div className="mt-3 space-y-2">
          {(state.data?.adaptive?.proposals || []).filter((item) => item.status === "candidate").map((proposal) => (
            <article key={proposal.id} className="rounded-[8px] bg-[var(--surface-soft)] p-3">
              <p className="text-[11px] font-semibold text-[color:var(--text)]">Change the risk review window from {String(proposal.current_value)} to {String(proposal.proposed_value)} days</p>
              <p className="mt-1 text-[11px] leading-5 text-[color:var(--text-muted)]">{proposal.rationale}</p>
              <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">Observational evidence; this is not a causal claim.</p>
              <div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={proposalBusy === proposal.id} onClick={() => decideProposal(proposal, "rejected")}>Keep current policy</Button><Button type="button" size="sm" loading={proposalBusy === proposal.id} onClick={() => decideProposal(proposal, "approved")}>Acknowledge and apply</Button></div>
            </article>
          ))}
          {!(state.data?.adaptive?.proposals || []).some((item) => item.status === "candidate") && <p className="text-[11px] text-[color:var(--text-soft)]">No policy change is currently justified by the verified evidence.</p>}
        </div>
      </section>
      {canConfigure && <Button type="submit" loading={saving}>Save policy</Button>}
    </form>
  );
}

export default function AssuranceCenter() {
  const { section } = useParams();
  const { auth } = useAuth();
  const role = String(auth.user?.role || "").toLowerCase();
  const canManage = MANAGER_ROLES.has(role);
  const canConfigure = CONFIGURE_ROLES.has(role);
  const allowed = section === "inbox" || (section === "lab" && canManage) || (section === "portfolio" && canManage) || (section === "insights" && canManage) || (section === "policy" && canConfigure);
  if (!allowed) return <Navigate to="/outcomes" replace />;
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6">
      <Header section={section} />
      <AssuranceNav />
      {section === "inbox" && <InboxView />}
      {section === "lab" && <DecisionOutcomeLab />}
      {section === "portfolio" && <PortfolioView />}
      {section === "insights" && <InsightsView />}
      {section === "policy" && <PolicyView />}
    </div>
  );
}
