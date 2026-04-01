// src/pages/SuperadminPlans.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../api";
import {
  Plus, Pencil, Trash2, RefreshCw, CheckCircle,
  Zap, Crown, Users, Star, X, ChevronDown, ChevronUp,
  BadgeCheck, AlertCircle, Search, KeyRound, UserCog,
} from "lucide-react";

function getSuperadminAxios() {
  const token = window.__SUPERADMIN_TOKEN__ ||
    (() => { try { return JSON.parse(localStorage.getItem("superadmin_auth"))?.token; } catch { return null; } })();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const SUPPORT_LABELS = {
  community: "Community",
  email:     "Email",
  priority:  "Priority Email",
  dedicated: "Dedicated Manager",
};

function rupees(paise) {
  if (!paise) return "₹0";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

// ── Master feature catalog ─────────────────────────────────────────────────────
// Exactly mirrors the sidebar navigation items a workspace admin sees.
// Always-free items (Dashboard, Projects, My Tasks, Notifications, Profile,
// Admin Panel, Billing) are NOT listed here — they're never gated.
export const MASTER_FEATURES = [
  // ── Sidebar modules (user-facing) ─────────────────────────────────────────
  { key: "wiki_docs",              label: "Wiki / Docs",              category: "Sidebar" },
  { key: "leave_management",       label: "Leave",                    category: "Sidebar" },
  { key: "okr_goals",              label: "Goals",                    category: "Sidebar" },
  { key: "performance_reviews",    label: "Reviews",                  category: "Sidebar" },
  { key: "basic_reporting",        label: "Reports",                  category: "Sidebar" },
  { key: "team_chat",              label: "Team Chat",                category: "Sidebar" },
  // ── AI modules ────────────────────────────────────────────────────────────
  { key: "ai_hub",                 label: "AI Hub",                   category: "AI" },
  { key: "advanced_analytics",     label: "Strategic Intelligence",   category: "AI" },
  { key: "workspace_intelligence", label: "Workspace Intelligence",   category: "AI" },
  { key: "ai_autopilot",           label: "AI Autopilot",             category: "AI" },
  { key: "ai_testing_agent",       label: "Testing Agent",            category: "AI" },
  // ── Admin modules ─────────────────────────────────────────────────────────
  { key: "attendance",             label: "Attendance",               category: "Admin" },
  { key: "custom_branding",        label: "Enterprise",               category: "Admin" },
  { key: "slack_migration",        label: "Migrations",               category: "Admin" },
  // ── Power-user features ───────────────────────────────────────────────────
  { key: "time_tracking",          label: "Time Tracking",            category: "Power" },
  { key: "issue_templates",        label: "Issue Templates",          category: "Power" },
  { key: "saved_filters",          label: "Saved Filters",            category: "Power" },
];

const FEATURE_BY_KEY = Object.fromEntries(MASTER_FEATURES.map(f => [f.key, f]));
const FEATURE_CATEGORIES = [...new Set(MASTER_FEATURES.map(f => f.category))];

export function featureLabel(key) {
  return FEATURE_BY_KEY[key]?.label ?? key;
}

// ── Feature multi-select dropdown ─────────────────────────────────────────────
function FeatureSelector({ selected, onChange }) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const [category, setCategory] = useState("All");
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = MASTER_FEATURES.filter(f => {
    const matchCat  = category === "All" || f.category === category;
    const matchText = !search || f.label.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchText;
  });

  function toggle(key) {
    if (selected.includes(key)) onChange(selected.filter(k => k !== key));
    else onChange([...selected, key]);
  }

  function removeFeature(key) { onChange(selected.filter(k => k !== key)); }

  return (
    <div className="space-y-2" ref={ref}>
      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border theme-border theme-surface min-h-[36px]">
          {selected.map(key => (
            <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-500/10 text-indigo-500 font-medium">
              {featureLabel(key)}
              <button type="button" onClick={() => removeFeature(key)} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger */}
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text-muted hover:theme-text transition-colors">
        <span className="flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          {selected.length === 0 ? "Select features to include…" : `${selected.length} feature${selected.length !== 1 ? "s" : ""} selected — add more`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="border theme-border rounded-xl theme-surface shadow-xl overflow-hidden z-30 relative">
          {/* Search + category filter */}
          <div className="px-3 pt-3 pb-2 border-b theme-border space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-soft)]">
              <Search className="w-3.5 h-3.5 theme-text-muted shrink-0" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search features…"
                className="flex-1 bg-transparent text-sm theme-text focus:outline-none placeholder:theme-text-muted" />
              {search && <button onClick={() => setSearch("")} className="theme-text-muted hover:theme-text text-xs">✕</button>}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["All", ...FEATURE_CATEGORIES].map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    category === cat ? "bg-indigo-500 text-white" : "bg-[var(--surface-soft)] theme-text-muted hover:theme-text"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Feature list */}
          <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border)]">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm theme-text-muted text-center">No features match "{search}"</p>
            ) : filtered.map(f => {
              const isSelected = selected.includes(f.key);
              return (
                <button key={f.key} type="button" onClick={() => toggle(f.key)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-indigo-500/8" : "hover:bg-[var(--surface-soft)]"
                  }`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "bg-indigo-500 border-indigo-500" : "theme-border"
                  }`}>
                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm theme-text">{f.label}</p>
                    <p className="text-[10px] theme-text-muted">{f.category}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t theme-border flex items-center justify-between">
            <span className="text-xs theme-text-muted">{selected.length} selected</span>
            <button type="button" onClick={() => setOpen(false)}
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-600">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slug generator ────────────────────────────────────────────────────────────
function toSlug(name) {
  return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Plan modal (create / edit) ────────────────────────────────────────────────
const EMPTY_FORM = {
  name: "", slug: "", tagline: "", description: "",
  price_monthly: "", price_yearly: "", yearly_discount_pct: 0,
  member_limit: 10, max_projects: "", max_integrations: "", storage_limit_gb: "",
  features: [], support_level: "email",
  trial_days: 7, grace_period_days: 3,
  is_popular: false, display_order: 0,
};

function PlanModal({ plan, onClose, onSaved }) {
  const isEdit = !!plan;
  const [form, setForm] = useState(() =>
    isEdit ? {
      ...EMPTY_FORM,
      // Only copy the fields we actually edit — never spread raw paise values into form
      name:               plan.name || "",
      slug:               plan.slug || "",
      tagline:            plan.tagline || "",
      description:        plan.description || "",
      price_monthly:      plan.price_monthly_paise ? plan.price_monthly_paise / 100 : "",
      price_yearly:       plan.price_yearly_paise  ? plan.price_yearly_paise  / 100 : "",
      yearly_discount_pct: plan.yearly_discount_pct || 0,
      member_limit:       plan.member_limit || "",
      max_projects:       plan.max_projects || "",
      max_integrations:   plan.max_integrations || "",
      storage_limit_gb:   plan.storage_limit_gb || "",
      features:           Array.isArray(plan.features) ? plan.features : [],
      support_level:      plan.support_level || "email",
      trial_days:         plan.trial_days ?? 7,
      grace_period_days:  plan.grace_period_days ?? 3,
      is_popular:         plan.is_popular || false,
      display_order:      plan.display_order || 0,
    } : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(isEdit);
  // Price refs updated synchronously in the event handler — immune to React batching delays
  const priceRef = useRef({
    monthly: form.price_monthly,
    yearly:  form.price_yearly,
  });

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function handleNameChange(name) {
    set("name", name);
    if (!slugEdited) set("slug", toSlug(name));
  }

  function handlePriceChange(key, val) {
    const parsed = val === "" ? "" : Number(val);
    // Update price ref immediately — before React's batched setForm runs
    if (key === "price_monthly") priceRef.current.monthly = parsed;
    if (key === "price_yearly")  priceRef.current.yearly  = parsed;

    setForm(p => {
      const monthly = key === "price_monthly" ? (Number(val) || 0) : (Number(p.price_monthly) || 0);
      const yearly  = key === "price_yearly"  ? (Number(val) || 0) : (Number(p.price_yearly)  || 0);
      const annualMonthly = monthly * 12;
      const discount = (monthly > 0 && yearly > 0 && annualMonthly > yearly)
        ? Math.round(((annualMonthly - yearly) / annualMonthly) * 100)
        : 0;
      return { ...p, [key]: parsed, yearly_discount_pct: discount };
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.slug) return toast.error("Name and slug are required");
    setSaving(true);
    try {
      const api = getSuperadminAxios();
      const payload = {
        ...form,
        // Always read prices from priceRef — guaranteed to be the latest typed value
        price_monthly: Number(priceRef.current.monthly) || 0,
        price_yearly:  Number(priceRef.current.yearly)  || 0,
      };
      if (isEdit) {
        const { data } = await api.put(`/superadmin/plans/${plan.id}`, payload);
        toast.success("Plan updated");
        onSaved(data);
      } else {
        const { data } = await api.post("/superadmin/plans", payload);
        toast.success("Plan created");
        onSaved(data);
      }
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const numField = (label, key, placeholder = "") => (
    <div>
      <label className="block text-xs font-semibold theme-text-muted mb-1">{label}</label>
      <input type="number" min="0" value={form[key]} onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="theme-surface border theme-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b theme-border sticky top-0 theme-surface z-10">
          <h2 className="text-base font-bold theme-text">{isEdit ? `Edit — ${plan.name}` : "Create New Plan"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] theme-text-muted"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">

          {/* Identity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold theme-text-muted mb-1">Plan Name *</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)}
                placeholder="Pro" required
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold theme-text-muted mb-1">
                Slug *
                <span className="ml-1.5 font-normal opacity-60">
                  {isEdit ? "cannot be changed after creation" : 'unique code ID, e.g. "pro"'}
                </span>
              </label>
              {isEdit ? (
                <div className="w-full px-3 py-2 rounded-lg border theme-border bg-[var(--surface-soft)] text-sm theme-text-muted font-mono">
                  {form.slug}
                </div>
              ) : (
                <input value={form.slug}
                  onChange={e => { setSlugEdited(true); set("slug", toSlug(e.target.value)); }}
                  placeholder="pro" required
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold theme-text-muted mb-1">Tagline</label>
            <input value={form.tagline} onChange={e => set("tagline", e.target.value)}
              placeholder="Built for growing businesses"
              className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </div>

          {/* Pricing */}
          <div className="border theme-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold theme-text uppercase tracking-wider">Pricing per user (₹ Rupees)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold theme-text-muted mb-1">Per User / Month (₹)</label>
                <input type="text" inputMode="numeric" value={form.price_monthly}
                  onChange={e => handlePriceChange("price_monthly", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="999"
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold theme-text-muted mb-1">Per User / Year (₹)</label>
                <input type="text" inputMode="numeric" value={form.price_yearly}
                  onChange={e => handlePriceChange("price_yearly", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="9999"
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
              </div>
            </div>
            {/* Auto-calculated discount */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
              form.yearly_discount_pct > 0 ? "bg-green-500/10 text-green-600" : "bg-[var(--surface-soft)] theme-text-muted"
            }`}>
              {form.yearly_discount_pct > 0
                ? <><CheckCircle className="w-3.5 h-3.5" /> Yearly saves <strong>{form.yearly_discount_pct}%</strong> vs monthly (auto-calculated)</>
                : <>Fill both prices to auto-calculate yearly discount. Enter 0 for free plans.</>}
            </div>
          </div>

          {/* Limits */}
          <div className="border theme-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold theme-text uppercase tracking-wider">Limits</p>
            <div className="grid grid-cols-2 gap-3">
              {numField("Max Members", "member_limit", "50")}
              {numField("Max Projects (blank = unlimited)", "max_projects")}
              {numField("Max Integrations (blank = unlimited)", "max_integrations")}
              {numField("Storage GB (blank = unlimited)", "storage_limit_gb")}
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold theme-text uppercase tracking-wider">Features Included in Plan</label>
              {form.features.length > 0 && (
                <button type="button" onClick={() => set("features", [])}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors">Clear all</button>
              )}
            </div>
            <FeatureSelector selected={form.features} onChange={v => set("features", v)} />
            <p className="text-xs theme-text-muted mt-1.5">
              Only features selected here will be available to workspaces on this plan.
            </p>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold theme-text-muted mb-1">Support Level</label>
              <select value={form.support_level} onChange={e => set("support_level", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
                {Object.entries(SUPPORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {numField("Display Order", "display_order", "0")}
            {numField("Free Trial Days (0 = no trial)", "trial_days", "7")}
            {numField("Grace Period Days (after failed payment)", "grace_period_days", "3")}
          </div>

          {/* Toggles */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.is_popular} onChange={e => set("is_popular", e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            <span className="text-sm theme-text">Show "Most Popular" badge on this plan</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium theme-text-muted hover:theme-text theme-surface border theme-border transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── User management modal (reused from Plans page) ────────────────────────────
function UserManageModal({ ws, onClose }) {
  const api = getSuperadminAxios();
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [action, setAction]           = useState(null); // { type: "edit"|"reset", user }
  const [editForm, setEditForm]       = useState({ username: "", email: "", role: "" });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    api.get(`/superadmin/workspaces/${ws.id}/users`)
      .then(r => setUsers(r.data || []))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, [ws.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit  = u => { setAction({ type: "edit",  user: u }); setEditForm({ username: u.username, email: u.email, role: u.role }); };
  const openReset = u => { setAction({ type: "reset", user: u }); setNewPassword(""); };
  const closeAction = () => setAction(null);

  const handleEdit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/superadmin/workspaces/${ws.id}/users/${action.user.id}`, editForm);
      setUsers(prev => prev.map(u => u.id === action.user.id ? { ...u, ...data } : u));
      toast.success("User updated");
      closeAction();
    } catch (err) { toast.error(err?.response?.data?.error || "Update failed"); }
    setSaving(false);
  };

  const handleReset = async e => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return toast.error("Min 6 characters");
    setSaving(true);
    try {
      await api.post(`/superadmin/workspaces/${ws.id}/reset-password`, { userId: action.user.id, newPassword });
      toast.success(`Password reset for ${action.user.username}`);
      closeAction();
    } catch (err) { toast.error(err?.response?.data?.error || "Reset failed"); }
    setSaving(false);
  };

  const handleDelete = async u => {
    if (!window.confirm(`Delete user "${u.username}" (${u.email})? This cannot be undone.`)) return;
    try {
      await api.delete(`/superadmin/workspaces/${ws.id}/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success(`${u.username} deleted`);
      if (action?.user?.id === u.id) closeAction();
    } catch (err) { toast.error(err?.response?.data?.error || "Delete failed"); }
  };

  const ROLE_COLOR = {
    admin: "bg-indigo-500/10 text-indigo-500",
    owner: "bg-purple-500/10 text-purple-500",
    user:  "bg-gray-500/10 text-gray-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="theme-surface rounded-2xl border theme-border w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b theme-border">
          <h3 className="font-semibold theme-text">{ws.name} — Users ({users.length})</h3>
          <button onClick={onClose} className="theme-text-muted hover:theme-text"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm theme-text-muted">Loading…</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm theme-text-muted">No users in this workspace</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border theme-border hover:bg-[var(--surface-soft)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium theme-text truncate">{u.username}</p>
                    <p className="text-xs theme-text-muted truncate">{u.email}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${ROLE_COLOR[u.role] || ROLE_COLOR.user}`}>
                    {u.role}
                  </span>
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-indigo-500 shrink-0" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openReset(u)} className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-amber-500 shrink-0" title="Reset password">
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-red-500 shrink-0" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {action?.type === "edit" && (
            <form onSubmit={handleEdit} className="mt-4 p-3 rounded-xl border theme-border bg-[var(--surface-soft)] space-y-2">
              <p className="text-xs font-semibold theme-text">Edit <span className="text-indigo-500">{action.user.username}</span></p>
              <div className="grid grid-cols-2 gap-2">
                <input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="Username"
                  className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email"
                  className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="col-span-2 px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                  {saving ? "…" : "Save"}
                </button>
                <button type="button" onClick={closeAction} className="px-3 py-2 border theme-border rounded-lg text-sm theme-text">Cancel</button>
              </div>
            </form>
          )}

          {action?.type === "reset" && (
            <form onSubmit={handleReset} className="mt-4 p-3 rounded-xl border theme-border bg-[var(--surface-soft)] space-y-2">
              <p className="text-xs font-semibold theme-text">Reset password for <span className="text-amber-500">{action.user.username}</span></p>
              <div className="flex gap-2">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="flex-1 px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                <button type="submit" disabled={saving}
                  className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60">
                  {saving ? "…" : "Reset"}
                </button>
                <button type="button" onClick={closeAction} className="px-3 py-2 border theme-border rounded-lg text-sm theme-text">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, workspaces = [], onEdit, onDelete, onSync, onManageUsers }) {
  const [syncing, setSyncing]       = useState(false);
  const [expanded, setExpanded]     = useState(false);
  const [wsExpanded, setWsExpanded] = useState(false);

  const razorpaySynced = !!(plan.razorpay_monthly_plan_id || plan.razorpay_yearly_plan_id);
  const isFree = !plan.price_monthly_paise && !plan.price_yearly_paise;
  const features = Array.isArray(plan.features) ? plan.features : [];

  async function handleSync() {
    if (isFree) return toast("Free plans don't need Razorpay sync.", { icon: "ℹ️" });
    setSyncing(true);
    try {
      await onSync(plan.id);
      toast.success("Synced to Razorpay");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className={`theme-surface border rounded-xl overflow-hidden ${plan.is_active ? "theme-border" : "border-dashed border-gray-400/30 opacity-60"}`}>

      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold theme-text">{plan.name}</p>
              {plan.is_popular && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 uppercase tracking-wide">
                  <Star className="w-2.5 h-2.5" /> Popular
                </span>
              )}
              {!plan.is_active && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-500 uppercase">Inactive</span>
              )}
            </div>
            <p className="text-xs theme-text-muted mt-0.5">{plan.tagline || plan.slug}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onEdit(plan)}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] theme-text-muted hover:theme-text transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(plan)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 theme-text-muted hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-3 mt-3 flex-wrap">
          {isFree ? (
            <span className="text-2xl font-black theme-text">Free</span>
          ) : (
            <>
              <span className="text-2xl font-black theme-text">
                {rupees(plan.price_monthly_paise)}<span className="text-sm font-normal theme-text-muted">/user/mo</span>
              </span>
              {plan.price_yearly_paise > 0 && (
                <span className="text-sm theme-text-muted">
                  {rupees(plan.price_yearly_paise)}/user/yr
                  {plan.yearly_discount_pct > 0 && (
                    <span className="ml-1.5 text-green-500 font-semibold">{plan.yearly_discount_pct}% off</span>
                  )}
                </span>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs theme-text-muted">
            <Users className="w-3 h-3" /> {plan.member_limit > 0 ? `${plan.member_limit} members` : "Unlimited members"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs theme-text-muted">
            <Crown className="w-3 h-3" /> {SUPPORT_LABELS[plan.support_level] || plan.support_level}
          </span>
          {plan.trial_days > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-indigo-500">
              <Zap className="w-3 h-3" /> {plan.trial_days}d free trial
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs theme-text-muted">
            <CheckCircle className="w-3 h-3" /> {plan.subscriber_count ?? 0} workspace{plan.subscriber_count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Razorpay sync bar */}
      {!isFree && (
        <div className={`px-5 py-2.5 border-t flex items-center justify-between gap-3 ${
          razorpaySynced ? "bg-green-500/5 border-green-500/20" : "bg-amber-500/5 border-amber-500/20"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {razorpaySynced
              ? <BadgeCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
              : <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            <span className={`text-xs font-medium truncate ${razorpaySynced ? "text-green-600" : "text-amber-600"}`}>
              {razorpaySynced ? `Synced · ${plan.razorpay_monthly_plan_id}` : "Not synced to Razorpay yet"}
            </span>
          </div>
          <button onClick={handleSync} disabled={syncing}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5 ${
              razorpaySynced
                ? "theme-text-muted hover:theme-text theme-surface border theme-border"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }`}>
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {razorpaySynced ? "Re-sync" : "Sync now"}
          </button>
        </div>
      )}

      {/* Features (expandable) */}
      {features.length > 0 && (
        <div className="border-t theme-border">
          <button onClick={() => setExpanded(p => !p)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs theme-text-muted hover:theme-text transition-colors">
            <span>{features.length} feature{features.length !== 1 ? "s" : ""} included</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <ul className="px-5 pb-3 space-y-1.5 columns-2">
              {features.map(key => (
                <li key={key} className="flex items-center gap-1.5 text-xs theme-text-muted break-inside-avoid">
                  <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                  {featureLabel(key)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Workspaces on this plan (expandable) */}
      <div className="border-t theme-border">
        <button onClick={() => setWsExpanded(p => !p)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs theme-text-muted hover:theme-text transition-colors">
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""} on this plan
          </span>
          {wsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {wsExpanded && (
          workspaces.length === 0 ? (
            <p className="px-5 pb-3 text-xs theme-text-muted italic">No workspaces on this plan yet.</p>
          ) : (
            <ul className="px-5 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
              {workspaces.map(ws => {
                const status = ws.is_active ? "active" : "suspended";
                return (
                  <li key={ws.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b theme-border last:border-0">
                    <div className="min-w-0">
                      <p className="theme-text font-medium truncate">{ws.name}</p>
                      {ws.owner_email && (
                        <p className="theme-text-muted truncate">{ws.owner_email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] theme-text-muted">
                        {ws.user_count ?? 0} users
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        status === "active" ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                      }`}>
                        {status}
                      </span>
                      <button
                        onClick={() => onManageUsers(ws)}
                        className="p-1 rounded hover:bg-[var(--surface-soft)] text-indigo-500"
                        title="Manage users"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperadminPlans() {
  const [plans, setPlans]           = useState([]);
  const [workspacesByPlan, setWsByPlan] = useState({}); // { [planSlug]: ws[] }
  const [loading, setLoading]       = useState(false);
  const [showCreate, setCreate]     = useState(false);
  const [editPlan, setEdit]         = useState(null);
  const [manageWs, setManageWs]     = useState(null); // workspace whose users to manage
  const api = getSuperadminAxios();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, wsRes] = await Promise.all([
        api.get("/superadmin/plans"),
        api.get("/superadmin/workspaces"),
      ]);
      setPlans(plansRes.data || []);

      // Group workspaces by their billing_plan slug
      const grouped = {};
      (wsRes.data || []).forEach(ws => {
        const slug = ws.billing_plan || ws.plan || "unassigned";
        if (!grouped[slug]) grouped[slug] = [];
        grouped[slug].push(ws);
      });
      setWsByPlan(grouped);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSync(planId) {
    await api.post(`/superadmin/plans/${planId}/sync-razorpay`);
    await load();
  }

  async function handleDelete(plan) {
    if (!window.confirm(`Permanently delete "${plan.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/superadmin/plans/${plan.id}`);
      toast.success(`"${plan.name}" deleted`);
      setPlans(prev => prev.filter(p => p.id !== plan.id));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to delete plan");
    }
  }

  const active   = plans.filter(p => p.is_active);
  const totalSubs = plans.reduce((s, p) => s + (p.subscriber_count || 0), 0);
  const mrrPaise  = plans.reduce((s, p) => s + ((p.price_monthly_paise || 0) * (p.subscriber_count || 0)), 0);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold theme-text">Plan Configuration</h1>
          <p className="text-xs theme-text-muted mt-0.5">Define plans, pricing, features, and Razorpay sync</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl theme-surface border theme-border theme-text-muted hover:theme-text transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors">
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Plans",       value: active.length,   sub: `${plans.length - active.length} inactive` },
          { label: "Total Workspaces",    value: totalSubs,       sub: "across all plans" },
          { label: "Est. MRR",           value: rupees(mrrPaise), sub: "based on monthly prices" },
        ].map(s => (
          <div key={s.label} className="theme-surface border theme-border rounded-xl px-5 py-4">
            <p className="text-2xl font-bold theme-text">{s.value}</p>
            <p className="text-xs font-medium theme-text mt-0.5">{s.label}</p>
            <p className="text-xs theme-text-muted mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Razorpay notice */}
      <div className="theme-surface border theme-border rounded-xl px-5 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs theme-text-muted leading-relaxed">
          <span className="font-semibold theme-text">Razorpay setup — </span>
          Set <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)]">RAZORPAY_KEY_ID</code>,{" "}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)]">RAZORPAY_KEY_SECRET</code>, and{" "}
          <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)]">RAZORPAY_WEBHOOK_SECRET</code> in <code className="px-1 py-0.5 rounded bg-[var(--surface-soft)]">.env</code>.
          After creating a paid plan, click <strong>Sync now</strong> to push it to Razorpay before workspaces can subscribe.
        </p>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin theme-text-muted" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              workspaces={workspacesByPlan[plan.slug] || []}
              onEdit={setEdit}
              onDelete={handleDelete}
              onSync={handleSync}
              onManageUsers={setManageWs}
            />
          ))}
        </div>
      )}

      {showCreate && <PlanModal onClose={() => setCreate(false)} onSaved={load} />}
      {editPlan   && <PlanModal plan={editPlan} onClose={() => setEdit(null)} onSaved={load} />}
      {manageWs   && <UserManageModal ws={manageWs} onClose={() => setManageWs(null)} />}
    </div>
  );
}
