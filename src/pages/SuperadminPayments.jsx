// src/pages/SuperadminPayments.jsx
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import superadminApi from "../superadminApi";
import {
  CreditCard, TrendingUp, DollarSign, Building2,
  CheckCircle, Clock, XCircle, RefreshCw,
} from "lucide-react";

const PLAN_PRICING = {
  basic:      { price: "$0",   label: "Basic",      color: "border border-[color:var(--border)] text-[color:var(--text-muted)]" },
  pro:        { price: "$29",  label: "Pro",        color: "border border-[color:var(--border)] text-[color:var(--text-muted)]" },
  enterprise: { price: "$99",  label: "Enterprise", color: "border border-[color:var(--border)] text-[color:var(--primary)]" },
};

const STATUS_ICON = {
  paid:    <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
  pending: <Clock       className="w-3.5 h-3.5 text-amber-500" />,
  failed:  <XCircle     className="w-3.5 h-3.5 text-red-500"   />,
};

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SuperadminPayments() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await superadminApi.get("/superadmin/workspaces");
      setWorkspaces(res.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Derive stats from workspace data
  const proCount        = workspaces.filter(w => w.plan === "pro" || w.billing_plan === "pro").length;
  const enterpriseCount = workspaces.filter(w => w.plan === "enterprise" || w.billing_plan === "enterprise").length;
  const mrrEstimate     = proCount * 29 + enterpriseCount * 99;

  const STATS = [
    {
      label: "Est. MRR",
      value: `$${mrrEstimate.toLocaleString()}`,
      sub:   "Based on current plans",
      icon:  <DollarSign className="w-5 h-5 text-green-500" />,
    },
    {
      label: "Pro Workspaces",
      value: proCount,
      sub:   "$29 / month each",
      icon:  <TrendingUp className="w-5 h-5 text-[color:var(--text-muted)]" />,
    },
    {
      label: "Enterprise",
      value: enterpriseCount,
      sub:   "$99 / month each",
      icon:  <CreditCard className="w-5 h-5 text-[color:var(--primary)]" />,
    },
    {
      label: "Paid Workspaces",
      value: proCount + enterpriseCount,
      sub:   "Total paying customers",
      icon:  <Building2 className="w-5 h-5 text-[color:var(--text-muted)]" />,
    },
  ];

  const planWorkspaces = workspaces.filter(w => {
    const p = w.billing_plan || w.plan || "basic";
    return p !== "basic";
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Superadmin</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Payments &amp; Billing</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="border border-[color:var(--border)] rounded-lg p-4">
            <div className="w-9 h-9 rounded-lg border border-[color:var(--border)] flex items-center justify-center mb-3">
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-[color:var(--text)]">{s.value}</p>
            <p className="text-xs font-medium text-[color:var(--text)] mt-0.5">{s.label}</p>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Subscription table */}
      <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[color:var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Paid Subscriptions</h2>
          <span className="text-xs text-[color:var(--text-muted)]">{planWorkspaces.length} workspace{planWorkspaces.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-[color:var(--text-muted)]" />
          </div>
        ) : planWorkspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <CreditCard className="w-10 h-10 text-[color:var(--text-muted)] opacity-30" />
            <p className="text-sm text-[color:var(--text-muted)]">No paid subscriptions yet</p>
            <p className="text-xs text-[color:var(--text-muted)] opacity-70">Workspaces on Pro or Enterprise plans will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                <th className="text-left text-xs font-semibold text-[color:var(--text-muted)] px-5 py-2.5">Workspace</th>
                <th className="text-left text-xs font-semibold text-[color:var(--text-muted)] px-5 py-2.5">Owner</th>
                <th className="text-left text-xs font-semibold text-[color:var(--text-muted)] px-5 py-2.5">Plan</th>
                <th className="text-left text-xs font-semibold text-[color:var(--text-muted)] px-5 py-2.5">Members</th>
                <th className="text-left text-xs font-semibold text-[color:var(--text-muted)] px-5 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold text-[color:var(--text-muted)] px-5 py-2.5">Since</th>
              </tr>
            </thead>
            <tbody>
              {planWorkspaces.map(ws => {
                const plan    = ws.billing_plan || ws.plan || "basic";
                const planCfg = PLAN_PRICING[plan] || PLAN_PRICING.basic;
                const active  = ws.is_active !== false && ws.status !== "suspended" && ws.status !== "deleted";
                return (
                  <tr key={ws.id} className="border-b border-[color:var(--border)] last:border-0 hover:bg-[var(--surface-soft)] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[color:var(--text)]">{ws.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs text-[color:var(--text-muted)]">{ws.owner_email || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${planCfg.color}`}>
                        {planCfg.label}
                        <span className="opacity-60">{planCfg.price}/mo</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-[color:var(--text)]">
                        {ws.user_count ?? "—"} / {ws.max_members ?? ws.member_limit ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${active ? "text-green-500" : "text-amber-500"}`}>
                        {active ? STATUS_ICON.paid : STATUS_ICON.pending}
                        {active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-[color:var(--text-muted)]">{fmt(ws.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Notice */}
      <div className="border border-[color:var(--border)] rounded-lg px-5 py-4">
        <p className="text-xs font-semibold text-[color:var(--text)] mb-1">Payment Provider</p>
        <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
          To process real payments, connect a provider such as <strong className="text-[color:var(--text)]">Stripe</strong> or <strong className="text-[color:var(--text)]">PayPal</strong> on the backend.
          Wire webhook events to update <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)] text-xs">billing_plan</code> and <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)] text-xs">max_members</code> in the workspaces table.
        </p>
      </div>

    </div>
  );
}
