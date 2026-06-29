// src/pages/SuperAdminWorkspaces.jsx
import { useEffect, useState, useCallback } from "react";
import superadminApi from "../superadminApi";
import toast from "react-hot-toast";
import {
  Building2, Users, ShieldCheck, ShieldOff, Plus,
  MoreVertical, Pencil, Trash2, CheckCircle, XCircle,
  Crown, Calendar, X, KeyRound, UserCog, CreditCard
} from "lucide-react";

const PLAN_COLOR = {
  basic:      "border border-[color:var(--border)] text-[color:var(--text-muted)]",
  pro:        "border border-[color:var(--border)] text-[color:var(--text-muted)]",
  enterprise: "border border-[color:var(--border)] text-[color:var(--primary)]",
};

const STATUS_COLOR = {
  active:    "border border-[color:var(--border)] text-green-500",
  suspended: "border border-[color:var(--border)] text-amber-500",
  deleted:   "border border-[color:var(--border)] text-red-500",
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
  const [showCreate, setShowCreate]     = useState(false);
  const [editWs, setEditWs]             = useState(null);
  const [detailWs, setDetailWs]         = useState(null);
  const [assignPlanWs, setAssignPlanWs] = useState(null);
  const [menuId, setMenuId]             = useState(null);

  const axiosSuper = superadminApi;

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

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Superadmin</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Workspaces</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[color:var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[color:var(--primary-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Workspace
        </button>
      </header>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="w-4 h-4" />} label="Total Workspaces"  value={stats?.total_workspaces  ?? "—"} color="primary" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Active"          value={stats?.active_workspaces  ?? "—"} color="success"  />
        <StatCard icon={<XCircle className="w-4 h-4" />}    label="Suspended"        value={stats?.suspended_workspaces ?? "—"} color="warn" />
        <StatCard icon={<Users className="w-4 h-4" />}      label="Total Users"      value={stats?.total_users        ?? "—"} color="muted"  />
      </div>

      {/* Sub-heading */}
      <p className="text-xs text-[color:var(--text-muted)]">
        {stats?.new_this_month ? `${stats.new_this_month} new this month` : "All client workspaces"}
      </p>

      {/* ── Workspace list ────────────────────────────────────────────────── */}
      {loading && !workspaces.length ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] animate-pulse" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-20 text-[color:var(--text-muted)] text-sm">
          No workspaces yet. Create the first one.
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map(ws => {
            const status = ws.is_active ? "active" : "suspended";
            return (
              <div
                key={ws.id}
                className="rounded-lg border border-[color:var(--border)] p-4 flex items-center gap-4 hover:bg-[var(--surface-soft)] transition-colors"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg border border-[color:var(--border)] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-[color:var(--primary)]" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-[color:var(--text)] truncate">{ws.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${PLAN_COLOR[ws.billing_plan || ws.plan] || PLAN_COLOR.basic}`}>
                      {ws.billing_plan || ws.plan || "basic"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${STATUS_COLOR[status]}`}>
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {ws.owner_email && (
                      <span className="text-xs text-[color:var(--text-muted)] flex items-center gap-1">
                        <Crown className="w-3 h-3" /> {ws.owner_email}
                      </span>
                    )}
                    <span className="text-xs text-[color:var(--text-muted)] flex items-center gap-1">
                      <Users className="w-3 h-3" /> {ws.user_count ?? 0}{(ws.max_members ?? ws.member_limit) > 0 ? ` / ${ws.max_members ?? ws.member_limit}` : " / ∞"} users
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)] flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {relativeDate(ws.created_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuId(menuId === ws.id ? null : ws.id)}
                    className="p-2 rounded-lg hover:bg-[var(--surface-soft)] text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuId === ws.id && (
                    <div className="absolute right-0 top-9 z-20 w-44 bg-[var(--surface)] rounded-lg border border-[color:var(--border)] py-1">
                      <MenuItem icon={<UserCog className="w-3.5 h-3.5" />} label="View Users"
                        onClick={() => { setDetailWs(ws); setMenuId(null); }} />
                      <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Edit"
                        onClick={() => { setEditWs(ws); setMenuId(null); }} />
                      {!ws.billing_plan && (
                        <MenuItem icon={<CreditCard className="w-3.5 h-3.5" />} label="Assign Plan"
                          onClick={() => { setAssignPlanWs(ws); setMenuId(null); }} className="text-[color:var(--primary)]" />
                      )}
                      {ws.is_active
                        ? <MenuItem icon={<ShieldOff className="w-3.5 h-3.5" />} label="Suspend"
                            onClick={() => setStatus(ws, "suspended")} className="text-amber-500" />
                        : <MenuItem icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Activate"
                            onClick={() => setStatus(ws, "active")} className="text-green-500" />
                      }
                      <div className="border-t border-[color:var(--border)] my-1" />
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

      {/* ── Assign Plan modal ────────────────────────────────────────────── */}
      {assignPlanWs && (
        <AssignPlanModal
          ws={assignPlanWs}
          axiosSuper={axiosSuper}
          onClose={() => setAssignPlanWs(null)}
          onSaved={() => { setAssignPlanWs(null); load(); }}
        />
      )}

      {/* Close menu on outside click */}
      {menuId && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
      )}
    </div>
  );
}

// ─── Assign Plan Modal ────────────────────────────────────────────────────────
function AssignPlanModal({ ws, axiosSuper, onClose, onSaved }) {
  const [plans, setPlans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState("");
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    axiosSuper.get("/superadmin/plans")
      .then(r => {
        const active = (r.data || []).filter(p => p.is_active !== false);
        setPlans(active);
        if (active.length > 0) setSelected(active[0].slug);
      })
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await axiosSuper.put(`/superadmin/workspaces/${ws.id}`, { plan: selected });
      toast.success(`Plan "${selected}" assigned to ${ws.name}`);
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to assign plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--surface)] rounded-xl border border-[color:var(--border)] w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[color:var(--border)]">
          <div>
            <h2 className="font-semibold text-[color:var(--text)] text-sm">Assign Plan</h2>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{ws.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-[color:var(--text-muted)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-[color:var(--text-muted)] text-sm">Loading plans…</div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)] text-center py-4">No active plans found. Create a plan first.</p>
          ) : (
            <>
              <div className="space-y-2">
                {plans.map(plan => (
                  <label
                    key={plan.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected === plan.slug
                        ? "border-[color:var(--primary)] bg-[var(--surface-soft)]"
                        : "border-[color:var(--border)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={plan.slug}
                      checked={selected === plan.slug}
                      onChange={() => setSelected(plan.slug)}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text)]">{plan.name}</p>
                      {plan.tagline && <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{plan.tagline}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-[color:var(--text-muted)]">
                        <span>₹{((plan.price_monthly_paise || 0) / 100).toLocaleString("en-IN")}/mo</span>
                        {plan.member_limit && <span>· {plan.member_limit} members</span>}
                        {Array.isArray(plan.features) && (
                          <span>· {plan.features.length} features</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="border border-[color:var(--border)] rounded-lg px-3 py-2 text-xs text-amber-500">
                This bypasses payment — the workspace gets plan access immediately without a subscription.
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-[color:var(--border)] text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selected || saving || loading || plans.length === 0}
            className="flex-1 py-2 rounded-lg bg-[color:var(--primary)] text-white text-sm font-medium hover:bg-[color:var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? "Assigning…" : "Assign Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Workspace Detail Modal ───────────────────────────────────────────────────
function WorkspaceDetailModal({ ws, onClose, axiosSuper }) {
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [action, setAction]           = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [editForm, setEditForm]       = useState({ username: "", email: "", role: "" });
  const [saving, setSaving]           = useState(false);

  const loadUsers = () => {
    axiosSuper.get(`/superadmin/workspaces/${ws.id}/users`)
      .then(r => setUsers(r.data || []))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, [ws.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openReset = (u) => { setAction({ type: "reset", user: u }); setNewPassword(""); };
  const openEdit  = (u) => { setAction({ type: "edit",  user: u }); setEditForm({ username: u.username, email: u.email, role: u.role }); };
  const closeAction = () => setAction(null);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6)
      return toast.error("Password must be at least 6 characters");
    setSaving(true);
    try {
      await axiosSuper.post(`/superadmin/workspaces/${ws.id}/reset-password`, {
        userId: action.user.id,
        newPassword,
      });
      toast.success(`Password reset for ${action.user.username}`);
      closeAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Reset failed");
    }
    setSaving(false);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await axiosSuper.put(
        `/superadmin/workspaces/${ws.id}/users/${action.user.id}`,
        editForm
      );
      setUsers(prev => prev.map(u => u.id === action.user.id ? { ...u, ...updated.data } : u));
      toast.success("User updated");
      closeAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Update failed");
    }
    setSaving(false);
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.username}" (${u.email})? This cannot be undone.`)) return;
    try {
      await axiosSuper.delete(`/superadmin/workspaces/${ws.id}/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success(`${u.username} deleted`);
      if (action?.user?.id === u.id) closeAction();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  };

  const ROLE_COLOR = {
    admin: "border border-[color:var(--border)] text-[color:var(--primary)]",
    owner: "border border-[color:var(--border)] text-[color:var(--text-muted)]",
    user:  "border border-[color:var(--border)] text-[color:var(--text-muted)]",
  };

  return (
    <Modal title={`${ws.name} — Users (${users.length}${(ws.max_members ?? ws.member_limit) > 0 ? ` / ${ws.max_members ?? ws.member_limit}` : ""})`} onClose={onClose}>
      {loading ? (
        <div className="py-8 text-center text-sm text-[color:var(--text-muted)]">Loading…</div>
      ) : users.length === 0 ? (
        <div className="py-8 text-center text-sm text-[color:var(--text-muted)]">No users in this workspace</div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[color:var(--border)] hover:bg-[var(--surface-soft)] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[color:var(--text)] truncate">{u.username}</p>
                <p className="text-xs text-[color:var(--text-muted)] truncate">{u.email}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${ROLE_COLOR[u.role] || ROLE_COLOR.user}`}>
                {u.role}
              </span>
              <button onClick={() => openEdit(u)}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-[color:var(--primary)] shrink-0"
                title="Edit user">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => openReset(u)}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-amber-500 shrink-0"
                title="Reset password">
                <KeyRound className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDeleteUser(u)}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-red-500 shrink-0"
                title="Delete user">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit user inline form */}
      {action?.type === "edit" && (
        <form onSubmit={handleEditUser} className="mt-4 p-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] space-y-2">
          <p className="text-xs font-semibold text-[color:var(--text)]">
            Edit <span className="text-[color:var(--primary)]">{action.user.username}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Username"
              className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
            <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
            <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
              className="col-span-2 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]">
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-3 py-2 bg-[color:var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[color:var(--primary-hover)] disabled:opacity-60 transition-colors">
              {saving ? "…" : "Save"}
            </button>
            <button type="button" onClick={closeAction}
              className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Password reset inline form */}
      {action?.type === "reset" && (
        <form onSubmit={handleResetPassword} className="mt-4 p-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] space-y-2">
          <p className="text-xs font-semibold text-[color:var(--text)]">
            Reset password for <span className="text-amber-500">{action.user.username}</span>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="flex-1 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-amber-500"
            />
            <button type="submit" disabled={saving}
              className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors">
              {saving ? "…" : "Reset"}
            </button>
            <button type="button" onClick={closeAction}
              className="px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
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
    name: "", plan: "trial",
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
              placeholder="Acme Corp"
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
          </Field>
          <Field label="Plan" className="col-span-2">
            <select value={form.plan} onChange={e => set("plan", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]">
              <option value="trial">Free Trial (7 days — all features)</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            {form.plan === "trial" && (
              <p className="mt-1.5 text-xs text-amber-500 border border-[color:var(--border)] rounded-lg px-3 py-2">
                One free trial per email domain. If this domain already used a trial, creation will fail.
              </p>
            )}
          </Field>
          <Field label="Admin Email" className="col-span-2">
            <input type="email" value={form.ownerEmail}
              onChange={e => set("ownerEmail", e.target.value)}
              placeholder="admin@company.com"
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
          </Field>
          <Field label="Admin Password" className="col-span-2">
            <input type="password" value={form.ownerPassword}
              onChange={e => set("ownerPassword", e.target.value)}
              placeholder="Temporary password"
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
          </Field>
          <Field label="Admin Name (optional)" className="col-span-2">
            <input value={form.ownerName} onChange={e => set("ownerName", e.target.value)}
              placeholder="John Smith"
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-[color:var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[color:var(--primary-hover)] disabled:opacity-60 transition-colors">
            {saving ? "Creating…" : "Create Workspace"}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
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
            <input value={form.name} onChange={e => set("name", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]" />
          </Field>
          <Field label="Plan" className="col-span-2">
            <select value={form.plan} onChange={e => set("plan", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)]">
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-[color:var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[color:var(--primary-hover)] disabled:opacity-60 transition-colors">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--surface)] rounded-xl border border-[color:var(--border)] w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
          <h3 className="font-semibold text-[color:var(--text)]">{title}</h3>
          <button onClick={onClose} className="text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">
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
      <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}

function MenuItem({ icon, label, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--surface-soft)] transition-colors text-[color:var(--text)] ${className}`}
    >
      {icon} {label}
    </button>
  );
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    primary: "text-[color:var(--primary)]",
    success: "text-green-500",
    warn:    "text-amber-500",
    muted:   "text-[color:var(--text-muted)]",
  };
  return (
    <div className="rounded-lg border border-[color:var(--border)] px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg border border-[color:var(--border)] ${colors[color] ?? colors.muted}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold text-[color:var(--text)]">{value}</p>
        <p className="text-xs text-[color:var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}
