import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, FolderKanban, Target, UserPlus } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Skeleton } from "./ui";

const MANAGER_ROLES = new Set(["admin", "manager"]);

export default function OutcomeAttention() {
  const api = useApi();
  const { auth } = useAuth();
  const canManage = MANAGER_ROLES.has(auth.user?.role);
  const canInvite = auth.user?.role === "admin";
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let active = true;
    api.get("/assurance/inbox")
      .then((response) => {
        if (active) setState({ loading: false, data: response.data || null });
      })
      .catch(() => {
        // This surface is additive. A plan without Outcomes, or a deployment in
        // the short migration window, must not make the dashboard fail.
        if (active) setState({ loading: false, data: null });
      });
    return () => { active = false; };
  }, [api]);

  if (state.loading) {
    return <section className="rounded-lg border border-[color:var(--border)] p-5"><Skeleton className="h-20 w-full" /></section>;
  }
  if (!state.data) return null;

  const { summary, attention = [], approvals = [], decisionsNeedingReview = [], experimentsNeedingAttention = [] } = state.data;
  const items = [
    ...approvals.map((item) => ({
      id: `approval:${item.id}`,
      title: item.goal_title,
      reason: item.payload?.evidenceLabel || `${item.requested_by_name || "Workspace user"} requested ${item.action_type === "complete" ? "completion verification" : "recovery"}.`,
      actionLabel: item.canApprove ? "Review approval" : "View request",
      to: "/outcomes/inbox",
    })),
    ...decisionsNeedingReview.map((item) => ({ id: `decision:${item.id}`, title: item.goal_title, reason: item.selected_option, actionLabel: "Review decision result", to: `/outcomes/lab?outcome=${item.goal_id}` })),
    ...experimentsNeedingAttention.map((item) => ({ id: `experiment:${item.id}`, title: item.title, reason: `${item.goal_title} needs an experiment result.`, actionLabel: "Record result", to: canManage ? `/outcomes/lab?outcome=${item.goal_id}` : `/outcomes#outcome-${item.goal_id}` })),
    ...attention.map((item) => ({ ...item, to: `/outcomes#outcome-${item.commitmentId}` })),
  ];
  if (summary?.outcomeTotal === 0) {
    if (!canManage) return null;
    return (
      <section className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Start here</p>
            <h2 className="mt-1 text-base font-semibold text-[color:var(--text)]">Your workspace is ready. No data has been assumed.</h2>
            <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-muted)]">Define the first outcome, create work, or invite the people who will own it. You can connect integrations later.</p>
          </div>
          <Link to="/outcomes?new=1" className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[var(--primary)] px-3.5 text-sm font-medium text-[color:var(--primary-contrast)]">
            <Target className="h-4 w-4" /> Define first outcome
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--border)] pt-4">
          <Link to="/projects" className="inline-flex items-center gap-2 rounded-[7px] border border-[color:var(--border)] px-3 py-2 text-[12px] font-medium text-[color:var(--text)] hover:bg-[var(--surface-soft)]"><FolderKanban className="h-3.5 w-3.5" /> Create a project</Link>
          {canInvite && <Link to="/admin/users" className="inline-flex items-center gap-2 rounded-[7px] border border-[color:var(--border)] px-3 py-2 text-[12px] font-medium text-[color:var(--text)] hover:bg-[var(--surface-soft)]"><UserPlus className="h-3.5 w-3.5" /> Invite your team</Link>}
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Outcomes</p>
          <p className="mt-1 text-[13px] font-semibold text-[color:var(--text)]">No outcome needs a decision right now.</p>
        </div>
        <Link to="/outcomes" className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--primary)]">View outcomes <ArrowRight className="h-3.5 w-3.5" /></Link>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Needs your attention</p>
          <h2 className="mt-1 text-sm font-bold text-[color:var(--text)]">{items.length} outcome item{items.length === 1 ? "" : "s"} with a clear next action</h2>
        </div>
        <Link to="/outcomes" className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--primary)]">Open outcomes <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-3">
        {items.slice(0, 3).map((item) => (
          <Link key={item.id} to={item.to} className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-3 hover:border-[color:var(--border-strong)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--score-warning)]" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-[color:var(--text)]">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--text-muted)]">{item.reason}</p>
                <p className="mt-2 text-[11px] font-semibold text-[color:var(--primary)]">{item.actionLabel}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
