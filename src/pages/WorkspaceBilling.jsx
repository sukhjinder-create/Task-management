// src/pages/WorkspaceBilling.jsx
// =============================================================================
// Workspace admin billing page — Stripe / Razorpay subscriptions
// Flow after the workspace-level no-card trial: pick plan → provider checkout
// → verified subscription → recurring billing.
//
// Prices are quoted in the workspace's billing currency. Plans arrive from the
// API already converted, in minor units, so nothing here divides by 100.
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
import CurrencySelector from "../components/CurrencySelector";
import { formatMinor, getStoredCurrency, planCurrency, planPriceMinor } from "../utils/currency";

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
/** Amount is in minor units of `currency` (cents, paise, whole yen). */
function money(minorAmount, currency = "USD") {
  return formatMinor(minorAmount, currency);
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

function daysLeft(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  return d > 0 ? d : 0;
}

const SUPPORT_BADGE = {
  community: { label: "Community",         color: "text-[color:var(--text-muted)]" },
  email:     { label: "Email Support",     color: "text-[color:var(--text-soft)]" },
  priority:  { label: "Priority Support",  color: "text-[color:var(--primary)]" },
  dedicated: { label: "Dedicated Manager", color: "text-[color:var(--primary)]" },
};

// ── Payment method icons/labels ───────────────────────────────────────────────
const PAYMENT_METHODS = [
  { icon: <Smartphone className="w-4 h-4 text-[color:var(--primary)]" />, label: "UPI AutoPay",        sub: "PhonePe, GPay, Paytm, BHIM" },
  { icon: <CreditCard className="w-4 h-4 text-[color:var(--text-soft)]"  />, label: "Debit / Credit Card", sub: "Visa, Mastercard, RuPay" },
  { icon: <Building   className="w-4 h-4 text-[color:var(--primary)]" />, label: "NACH / Net Banking",  sub: "Direct bank mandate" },
];

// ── Interval toggle ───────────────────────────────────────────────────────────
function IntervalToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-1 gap-1">
      {["monthly", "yearly"].map(v => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            value === v
              ? "bg-[var(--primary)] text-white"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          }`}>
          {v === "monthly" ? "Monthly" : "Yearly"}
          {v === "yearly" && <span className="ml-1.5 text-[10px] font-bold text-[color:var(--primary)]">SAVE 17%</span>}
        </button>
      ))}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, interval, isCurrent, isLoading, onSelect, memberCount, trialActive, trialConsumed }) {
  const currency = planCurrency(plan);
  const priceMinor = planPriceMinor(plan, interval);
  const isFree  = !priceMinor;
  const features = Array.isArray(plan.features) ? plan.features : [];
  const totalMinor = priceMinor && memberCount > 0 ? priceMinor * memberCount : null;
  const monthlyMinor = planPriceMinor(plan, "monthly");
  const yearlyMinor = planPriceMinor(plan, "yearly");

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all ${
      plan.is_popular
        ? "border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]/20"
        : isCurrent
        ? "border-[color:var(--primary)]/40"
        : "border-[color:var(--border)]"
    }`}>

      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white uppercase tracking-wider">
            Most Popular
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white uppercase tracking-wider">
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col gap-5">
        {/* Plan identity */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)]">{plan.name}</p>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{plan.tagline}</p>

          <div className="mt-3">
            {isFree ? (
              <p className="text-3xl font-black text-[color:var(--text)]">Free</p>
            ) : (
              <>
                <p className="text-3xl font-black text-[color:var(--text)]">
                  {money(priceMinor, currency)}
                  <span className="text-sm font-normal text-[color:var(--text-muted)]">/user/{interval === "yearly" ? "yr" : "mo"}</span>
                </p>
                {totalMinor && (
                  <p className="text-sm font-semibold text-[color:var(--primary)] mt-0.5">
                    Total: {money(totalMinor, currency)}/{interval === "yearly" ? "yr" : "mo"}
                    <span className="text-xs font-normal text-[color:var(--text-muted)] ml-1">for {memberCount} users</span>
                  </p>
                )}
                {interval === "yearly" && monthlyMinor > 0 && monthlyMinor * 12 > yearlyMinor && (
                  <p className="text-xs text-[color:var(--primary)] font-semibold mt-0.5">
                    Save {money((monthlyMinor * 12 - yearlyMinor) * (memberCount || 1), currency)}/year
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
              <Users className="w-3 h-3" /> {plan.member_limit > 0 ? `${plan.member_limit} members` : "Unlimited members"}
            </span>
            {plan.trial_days > 0 && !trialActive && !trialConsumed && (
              <span className="inline-flex items-center gap-1 text-xs text-[color:var(--primary)] font-medium">
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
            <li key={f} className="flex items-start gap-2 text-xs text-[color:var(--text-muted)]">
              <CheckCircle className="w-3.5 h-3.5 text-[color:var(--score-good)] mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {trialActive ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center border border-[color:var(--border)] text-[color:var(--text-muted)]">
            Available when trial ends
          </div>
        ) : isCurrent ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center border border-[color:var(--primary)]/30 text-[color:var(--primary)] flex items-center justify-center gap-1.5">
            <BadgeCheck className="w-4 h-4" /> Active Plan
          </div>
        ) : isFree ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center text-[color:var(--text-muted)] opacity-50 border border-[color:var(--border)]">
            Downgrade via cancellation
          </div>
        ) : (
          <button onClick={() => onSelect(plan)} disabled={isLoading}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
              plan.is_popular
                ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white"
                : "bg-[var(--surface-soft)] hover:bg-[var(--primary-soft)] text-[color:var(--text)] hover:text-[color:var(--primary)] border border-[color:var(--border)]"
            }`}>
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {plan.trial_days > 0 && !trialConsumed ? `Start ${plan.trial_days}-day Free Trial` : `Set up ${plan.name} billing`}
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
          amount:   order.amountMinor ?? order.amountPaise,
          currency: String(order.currency || cost?.currency || "INR").toUpperCase(),
          name:     "Asystence",
          description: `Activate ${selected.length} user${selected.length > 1 ? "s" : ""} — ${cost.proRatedDays} days`,
          image:    "/asystence-logo.png",
          prefill:  { name: user?.username || "", email: user?.email || "" },
          notes:    { type: "user_activation" },
          theme:    { color: "#f97316" },
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
              toast.success(`${selected.length} user${selected.length > 1 ? "s" : ""} activated successfully!`);
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

  const users        = pendingData?.users || [];
  const priceMinor   = pendingData?.perUserPriceMinor;
  const billCurrency = pendingData?.currency || "USD";

  if (users.length === 0 && !priceMinor) return null; // nothing to show

  const allSelected = selected.length === users.length && users.length > 0;

  return (
    <div className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[color:var(--border)] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <UserX className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-[color:var(--text)]">
              Unlicensed Users
              {users.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-600 font-semibold">
                  {users.length}
                </span>
              )}
            </p>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
              These users exist in your workspace but cannot access any features until activated.
            </p>
          </div>
        </div>
        {priceMinor && (
          <span className="text-xs text-[color:var(--text-muted)] flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            {money(priceMinor, billCurrency)}/user/month
          </span>
        )}
      </div>

      {users.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <UserCheck className="w-8 h-8 text-[color:var(--primary)] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[color:var(--text)]">All users are licensed</p>
          <p className="text-xs text-[color:var(--text-muted)] mt-1">
            New users added will appear here until you activate them.
          </p>
        </div>
      ) : (
        <>
          {/* Select all + cost bar */}
          <div className="px-6 py-3 border-b border-[color:var(--border)] flex items-center justify-between gap-4 bg-[var(--surface-soft)]">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[color:var(--text)] font-medium select-none">
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
                <div className="text-xs text-[color:var(--text-muted)]">
                  {costLoading ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Calculating...
                    </span>
                  ) : cost ? (
                    <span>
                      <span className="font-bold text-[color:var(--text)]">
                        {cost.totalAmountDisplay || money(cost.totalAmount, cost.currency || billCurrency)}
                      </span>
                      {" "}for {selected.length} user{selected.length > 1 ? "s" : ""}
                      {" · "}{cost.proRatedDays} days remaining in cycle
                    </span>
                  ) : null}
                </div>
                {razorpayEnabled ? (
                  <button
                    onClick={handleActivate}
                    disabled={activating || costLoading || !cost}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold disabled:opacity-50 transition-colors"
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
          <ul className="divide-y divide-[color:var(--border)]">
            {users.map(u => (
              <li
                key={u.id}
                className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors ${
                  selected.includes(u.id) ? "bg-[var(--primary-soft)]" : ""
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
                  <div className="w-7 h-7 rounded-full bg-[var(--primary-soft)] flex items-center justify-center shrink-0 text-xs font-bold text-[color:var(--primary)]">
                    {(u.username || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[color:var(--text)] truncate">{u.username}</p>
                  <p className="text-xs text-[color:var(--text-muted)] truncate">{u.email}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    u.role === "admin"   ? "border border-[color:var(--primary)]/40 text-[color:var(--primary)]" :
                    u.role === "manager" ? "border border-[color:var(--border)] text-[color:var(--text-soft)]"   :
                    "bg-[var(--surface-soft)] text-[color:var(--text-muted)]"
                  }`}>
                    {u.role}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(u); }}
                    className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-[color:var(--primary)]"
                    title="Edit user"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(u); }}
                    disabled={deletingId === u.id}
                    className="p-1.5 rounded-lg hover:bg-[var(--score-danger)]/10 text-[color:var(--score-danger)] disabled:opacity-40"
                    title="Delete user"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Bottom info */}
          <div className="px-6 py-3 border-t border-[color:var(--border)] flex items-start gap-2 text-xs text-[color:var(--text-muted)]">
            <Shield className="w-3.5 h-3.5 text-[color:var(--primary)] mt-0.5 shrink-0" />
            <span>
              You are charged pro-rated for the remaining days in your current billing cycle.
              At the next renewal, the full monthly rate applies.
            </span>
          </div>
        </>
      )}

      {/* Edit user modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] rounded-2xl border border-[color:var(--border)] w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
              <h3 className="font-semibold text-[color:var(--text)] text-sm">Edit unlicensed user</h3>
              <button onClick={() => setEditingUser(null)} className="text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Username</label>
                <input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Role</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value, projects: [] }))}
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]">
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {editForm.role === "manager" && (
                <div>
                  <label className="block text-xs text-[color:var(--text-muted)] mb-1">Projects <span className="text-red-400">*</span></label>
                  {projects.length === 0 ? (
                    <p className="text-xs text-[color:var(--text-muted)] italic">No projects available</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
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
                          <span className="text-sm text-[color:var(--text)] truncate">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 rounded-xl border border-[color:var(--border)] text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
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
  const [currency, setCurrency] = useState(() => getStoredCurrency());
  const [currencyOptions, setCurrencyOptions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, summaryRes, currencyRes] = await Promise.all([
        api.get("/payments/plans", { params: currency ? { currency } : undefined }),
        api.get("/payments/summary").catch(() => ({ data: null })),
        api.get("/payments/currencies").catch(() => ({ data: null })),
      ]);
      setPlans(plansRes.data || []);
      setSummary(summaryRes.data || null);

      if (currencyRes.data) {
        setCurrencyOptions(currencyRes.data.currencies || []);
        // Adopt the geo-detected currency only when the user hasn't picked one.
        if (!currency && currencyRes.data.detected) setCurrency(currencyRes.data.detected);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [api, currency]);

  useEffect(() => { load(); }, [load]);

  const intendedTrialInterval = summary?.trial?.intent?.billingInterval;
  useEffect(() => {
    if (intendedTrialInterval === "monthly" || intendedTrialInterval === "yearly") {
      setInterval(intendedTrialInterval);
    }
  }, [intendedTrialInterval]);

  // A workspace that is already subscribed is billed in a fixed currency, so
  // switching the display currency would misrepresent what it pays.
  const lockedCurrency = summary?.workspace?.billing_currency
    ? String(summary.workspace.billing_currency).toUpperCase()
    : null;
  const displayCurrency = lockedCurrency || currency || "USD";

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
        currency: displayCurrency,
      });

      // The provider may not settle the requested currency (Razorpay without
      // International Payments); say so before the payment sheet opens.
      if (data.currencyConverted && data.requestedCurrency) {
        toast(
          `${String(data.requestedCurrency).toUpperCase()} isn't supported by our payment ` +
          `provider — you'll be charged in ${data.currencyDisplay}.`,
          { icon: "ℹ️", duration: 7000 }
        );
      }

      // 3. Open Razorpay Checkout
      await new Promise((resolve, reject) => {
        const options = {
          key:             data.keyId,
          subscription_id: data.subscriptionId,
          name:            "Asystence",
          description:     `${data.planName} — ${interval === "yearly" ? "Yearly" : "Monthly"}`,
          image:           "/asystence-logo.png",
          prefill: {
            name:  data.prefill?.name  || user?.username || "",
            email: data.prefill?.email || user?.email    || "",
          },
          notes: { plan: data.planSlug, interval },
          theme: { color: "#f97316" },
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

              const verification = data.verificationAmount
                ? money(data.verificationAmount, data.currency || displayCurrency)
                : "card verification";
              toast.success(
                data.trialDays > 0
                  ? `${data.trialDays}-day free trial started! Your ${verification} charge will be refunded within 3–5 days.`
                  : `Subscribed to ${data.planName}! Welcome to Asystence.`,
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
  const workspaceTrial = summary?.trial || null;
  const workspaceTrialActive = !!workspaceTrial?.onTrial;
  const workspaceTrialConsumed = !!workspaceTrial?.trialCompleted;
  const currentPlan  = workspaceTrialActive
    ? workspaceTrial?.intent?.selectedPlanSlug || "trial"
    : summary?.workspace?.billing_plan || summary?.workspace?.plan || "starter";
  const billingStatus = summary?.workspace?.billing_status;
  const sub          = summary?.subscription;
  const trialLeft    = workspaceTrialActive
    ? daysLeft(workspaceTrial.trialEndsAt)
    : sub?.trial_ends_at
      ? daysLeft(sub.trial_ends_at)
      : null;
  const nextBilling  = sub?.next_billing_at || sub?.current_period_end;
  const razorpayEnabled = summary?.config?.enabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-spin text-[color:var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Workspace</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Billing &amp; Subscription</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">Manage your workspace plan. Cancel anytime.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lockedCurrency ? (
            <span className="text-xs text-[color:var(--text-muted)]">
              Billed in <span className="font-semibold text-[color:var(--text)]">{lockedCurrency}</span>
            </span>
          ) : (
            <CurrencySelector
              value={displayCurrency}
              onChange={setCurrency}
              currencies={currencyOptions}
            />
          )}
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      </div>

      {/* Current plan status banner */}
      {summary && (
        <div className={`rounded-2xl border p-5 flex items-start gap-4 ${
          billingStatus === "active"    ? "border-[color:var(--primary)]/30"
          : billingStatus === "suspended" ? "border-[color:var(--border)]"
          : "border-[color:var(--border)]"
        }`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--surface-soft)]">
            <Crown className="w-5 h-5 text-[color:var(--primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[color:var(--text)] capitalize">
                {workspaceTrialActive
                  ? `${workspaceTrial?.intent?.selectedPlanName || currentPlan} Trial`
                  : `${currentPlan} Plan`}
              </p>
              {workspaceTrialActive && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-[color:var(--primary)]/30 text-[color:var(--primary)]">No card on file</span>
              )}
              {billingStatus === "active" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-[color:var(--primary)]/30 text-[color:var(--primary)]">Active</span>
              )}
              {billingStatus === "suspended" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-[color:var(--border)] text-[color:var(--text-muted)]">Suspended</span>
              )}
              {sub?.cancel_at_period_end && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border border-[color:var(--border)] text-[color:var(--text-muted)]">Cancels at period end</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-[color:var(--text-muted)]">
              {workspaceTrialActive && trialLeft !== null && trialLeft > 0 && (
                <span className="flex items-center gap-1 text-[color:var(--primary)] font-medium">
                  <Clock className="w-3.5 h-3.5" /> {trialLeft} days of full access remaining
                </span>
              )}
              {!workspaceTrialActive && trialLeft === 0 && nextBilling && (
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
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-[color:var(--score-danger)] hover:bg-[var(--score-danger)]/10 border border-[color:var(--score-danger)]/20 transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Cancel plan
            </button>
          )}
        </div>
      )}

      {/* No Razorpay notice */}
      {!razorpayEnabled && (
        <div className="border border-[color:var(--border)] rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Payments not yet configured</p>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
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
            isCurrent={!workspaceTrialActive && plan.slug === currentPlan}
            isLoading={checking === plan.id}
            onSelect={handleSelectPlan}
            memberCount={summary?.activeMemberCount || 0}
            trialActive={workspaceTrialActive}
            trialConsumed={workspaceTrialConsumed}
          />
        ))}
      </div>

      {/* Pending / unlicensed users — only shown to admins */}
      {["admin", "owner"].includes(user?.role) && (
        <PendingUsersSection api={api} user={user} razorpayEnabled={razorpayEnabled} />
      )}

      {/* How it works */}
      <div className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[color:var(--border)] bg-[var(--surface-soft)]">
          <p className="text-sm font-bold text-[color:var(--text)]">How billing works</p>
        </div>
        <div className="divide-y divide-[color:var(--border)]">
          {[
            {
              icon: <Shield className="w-4 h-4 text-[color:var(--primary)]" />,
              title: "No card during onboarding",
              desc: "Your workspace trial starts at signup without a card, mandate, verification charge, or payment redirect.",
            },
            {
              icon: <Zap className="w-4 h-4 text-[color:var(--primary)]" />,
              title: "Seven days of full access",
              desc: "Use the product with your team first. Billing setup becomes available only after the workspace trial ends.",
            },
            {
              icon: <RefreshCw className="w-4 h-4 text-[color:var(--text-soft)]" />,
              title: "Safe Starter fallback",
              desc: "If you do not choose a paid plan after the trial, the workspace moves automatically to the free Starter plan without losing its data.",
            },
            {
              icon: <BadgeCheck className="w-4 h-4 text-[color:var(--primary)]" />,
              title: "Billing stays in your control",
              desc: `When you choose a paid plan, payment is handled securely in ${displayCurrency}. You can cancel future renewals from this page.`,
            },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-4 px-6 py-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-[color:var(--text)]">{item.title}</p>
                <p className="text-xs text-[color:var(--text-muted)] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accepted payment methods */}
      <div className="border border-[color:var(--border)] rounded-2xl px-6 py-5">
        <p className="text-sm font-bold text-[color:var(--text)] mb-4">Accepted payment methods</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PAYMENT_METHODS.map(m => (
            <div key={m.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[color:var(--border)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                {m.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-[color:var(--text)]">{m.label}</p>
                <p className="text-xs text-[color:var(--text-muted)]">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[color:var(--text-muted)] mt-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[color:var(--primary)]" />
          Payments are processed securely by Razorpay. Asystence never stores your card or bank details.
        </p>
      </div>

      {/* Need help */}
      <div className="flex items-center justify-between px-5 py-4 border border-[color:var(--border)] rounded-xl">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">Need a custom plan?</p>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">Contact us for enterprise pricing, volume discounts, or custom contracts.</p>
        </div>
        <a href="mailto:billing@proxima.app"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[var(--primary)] hover:text-white hover:border-[color:var(--primary)] transition-colors">
          Contact sales <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>

    </div>
  );
}
