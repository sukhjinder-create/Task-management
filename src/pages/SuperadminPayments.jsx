// src/pages/SuperadminPayments.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../api";
import {
  CreditCard, TrendingUp, DollarSign, Building2,
  CheckCircle, Clock, XCircle, RefreshCw,
} from "lucide-react";

function getSuperadminAxios() {
  const token = window.__SUPERADMIN_TOKEN__ ||
    (() => { try { return JSON.parse(localStorage.getItem("superadmin_auth"))?.token; } catch { return null; } })();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const PLAN_PRICING = {
  basic:      { price: "$0",   label: "Basic",      color: "bg-gray-500/10 text-gray-500" },
  pro:        { price: "$29",  label: "Pro",        color: "bg-blue-500/10 text-blue-500" },
  enterprise: { price: "$99",  label: "Enterprise", color: "bg-indigo-500/10 text-indigo-500" },
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
      const api = getSuperadminAxios();
      const res = await api.get("/superadmin/workspaces");
      setWorkspaces(res.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      bg:    "bg-green-500/10",
    },
    {
      label: "Pro Workspaces",
      value: proCount,
      sub:   "$29 / month each",
      icon:  <TrendingUp className="w-5 h-5 text-blue-500" />,
      bg:    "bg-blue-500/10",
    },
    {
      label: "Enterprise",
      value: enterpriseCount,
      sub:   "$99 / month each",
      icon:  <CreditCard className="w-5 h-5 text-indigo-500" />,
      bg:    "bg-indigo-500/10",
    },
    {
      label: "Paid Workspaces",
      value: proCount + enterpriseCount,
      sub:   "Total paying customers",
      icon:  <Building2 className="w-5 h-5 text-purple-500" />,
      bg:    "bg-purple-500/10",
    },
  ];

  const planWorkspaces = workspaces.filter(w => {
    const p = w.billing_plan || w.plan || "basic";
    return p !== "basic";
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold theme-text">Payments &amp; Billing</h1>
          <p className="text-xs theme-text-muted mt-0.5">Subscription overview across all workspaces</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium theme-surface border theme-border theme-text-muted hover:theme-text transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="theme-surface border theme-border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold theme-text">{s.value}</p>
            <p className="text-xs font-medium theme-text mt-0.5">{s.label}</p>
            <p className="text-xs theme-text-muted mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Subscription table */}
      <div className="theme-surface border theme-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b theme-border flex items-center justify-between">
          <h2 className="text-sm font-semibold theme-text">Paid Subscriptions</h2>
          <span className="text-xs theme-text-muted">{planWorkspaces.length} workspace{planWorkspaces.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin theme-text-muted" />
          </div>
        ) : planWorkspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <CreditCard className="w-10 h-10 theme-text-muted opacity-30" />
            <p className="text-sm theme-text-muted">No paid subscriptions yet</p>
            <p className="text-xs theme-text-muted opacity-70">Workspaces on Pro or Enterprise plans will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b theme-border">
                <th className="text-left text-xs font-semibold theme-text-muted px-5 py-2.5">Workspace</th>
                <th className="text-left text-xs font-semibold theme-text-muted px-5 py-2.5">Owner</th>
                <th className="text-left text-xs font-semibold theme-text-muted px-5 py-2.5">Plan</th>
                <th className="text-left text-xs font-semibold theme-text-muted px-5 py-2.5">Members</th>
                <th className="text-left text-xs font-semibold theme-text-muted px-5 py-2.5">Status</th>
                <th className="text-left text-xs font-semibold theme-text-muted px-5 py-2.5">Since</th>
              </tr>
            </thead>
            <tbody>
              {planWorkspaces.map((ws, i) => {
                const plan   = ws.billing_plan || ws.plan || "basic";
                const planCfg = PLAN_PRICING[plan] || PLAN_PRICING.basic;
                const active = ws.is_active !== false && ws.status !== "suspended" && ws.status !== "deleted";
                return (
                  <tr key={ws.id} className={`border-b theme-border last:border-0 hover:bg-[var(--surface-soft)] transition-colors ${i % 2 === 0 ? "" : ""}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium theme-text">{ws.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs theme-text-muted">{ws.owner_email || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${planCfg.color}`}>
                        {planCfg.label}
                        <span className="opacity-60">{planCfg.price}/mo</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs theme-text">
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
                      <span className="text-xs theme-text-muted">{fmt(ws.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Notice */}
      <div className="theme-surface border theme-border rounded-xl px-5 py-4">
        <p className="text-xs font-semibold theme-text mb-1">Payment Provider</p>
        <p className="text-xs theme-text-muted leading-relaxed">
          To process real payments, connect a provider such as <strong className="theme-text">Stripe</strong> or <strong className="theme-text">PayPal</strong> on the backend.
          Wire webhook events to update <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)] text-xs">billing_plan</code> and <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)] text-xs">max_members</code> in the workspaces table.
        </p>
      </div>

    </div>
  );
}
