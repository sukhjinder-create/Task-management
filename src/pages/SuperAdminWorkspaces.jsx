// src/pages/SuperAdminWorkspaces.jsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import toast from "react-hot-toast";
import {
  Building2, Users, ShieldCheck, ShieldOff, Plus,
  MoreVertical, Pencil, Trash2, CheckCircle, XCircle,
  Crown, Calendar, X, KeyRound, UserCog
} from "lucide-react";

function getSuperadminAxios() {
  const token = window.__SUPERADMIN_TOKEN__ ||
    (() => { try { return JSON.parse(localStorage.getItem("superadmin_auth"))?.token; } catch { return null; } })();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const PLAN_COLOR = {
  basic:      "bg-gray-500/10 text-gray-500",
  pro:        "bg-blue-500/10 text-blue-500",
  enterprise: "bg-indigo-500/10 text-indigo-500",
};

const STATUS_COLOR = {
  active:    "bg-green-500/10 text-green-500",
  suspended: "bg-amber-500/10 text-amber-500",
  deleted:   "bg-red-500/10 text-red-500",
};

function relativeDate(iso) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export default function SuperAdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editWs, setEditWs]         = useState(null);
  const [detailWs, setDetailWs]     = useState(null);  // workspace detail panel
  const [menuId, setMenuId]         = useState(null);

  const axiosSuper = getSuperadminAxios();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, statsRes] = await Promise.all([
        axiosSuper.get("/superadmin/workspaces"),
        axiosSuper.get("/superadmin/workspaces/stats"),
      ]);
      setWorkspaces(wsRes.data || []);
      setStats(statsRes.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const ev = () => load();
    window.addEventListener("superadmin:login", ev);
    return () => window.removeEventListener("superadmin:login", ev);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (ws, status) => {
    try {
      await axiosSuper.put(`/superadmin/workspaces/${ws.id}/status-v2`, { status });
      toast.success(`Workspace ${status}`);
      setMenuId(null);
      load();
    } catch (err) { toast.error(err?.response?.data?.error || "Failed"); }
  };

  const deleteWs = async (ws) => {
    if (!window.confirm(`Permanently delete "${ws.name}" and all its data? This cannot be undone.`)) return;
    try {
      await axiosSuper.delete(`/superadmin/workspaces/${ws.id}`);
      toast.success(`"${ws.name}" permanently deleted`);
      setMenuId(null);
      setWorkspaces(prev => prev.filter(w => w.id !== ws.id));
    } catch (err) { toast.error(err?.response?.data?.error || "Failed to delete"); }
  };

  return (
    <div className="space-y-6">

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="w-4 h-4" />} label="Total Workspaces"  value={stats?.total_workspaces  ?? "—"} color="indigo" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Active"          value={stats?.active_workspaces  ?? "—"} color="green"  />
        <StatCard icon={<XCircle className="w-4 h-4" />}    label="Suspended"        value={stats?.suspended_workspaces ?? "—"} color="amber" />
        <StatCard icon={<Users className="w-4 h-4" />}      label="Total Users"      value={stats?.total_users        ?? "—"} color="blue"  />
      </div>

      {/* ── Header + New button ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold theme-text">Workspaces</h1>
          <p className="text-xs theme-text-muted mt-0.5">
            {stats?.new_this_month ? `${stats.new_this_month} new this month` : "All client workspaces"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </div>

      {/* ── Workspace list ────────────────────────────────────────────────── */}
      {loading && !workspaces.length ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-[var(--surface-soft)] animate-pulse" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-20 theme-text-muted text-sm">
          No workspaces yet. Create the first one.
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map(ws => {
            const status = ws.is_active ? "active" : "suspended";
            return (
              <div
                key={ws.id}
                className="theme-surface-card rounded-xl border theme-border p-4 flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-indigo-500" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold theme-text truncate">{ws.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${PLAN_COLOR[ws.billing_plan || ws.plan] || PLAN_COLOR.basic}`}>
                      {ws.billing_plan || ws.plan || "basic"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${STATUS_COLOR[status]}`}>
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {ws.owner_email && (
                      <span className="text-xs theme-text-muted flex items-center gap-1">
                        <Crown className="w-3 h-3" /> {ws.owner_email}
                      </span>
                    )}
                    <span className="text-xs theme-text-muted flex items-center gap-1">
                      <Users className="w-3 h-3" /> {ws.user_count ?? 0}{(ws.max_members ?? ws.member_limit) > 0 ? ` / ${ws.max_members ?? ws.member_limit}` : " / ∞"} users
                    </span>
                    <span className="text-xs theme-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {relativeDate(ws.created_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuId(menuId === ws.id ? null : ws.id)}
                    className="p-2 rounded-lg hover:bg-[var(--surface-soft)] theme-text-muted hover:theme-text"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuId === ws.id && (
                    <div className="absolute right-0 top-9 z-20 w-44 theme-surface rounded-xl border theme-border shadow-xl py-1">
                      <MenuItem icon={<UserCog className="w-3.5 h-3.5" />} label="View Users"
                        onClick={() => { setDetailWs(ws); setMenuId(null); }} />
                      <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Edit"
                        onClick={() => { setEditWs(ws); setMenuId(null); }} />
                      {ws.is_active
                        ? <MenuItem icon={<ShieldOff className="w-3.5 h-3.5" />} label="Suspend"
                            onClick={() => setStatus(ws, "suspended")} className="text-amber-500" />
                        : <MenuItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Activate"
                            onClick={() => setStatus(ws, "active")} className="text-green-500" />
                      }
                      <div className="border-t theme-border my-1" />
                      <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete"
                        onClick={() => deleteWs(ws)} className="text-red-500" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
          axiosSuper={axiosSuper}
        />
      )}

      {/* ── Workspace detail modal ───────────────────────────────────────── */}
      {detailWs && (
        <WorkspaceDetailModal
          ws={detailWs}
          onClose={() => setDetailWs(null)}
          axiosSuper={axiosSuper}
        />
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editWs && (
        <EditModal
          ws={editWs}
          onClose={() => setEditWs(null)}
          onSaved={() => { setEditWs(null); load(); }}
          axiosSuper={axiosSuper}
        />
      )}

      {/* Close menu on outside click */}
      {menuId && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
      )}
    </div>
  );
}

// ─── Workspace Detail Modal ───────────────────────────────────────────────────
function WorkspaceDetailModal({ ws, onClose, axiosSuper }) {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [resetUser, setResetUser]   = useState(null);  // user object for password reset
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting]   = useState(false);

  useEffect(() => {
    axiosSuper.get(`/superadmin/workspaces/${ws.id}/users`)
      .then(r => setUsers(r.data || []))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, [ws.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6)
      return toast.error("Password must be at least 6 characters");
    setResetting(true);
    try {
      await axiosSuper.post(`/superadmin/workspaces/${ws.id}/reset-password`, {
        userId: resetUser.id,
        newPassword,
      });
      toast.success(`Password reset for ${resetUser.username}`);
      setResetUser(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Reset failed");
    }
    setResetting(false);
  };

  const ROLE_COLOR = {
    admin: "bg-indigo-500/10 text-indigo-500",
    owner: "bg-purple-500/10 text-purple-500",
    user:  "bg-gray-500/10 text-gray-500",
  };

  return (
    <Modal title={`${ws.name} — Users (${users.length}${(ws.max_members ?? ws.member_limit) > 0 ? ` / ${ws.max_members ?? ws.member_limit}` : ""})`} onClose={onClose}>
      {loading ? (
        <div className="py-8 text-center text-sm theme-text-muted">Loading…</div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-sm theme-text-muted">No users in this workspace</div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border theme-border hover:bg-[var(--surface-soft)]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium theme-text truncate">{u.username}</p>
                <p className="text-xs theme-text-muted truncate">{u.email}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${ROLE_COLOR[u.role] || ROLE_COLOR.user}`}>
                {u.role}
              </span>
              <button
                onClick={() => { setResetUser(u); setNewPassword(""); }}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-amber-500 shrink-0"
                title="Reset password"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Password reset inline form */}
      {resetUser && (
        <form onSubmit={handleResetPassword} className="mt-4 p-3 rounded-xl border theme-border bg-[var(--surface-soft)] space-y-2">
          <p className="text-xs font-semibold theme-text">
            Reset password for <span className="text-amber-500">{resetUser.username}</span>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="flex-1 px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            />
            <button type="submit" disabled={resetting}
              className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60">
              {resetting ? "…" : "Reset"}
            </button>
            <button type="button" onClick={() => setResetUser(null)}
              className="px-3 py-2 border theme-border rounded-lg text-sm theme-text">
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated, axiosSuper }) {
  const [form, setForm] = useState({
    name: "", plan: "basic",
    ownerEmail: "", ownerPassword: "", ownerName: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.ownerEmail || !form.ownerPassword)
      return toast.error("Name, owner email and password are required");
    setSaving(true);
    try {
      await axiosSuper.post("/superadmin/workspaces", form);
      toast.success("Workspace created");
      onCreated();
    } catch (err) { toast.error(err?.response?.data?.error || "Create failed"); }
    setSaving(false);
  };

  return (
    <Modal title="Create Workspace" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Workspace Name" className="col-span-2">
            <input value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Acme Corp" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </Field>
          <Field label="Plan" className="col-span-2">
            <select value={form.plan} onChange={e => set("plan", e.target.value)} className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
          <Field label="Admin Email" className="col-span-2">
            <input type="email" value={form.ownerEmail}
              onChange={e => set("ownerEmail", e.target.value)}
              placeholder="admin@company.com" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </Field>
          <Field label="Admin Password" className="col-span-2">
            <input type="password" value={form.ownerPassword}
              onChange={e => set("ownerPassword", e.target.value)}
              placeholder="Temporary password" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </Field>
          <Field label="Admin Name (optional)" className="col-span-2">
            <input value={form.ownerName} onChange={e => set("ownerName", e.target.value)}
              placeholder="John Smith" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Creating…" : "Create Workspace"}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 border theme-border rounded-lg text-sm theme-text">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ ws, onClose, onSaved, axiosSuper }) {
  const [form, setForm] = useState({
    name: ws.name || "",
    plan: ws.plan || "basic",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axiosSuper.put(`/superadmin/workspaces/${ws.id}`, form);
      toast.success("Workspace updated");
      onSaved();
    } catch (err) { toast.error(err?.response?.data?.error || "Update failed"); }
    setSaving(false);
  };

  return (
    <Modal title={`Edit — ${ws.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Workspace Name" className="col-span-2">
            <input value={form.name} onChange={e => set("name", e.target.value)} className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </Field>
          <Field label="Plan" className="col-span-2">
            <select value={form.plan} onChange={e => set("plan", e.target.value)} className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 border theme-border rounded-lg text-sm theme-text">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="theme-surface rounded-2xl border theme-border w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b theme-border">
          <h3 className="font-semibold theme-text">{title}</h3>
          <button onClick={onClose} className="theme-text-muted hover:theme-text">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium theme-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function MenuItem({ icon, label, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--surface-soft)] transition-colors theme-text ${className}`}
    >
      {icon} {label}
    </button>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    indigo: "bg-indigo-500/10 text-indigo-500",
    green:  "bg-green-500/10 text-green-500",
    amber:  "bg-amber-500/10 text-amber-500",
    blue:   "bg-blue-500/10 text-blue-500",
  };
  return (
    <div className="theme-surface-card rounded-xl border theme-border px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold theme-text">{value}</p>
        <p className="text-xs theme-text-muted">{label}</p>
      </div>
    </div>
  );
}
