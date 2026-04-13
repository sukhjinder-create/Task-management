// src/pages/WorkspaceBilling.jsx
// =============================================================================
// Workspace admin billing page — Razorpay subscriptions
// Flow: Pick plan → POST /payments/subscribe → Razorpay Checkout (UPI/Card/NACH)
//       → ₹1 mandate verification → 7-day free trial → monthly auto-debit
// =============================================================================
import { useEffect, useState, useCallback } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  CheckCircle, Zap, Crown, CreditCard, RefreshCw,
  AlertCircle, Shield, Clock, Users, ChevronRight,
  BadgeCheck, Smartphone, Building, UserCheck, UserX,
  Info, Pencil, Trash2, X,
} from "lucide-react";

// ── Load Razorpay script once ─────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rupees(paise) {
  if (!paise) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(paise / 100);
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function daysLeft(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  return d > 0 ? d : 0;
}

const SUPPORT_BADGE = {
  community: { label: "Community", color: "text-gray-500" },
  email:     { label: "Email Support", color: "text-blue-500" },
  priority:  { label: "Priority Support", color: "text-indigo-500" },
  dedicated: { label: "Dedicated Manager", color: "text-purple-500" },
};

// ── Payment method icons/labels ───────────────────────────────────────────────
const PAYMENT_METHODS = [
  { icon: <Smartphone className="w-4 h-4 text-green-500" />, label: "UPI AutoPay",       sub: "PhonePe, GPay, Paytm, BHIM" },
  { icon: <CreditCard className="w-4 h-4 text-blue-500"  />, label: "Debit / Credit Card", sub: "Visa, Mastercard, RuPay" },
  { icon: <Building   className="w-4 h-4 text-amber-500" />, label: "NACH / Net Banking", sub: "Direct bank mandate" },
];

// ── Interval toggle ───────────────────────────────────────────────────────────
function IntervalToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-xl border theme-border theme-surface p-1 gap-1">
      {["monthly", "yearly"].map(v => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            value === v
              ? "bg-indigo-500 text-white"
              : "theme-text-muted hover:theme-text"
          }`}>
          {v === "monthly" ? "Monthly" : "Yearly"}
          {v === "yearly" && <span className="ml-1.5 text-[10px] font-bold text-green-400">SAVE 17%</span>}
        </button>
      ))}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, interval, isCurrent, isLoading, onSelect, memberCount }) {
  const pricePaise = interval === "yearly" ? plan.price_yearly_paise : plan.price_monthly_paise;
  const isFree  = !pricePaise;
  const features = Array.isArray(plan.features) ? plan.features : [];
  const totalPaise = pricePaise && memberCount > 0 ? pricePaise * memberCount : null;

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all ${
      plan.is_popular
        ? "border-indigo-500/50 ring-2 ring-indigo-500/20"
        : isCurrent
        ? "border-green-500/40"
        : "theme-border"
    } theme-surface`}>

      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500 text-white uppercase tracking-wider shadow">
            Most Popular
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green-500 text-white uppercase tracking-wider shadow">
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col gap-5">
        {/* Plan identity */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider theme-text-muted">{plan.name}</p>
          <p className="text-xs theme-text-muted mt-0.5">{plan.tagline}</p>

          <div className="mt-3">
            {isFree ? (
              <p className="text-3xl font-black theme-text">Free</p>
            ) : (
              <>
                <p className="text-3xl font-black theme-text">
                  {rupees(pricePaise)}
                  <span className="text-sm font-normal theme-text-muted">/user/{interval === "yearly" ? "yr" : "mo"}</span>
                </p>
                {totalPaise && (
                  <p className="text-sm font-semibold text-indigo-500 mt-0.5">
                    Total: {rupees(totalPaise)}/{interval === "yearly" ? "yr" : "mo"}
                    <span className="text-xs font-normal theme-text-muted ml-1">for {memberCount} users</span>
                  </p>
                )}
                {interval === "yearly" && plan.price_monthly_paise > 0 && (
                  <p className="text-xs text-green-500 font-semibold mt-0.5">
                    Save {rupees((plan.price_monthly_paise * 12 - plan.price_yearly_paise) * (memberCount || 1))}/year
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs theme-text-muted">
              <Users className="w-3 h-3" /> {plan.member_limit > 0 ? `${plan.member_limit} members` : "Unlimited members"}
            </span>
            {plan.trial_days > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-500 font-medium">
                <Zap className="w-3 h-3" /> {plan.trial_days}-day free trial
              </span>
            )}
            {SUPPORT_BADGE[plan.support_level] && (
              <span className={`text-xs font-medium ${SUPPORT_BADGE[plan.support_level].color}`}>
                {SUPPORT_BADGE[plan.support_level].label}
              </span>
            )}
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 flex-1">
          {features.map(f => (
            <li key={f} className="flex items-start gap-2 text-xs theme-text-muted">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isCurrent ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-green-500/10 text-green-600 flex items-center justify-center gap-1.5">
            <BadgeCheck className="w-4 h-4" /> Active Plan
          </div>
        ) : isFree ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center theme-text-muted opacity-50 border theme-border">
            Downgrade via cancellation
          </div>
        ) : (
          <button onClick={() => onSelect(plan)} disabled={isLoading}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
              plan.is_popular
                ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                : "bg-[var(--surface-soft)] hover:bg-indigo-500/10 theme-text hover:text-indigo-500 border theme-border"
            }`}>
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {plan.trial_days > 0 ? `Start ${plan.trial_days}-day Free Trial` : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Pending Users Section ─────────────────────────────────────────────────────
function PendingUsersSection({ api, user, razorpayEnabled }) {
  const [pendingData, setPendingData]   = useState(null);
  const [selected,    setSelected]      = useState([]);   // selected user IDs
  const [cost,        setCost]          = useState(null);
  const [costLoading, setCostLoading]   = useState(false);
  const [activating,  setActivating]    = useState(false);
  const [loading,     setLoading]       = useState(true);
  const [editingUser, setEditingUser]   = useState(null);
  const [editForm,    setEditForm]      = useState({ username: "", email: "", role: "user", projects: [] });
  const [saving,      setSaving]        = useState(false);
  const [deletingId,  setDeletingId]    = useState(null);
  const [projects,    setProjects]      = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/payments/pending-users");
      setPendingData(res.data);
    } catch {
      /* non-fatal — pending users section is optional */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get("/projects").then(r => setProjects(r.data || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalculate cost whenever selection changes
  useEffect(() => {
    if (selected.length === 0) { setCost(null); return; }
    let cancelled = false;
    setCostLoading(true);
    api.post("/payments/activation-cost", { userIds: selected })
      .then(r => { if (!cancelled) setCost(r.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCostLoading(false); });
    return () => { cancelled = true; };
  }, [selected, api]);

  function toggleUser(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    const ids = (pendingData?.users || []).map(u => u.id);
    setSelected(prev => prev.length === ids.length ? [] : ids);
  }

  function openEdit(u) {
    setEditingUser(u);
    setEditForm({ username: u.username, email: u.email, role: u.role, projects: Array.isArray(u.projects) ? u.projects : [] });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!editForm.username.trim() || !editForm.email.trim()) return toast.error("Username and email are required");
    if (editForm.role === "manager" && editForm.projects.length === 0) {
      return toast.error("Assign at least one project to a manager");
    }
    setSaving(true);
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setPendingData(prev => ({
        ...prev,
        users: (prev?.users || []).map(u => u.id === editingUser.id ? { ...u, ...editForm } : u),
      }));
      toast.success("User updated");
      setEditingUser(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Update failed");
    }
    setSaving(false);
  }

  async function handleDelete(u) {
    if (!window.confirm(`Delete "${u.username}"? This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      await api.delete(`/users/${u.id}`);
      setPendingData(prev => ({ ...prev, users: (prev?.users || []).filter(x => x.id !== u.id) }));
      setSelected(prev => prev.filter(id => id !== u.id));
      toast.success(`${u.username} deleted`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
    setDeletingId(null);
  }

  async function handleActivate() {
    if (selected.length === 0 || !cost) return;
    setActivating(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Failed to load Razorpay. Check your internet connection.");

      const { data: order } = await api.post("/payments/create-activation-order", { userIds: selected });

      await new Promise((resolve, reject) => {
        const options = {
          key:      order.keyId,
          order_id: order.orderId,
          amount:   order.amountPaise,
          currency: "INR",
          name:     "Asystence",
          description: `Activate ${selected.length} user${selected.length > 1 ? "s" : ""} — ${cost.proRatedDays} days`,
          prefill:  { name: user?.username || "", email: user?.email || "" },
          notes:    { type: "user_activation" },
          theme:    { color: "#6366f1" },
          modal: {
            ondismiss: () => {
              toast("Activation cancelled.", { icon: "ℹ️" });
              reject(new Error("dismissed"));
            },
          },
          handler: async (response) => {
            try {
              await api.post("/payments/verify-activation", {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                userIds: selected,
              });
              toast.success(`🎉 ${selected.length} user${selected.length > 1 ? "s" : ""} activated successfully!`);
              setSelected([]);
              setCost(null);
              await load();
              resolve();
            } catch (err) { reject(err); }
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (resp) => {
          toast.error(`Payment failed: ${resp.error?.description || "Unknown error"}`);
          reject(new Error(resp.error?.description));
        });
        rzp.open();
      });
    } catch (err) {
      if (err?.message !== "dismissed") {
        toast.error(err?.response?.data?.error || err.message || "Activation failed");
      }
    } finally {
      setActivating(false);
    }
  }

  if (loading) return null;

  const users     = pendingData?.users || [];
  const pricePaise = pendingData?.perUserPricePaise;

  if (users.length === 0 && !pricePaise) return null; // nothing to show

  const allSelected = selected.length === users.length && users.length > 0;

  return (
    <div className="theme-surface border theme-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b theme-border flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <UserX className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold theme-text">
              Unlicensed Users
              {users.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-600 font-semibold">
                  {users.length}
                </span>
              )}
            </p>
            <p className="text-xs theme-text-muted mt-0.5">
              These users exist in your workspace but cannot access any features until activated.
            </p>
          </div>
        </div>
        {pricePaise && (
          <span className="text-xs theme-text-muted flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            {rupees(pricePaise)}/user/month
          </span>
        )}
      </div>

      {users.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <UserCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold theme-text">All users are licensed</p>
          <p className="text-xs theme-text-muted mt-1">
            New users added will appear here until you activate them.
          </p>
        </div>
      ) : (
        <>
          {/* Select all + cost bar */}
          <div className="px-6 py-3 border-b theme-border flex items-center justify-between gap-4 bg-[var(--surface-soft)]">
            <label className="flex items-center gap-2 cursor-pointer text-xs theme-text font-medium select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded"
              />
              {allSelected ? "Deselect all" : `Select all (${users.length})`}
            </label>

            {selected.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs theme-text-muted">
                  {costLoading ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Calculating...
                    </span>
                  ) : cost ? (
                    <span>
                      <span className="font-bold theme-text">{rupees(cost.totalPaise)}</span>
                      {" "}for {selected.length} user{selected.length > 1 ? "s" : ""}
                      {" · "}{cost.proRatedDays} days remaining in cycle
                    </span>
                  ) : null}
                </div>
                {razorpayEnabled ? (
                  <button
                    onClick={handleActivate}
                    disabled={activating || costLoading || !cost}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  >
                    {activating
                      ? <><RefreshCw className="w-3 h-3 animate-spin" /> Activating...</>
                      : <><UserCheck className="w-3 h-3" /> Pay &amp; Activate</>
                    }
                  </button>
                ) : (
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Configure Razorpay to activate
                  </span>
                )}
              </div>
            )}
          </div>

          {/* User list */}
          <ul className="divide-y divide-[var(--border)]">
            {users.map(u => (
              <li
                key={u.id}
                className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors ${
                  selected.includes(u.id) ? "bg-indigo-500/5" : ""
                }`}
                onClick={() => toggleUser(u.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                  onClick={e => e.stopPropagation()}
                  className="rounded shrink-0"
                />
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-500">
                    {(u.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium theme-text truncate">{u.username}</p>
                  <p className="text-xs theme-text-muted truncate">{u.email}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    u.role === "admin"   ? "bg-purple-500/10 text-purple-600" :
                    u.role === "manager" ? "bg-blue-500/10 text-blue-600"    :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {u.role}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(u); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-indigo-500"
                    title="Edit user"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(u); }}
                    disabled={deletingId === u.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40"
                    title="Delete user"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Bottom info */}
          <div className="px-6 py-3 border-t theme-border flex items-start gap-2 text-xs theme-text-muted">
            <Shield className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
            <span>
              You are charged pro-rated for the remaining days in your current billing cycle.
              At the next renewal, the full monthly rate applies.
            </span>
          </div>
        </>
      )}

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="theme-surface rounded-2xl border theme-border w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b theme-border">
              <h3 className="font-semibold theme-text text-sm">Edit unlicensed user</h3>
              <button onClick={() => setEditingUser(null)} className="theme-text-muted hover:theme-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Username</label>
                <input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full border theme-border rounded-lg px-3 py-2 text-sm theme-surface theme-text" />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border theme-border rounded-lg px-3 py-2 text-sm theme-surface theme-text" />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value, projects: [] }))}
                  className="w-full border theme-border rounded-lg px-3 py-2 text-sm theme-surface theme-text">
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editForm.role === "manager" && (
                <div>
                  <label className="block text-xs theme-text-muted mb-1">Projects <span className="text-red-400">*</span></label>
                  {projects.length === 0 ? (
                    <p className="text-xs theme-text-muted italic">No projects available</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto border theme-border rounded-lg divide-y divide-[var(--border)]">
                      {projects.map(p => (
                        <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--surface-soft)]">
                          <input
                            type="checkbox"
                            checked={editForm.projects.includes(p.id)}
                            onChange={e => setEditForm(f => ({
                              ...f,
                              projects: e.target.checked
                                ? [...f.projects, p.id]
                                : f.projects.filter(id => id !== p.id),
                            }))}
                            className="rounded"
                          />
                          <span className="text-sm theme-text truncate">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 rounded-xl border theme-border text-sm theme-text">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkspaceBilling() {
  const api        = useApi();
  const { auth }   = useAuth();
  const user       = auth?.user;

  const [plans,    setPlans]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [interval, setInterval] = useState("monthly");
  const [checking, setChecking] = useState(null); // planId being checked out
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, summaryRes] = await Promise.all([
        api.get("/payments/plans"),
        api.get("/payments/summary").catch(() => ({ data: null })),
      ]);
      setPlans(plansRes.data || []);
      setSummary(summaryRes.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // ── Razorpay checkout ──────────────────────────────────────────────────────
  async function handleSelectPlan(plan) {
    setChecking(plan.id);
    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Failed to load Razorpay. Check your internet connection.");

      // 2. Create subscription on backend → get subscription_id + key_id
      const { data } = await api.post("/payments/subscribe", {
        planId: plan.id,
        interval,
      });

      // 3. Open Razorpay Checkout
      await new Promise((resolve, reject) => {
        const options = {
          key:             data.keyId,
          subscription_id: data.subscriptionId,
          name:            "Asystence",
          description:     `${data.planName} — ${interval === "yearly" ? "Yearly" : "Monthly"}`,
          image:           "/logo.png",
          currency:        "INR",
          prefill: {
            name:  data.prefill?.name  || user?.username || "",
            email: data.prefill?.email || user?.email    || "",
          },
          notes: { plan: data.planSlug, interval },
          theme: { color: "#6366f1" },
          modal: {
            ondismiss: () => {
              toast("Checkout cancelled. You can try again anytime.", { icon: "ℹ️" });
              reject(new Error("dismissed"));
            },
          },
          handler: async (response) => {
            try {
              // 4. Verify signature on backend
              await api.post("/payments/verify", {
                razorpay_payment_id:      response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature:       response.razorpay_signature,
                planSlug:                 data.planSlug,
              });

              toast.success(
                data.trialDays > 0
                  ? `🎉 ${data.trialDays}-day free trial started! Your ₹1 verification will be refunded within 3–5 days.`
                  : `🎉 Subscribed to ${data.planName}! Welcome to Asystence.`,
                { duration: 6000 }
              );
              await load();
              resolve();
            } catch (verifyErr) {
              reject(verifyErr);
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (resp) => {
          toast.error(`Payment failed: ${resp.error?.description || "Unknown error"}`);
          reject(new Error(resp.error?.description));
        });
        rzp.open();
      });

    } catch (err) {
      if (err?.message !== "dismissed") {
        toast.error(err?.response?.data?.error || err.message || "Checkout failed");
      }
    } finally {
      setChecking(null);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel subscription? You'll keep access until the end of the billing period.")) return;
    setCancelling(true);
    try {
      const { data } = await api.post("/payments/cancel");
      toast.success(`Subscription cancelled. Access continues until ${fmtDate(data.effectiveDate)}.`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentPlan  = summary?.workspace?.billing_plan || summary?.workspace?.plan || "starter";
  const billingStatus = summary?.workspace?.billing_status;
  const sub          = summary?.subscription;
  const trialLeft    = sub?.trial_ends_at ? daysLeft(sub.trial_ends_at) : null;
  const nextBilling  = sub?.next_billing_at || sub?.current_period_end;
  const razorpayEnabled = summary?.config?.enabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-spin theme-text-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold theme-text">Billing &amp; Subscription</h1>
          <p className="text-sm theme-text-muted mt-1">Manage your workspace plan. Cancel anytime.</p>
        </div>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      {/* Current plan status banner */}
      {summary && (
        <div className={`rounded-2xl border p-5 flex items-start gap-4 ${
          billingStatus === "active" ? "border-green-500/30 bg-green-500/5"
          : billingStatus === "suspended" ? "border-amber-500/30 bg-amber-500/5"
          : "theme-border theme-surface"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            billingStatus === "active" ? "bg-green-500/10" : "bg-indigo-500/10"
          }`}>
            <Crown className={`w-5 h-5 ${billingStatus === "active" ? "text-green-500" : "text-indigo-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold theme-text capitalize">{currentPlan} Plan</p>
              {billingStatus === "active" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600">Active</span>
              )}
              {billingStatus === "suspended" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600">Suspended</span>
              )}
              {sub?.cancel_at_period_end && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500">Cancels at period end</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs theme-text-muted">
              {trialLeft !== null && trialLeft > 0 && (
                <span className="flex items-center gap-1 text-indigo-500 font-medium">
                  <Clock className="w-3.5 h-3.5" /> {trialLeft} days of free trial remaining
                </span>
              )}
              {trialLeft === 0 && nextBilling && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Next billing: {fmtDate(nextBilling)}
                </span>
              )}
              {sub?.billing_interval && (
                <span className="capitalize">{sub.billing_interval} billing</span>
              )}
              {summary.workspace?.max_members && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Up to {summary.workspace.max_members} members
                </span>
              )}
            </div>
          </div>

          {sub && !sub.cancel_at_period_end && currentPlan !== "starter" && (
            <button onClick={handleCancel} disabled={cancelling}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Cancel plan
            </button>
          )}
        </div>
      )}

      {/* No Razorpay notice */}
      {!razorpayEnabled && (
        <div className="theme-surface border theme-border rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold theme-text">Payments not yet configured</p>
            <p className="text-xs theme-text-muted mt-0.5">
              Contact your platform administrator to set up Razorpay. Once configured, you can upgrade directly from this page.
            </p>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            isCurrent={plan.slug === currentPlan}
            isLoading={checking === plan.id}
            onSelect={handleSelectPlan}
            memberCount={summary?.activeMemberCount || 0}
          />
        ))}
      </div>

      {/* Pending / unlicensed users — only shown to admins */}
      {["admin", "owner"].includes(user?.role) && (
        <PendingUsersSection api={api} user={user} razorpayEnabled={razorpayEnabled} />
      )}

      {/* How it works */}
      <div className="theme-surface border theme-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b theme-border">
          <p className="text-sm font-bold theme-text">How billing works</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[
            {
              icon: <Shield className="w-4 h-4 text-indigo-500" />,
              title: "₹1 mandate verification",
              desc: "When you subscribe, ₹1 is charged to verify your payment method. This amount is automatically refunded within 3–5 business days.",
            },
            {
              icon: <Zap className="w-4 h-4 text-green-500" />,
              title: "Free trial period",
              desc: "Paid plans include a free trial. Your first real charge happens only after the trial ends — no surprises.",
            },
            {
              icon: <RefreshCw className="w-4 h-4 text-blue-500" />,
              title: "Automatic monthly renewal",
              desc: "After your trial, billing happens automatically each month (or year). You'll receive an email reminder 3 days before each charge.",
            },
            {
              icon: <BadgeCheck className="w-4 h-4 text-purple-500" />,
              title: "Cancel anytime",
              desc: "Cancel at any time from this page. You keep full access until the end of your current billing period.",
            },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-4 px-6 py-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold theme-text">{item.title}</p>
                <p className="text-xs theme-text-muted mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accepted payment methods */}
      <div className="theme-surface border theme-border rounded-2xl px-6 py-5">
        <p className="text-sm font-bold theme-text mb-4">Accepted payment methods</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PAYMENT_METHODS.map(m => (
            <div key={m.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border theme-border">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                {m.icon}
              </div>
              <div>
                <p className="text-sm font-semibold theme-text">{m.label}</p>
                <p className="text-xs theme-text-muted">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs theme-text-muted mt-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          Payments are processed securely by Razorpay. Asystence never stores your card or bank details.
        </p>
      </div>

      {/* Need help */}
      <div className="flex items-center justify-between px-5 py-4 theme-surface border theme-border rounded-xl">
        <div>
          <p className="text-sm font-semibold theme-text">Need a custom plan?</p>
          <p className="text-xs theme-text-muted mt-0.5">Contact us for enterprise pricing, volume discounts, or custom contracts.</p>
        </div>
        <a href="mailto:billing@proxima.app"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold theme-surface border theme-border theme-text hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-colors">
          Contact sales <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>

    </div>
  );
}
