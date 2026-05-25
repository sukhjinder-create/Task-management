// src/pages/UsersAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import Select from "react-select";
import { Users, Plus, Edit2, Trash2, Bot, X, KeyRound } from "lucide-react";
import UserProfileLink from "../components/UserProfileLink";

const ROLES = ["admin", "manager", "user"];

export default function UsersAdmin() {
  const api = useApi();
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const currentUser = auth.user;
  const highlightedUserId = searchParams.get("user");

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiName, setAiName] = useState("AI Assistant");
  const [savingAISettings, setSavingAISettings] = useState(false);

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasksByProject, setTasksByProject] = useState({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);

  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "user" });
  const [selectedProjectsCreate, setSelectedProjectsCreate] = useState([]);
  const [selectedTasksCreate, setSelectedTasksCreate] = useState([]);

  const [editingUserId, setEditingUserId] = useState(null);
  const [editUser, setEditUser] = useState({ username: "", email: "", role: "user" });
  const [selectedProjectsEdit, setSelectedProjectsEdit] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [resetUserId, setResetUserId]     = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting]         = useState(false);

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6 text-sm text-[color:var(--text-muted)] border border-[color:var(--border)] rounded-lg m-4">
        Only admin can manage users.
      </div>
    );
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [usersRes, projectsRes] = await Promise.all([api.get("/users"), api.get("/projects")]);
        const aiRes = await api.get("/workspaces/ai-settings");
        setAiEnabled(!!aiRes.data?.ai_enabled);
        setAiName(aiRes.data?.ai_name || "AI Assistant");
        setUsers((usersRes.data || []).filter(
          (u) => u.role !== "system" && !u.is_system && !u.username?.startsWith("AI_System_")
        ));
        setProjects(projectsRes.data || []);
        const tasksMap = {};
        for (const p of projectsRes.data || []) {
          try {
            const res = await api.get(`/tasks/${p.id}`);
            tasksMap[p.id] = res.data || [];
          } catch {}
        }
        setTasksByProject(tasksMap);
      } catch (err) {
        toast.error(err.response?.data?.error || "Failed to load users and projects");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api]);

  useEffect(() => {
    if (!highlightedUserId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`admin-user-${highlightedUserId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightedUserId, users]);

  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  const tasksForProjectsCreate = useMemo(() => {
    const list = [];
    for (const projectId of selectedProjectsCreate) {
      const project = projects.find((p) => p.id === projectId);
      for (const t of tasksByProject[projectId] || []) {
        list.push({ ...t, project_name: project?.name || "Unknown" });
      }
    }
    return list;
  }, [selectedProjectsCreate, tasksByProject, projects]);

  const taskOptionsCreate = useMemo(
    () => tasksForProjectsCreate.map((t) => ({ value: t.id, label: `[${t.project_name}] ${t.task}` })),
    [tasksForProjectsCreate]
  );

  const handleCreateProjectsChange = (selected) => {
    const ids = (selected || []).map((opt) => opt.value);
    setSelectedProjectsCreate(ids);
    setSelectedTasksCreate((prev) => {
      const allowed = new Set();
      ids.forEach((pid) => (tasksByProject[pid] || []).forEach((t) => allowed.add(t.id)));
      return prev.filter((id) => allowed.has(id));
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim()) { toast.error("Username is required"); return; }
    if (!newUser.email.trim()) { toast.error("Email is required"); return; }
    if (!newUser.password.trim()) { toast.error("Password is required"); return; }
    setCreating(true);
    try {
      const res = await api.post("/users", { ...newUser, username: newUser.username.trim(), email: newUser.email.trim(), projects: selectedProjectsCreate });
      const created = res.data;
      for (const taskId of selectedTasksCreate) {
        try { await api.put(`/tasks/${taskId}`, { assigned_to: created.id }); } catch {}
      }
      setUsers((prev) => [created, ...prev]);
      setNewUser({ username: "", email: "", password: "", role: "user" });
      setSelectedProjectsCreate([]);
      setSelectedTasksCreate([]);
      setShowCreateForm(false);
      toast.success("User created");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const startEditUser = (user) => {
    setEditingUserId(user.id);
    setEditUser({ username: user.username || "", email: user.email || "", role: user.role || "user" });
    setSelectedProjectsEdit(Array.isArray(user.projects) ? user.projects : []);
    setIsEditModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditUser({ username: "", email: "", role: "user" });
    setSelectedProjectsEdit([]);
    setIsEditModalOpen(false);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUserId) return;
    if (!editUser.username.trim()) { toast.error("Username is required"); return; }
    if (!editUser.email.trim()) { toast.error("Email is required"); return; }
    setUpdating(true);
    try {
      const res = await api.put(`/users/${editingUserId}`, {
        username: editUser.username.trim(), email: editUser.email.trim(), role: editUser.role, projects: selectedProjectsEdit,
      });
      setUsers((prev) => prev.map((u) => (u.id === editingUserId ? res.data : u)));
      toast.success("User updated");
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update user");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    setDeletingId(userId);
    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted");
      if (editingUserId === userId) cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPassword || resetPassword.length < 6) return toast.error("Min 6 characters");
    setResetting(true);
    try {
      await api.post(`/users/${resetUserId}/reset-password`, { newPassword: resetPassword });
      toast.success("Password reset successfully");
      setResetUserId(null);
      setResetPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to reset password");
    }
    setResetting(false);
  };

  const selectedProjectOptionsCreate = projectOptions.filter((o) => selectedProjectsCreate.includes(o.value));
  const selectedTaskOptionsCreate = taskOptionsCreate.filter((o) => selectedTasksCreate.includes(o.value));
  const selectedProjectOptionsEdit = projectOptions.filter((o) => selectedProjectsEdit.includes(o.value));

  const inputClass =
    "w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]";
  const selectClass =
    "w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]";

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-[color:var(--border)] shrink-0">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Admin</p>
            <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
              Users
              {!loading && (
                <span className="ml-2 text-sm font-normal text-[color:var(--text-muted)]">
                  {users.length} {users.length === 1 ? "member" : "members"}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAISettings((v) => !v)}
              className={`p-2.5 rounded-lg border transition-colors ${
                showAISettings
                  ? "bg-[var(--primary)] text-[color:var(--primary-contrast)] border-[color:var(--primary)]"
                  : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)]"
              }`}
              title="AI Settings"
            >
              <Bot className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)] text-[color:var(--primary-contrast)] text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New User</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* AI Settings Inline Panel */}
        {showAISettings && (
          <div className="mt-3 p-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] space-y-3">
            <p className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide">Workspace AI Settings</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[color:var(--text)]">Enable AI in workspace</span>
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">AI Display Name</label>
              <input
                type="text"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Project AI"
              />
            </div>
            <button
              disabled={savingAISettings}
              onClick={async () => {
                try {
                  setSavingAISettings(true);
                  await api.put("/workspaces/ai-settings", {
                    ai_enabled: aiEnabled,
                    ai_name: aiName,
                  });
                  toast.success("AI settings updated");
                } catch {
                  toast.error("Failed to update AI settings");
                } finally {
                  setSavingAISettings(false);
                }
              }}
              className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-[color:var(--primary-contrast)] text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {savingAISettings ? "Saving…" : "Save AI Settings"}
            </button>
          </div>
        )}
      </header>

      {/* Create User Form — collapsible */}
      {showCreateForm && (
        <div className="mx-4 mt-4 p-4 border border-[color:var(--border)] rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[color:var(--text)]">Create New User</p>
            <button onClick={() => setShowCreateForm(false)} className="p-1 text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">Username</label>
              <input type="text" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                className={inputClass} placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">Email</label>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                className={inputClass} placeholder="Enter email" />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">Password</label>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                className={inputClass} placeholder="Set a password" />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                className={selectClass}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">Projects</label>
              <Select isMulti options={projectOptions} value={selectedProjectOptionsCreate}
                onChange={handleCreateProjectsChange} className="text-xs" classNamePrefix="react-select"
                placeholder="Select projects…" noOptionsMessage={() => "No projects"} />
            </div>
            {selectedProjectsCreate.length > 0 && (
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Tasks (optional)</label>
                <Select isMulti options={taskOptionsCreate} value={selectedTaskOptionsCreate}
                  onChange={(sel) => setSelectedTasksCreate((sel || []).map((o) => o.value))}
                  className="text-xs" classNamePrefix="react-select" placeholder="Select tasks…" />
              </div>
            )}
            <button type="submit" disabled={creating}
              className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-[color:var(--primary-contrast)] text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors">
              {creating ? "Creating…" : "Create User"}
            </button>
          </form>
        </div>
      )}

      {/* User list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg border border-[color:var(--border)] animate-pulse bg-[var(--surface-soft)]" />
            ))}
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-5 rounded-full border border-[color:var(--border)]">
              <Users className="w-10 h-10 text-[color:var(--text-muted)]" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[color:var(--text)] mb-1">No users yet</p>
              <p className="text-sm text-[color:var(--text-muted)]">Tap "New" to create the first user</p>
            </div>
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="flex flex-col gap-3">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                highlighted={String(highlightedUserId || "") === String(u.id)}
                deletingId={deletingId}
                onEdit={() => startEditUser(u)}
                onDelete={() => handleDeleteUser(u.id)}
                onResetPassword={() => { setResetUserId(u.id); setResetPassword(""); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
          <div className="flex-1" onClick={() => setResetUserId(null)} />
          <div className="bg-[var(--surface)] border-t border-[color:var(--border)] rounded-t-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[color:var(--border)]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-[color:var(--text)]">Reset Password</p>
              </div>
              <button onClick={() => setResetUserId(null)} className="p-2 rounded-full text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">New Password</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]"
                />
              </div>
              <div className="flex gap-3 pb-4">
                <button type="button" onClick={() => setResetUserId(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[color:var(--border)] text-[color:var(--text)] text-sm font-semibold hover:bg-[var(--surface-soft)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={resetting}
                  className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  {resetting ? "Resetting…" : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUserId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
          <div className="flex-1" onClick={cancelEdit} />
          <div className="bg-[var(--surface)] border-t border-[color:var(--border)] rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[color:var(--border)]">
              <p className="font-semibold text-[color:var(--text)]">Edit User</p>
              <button onClick={cancelEdit} className="p-2 rounded-full text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Username</label>
                <input type="text" name="username" value={editUser.username}
                  onChange={(e) => setEditUser((p) => ({ ...p, username: e.target.value }))}
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]" />
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Email</label>
                <input type="email" name="email" value={editUser.email}
                  onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))}
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]" />
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Role</label>
                <select name="role" value={editUser.role}
                  onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))}
                  className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[color:var(--text-muted)] mb-1">Projects</label>
                <Select isMulti options={projectOptions} value={selectedProjectOptionsEdit}
                  onChange={(sel) => setSelectedProjectsEdit((sel || []).map((o) => o.value))}
                  className="text-xs" classNamePrefix="react-select" placeholder="Select projects…" />
              </div>
              <div className="flex gap-3 pt-2 pb-4">
                <button type="button" onClick={cancelEdit}
                  className="flex-1 py-2.5 rounded-lg border border-[color:var(--border)] text-[color:var(--text)] text-sm font-semibold hover:bg-[var(--surface-soft)] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updating}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-[color:var(--primary-contrast)] text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors">
                  {updating ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UserCard({ user, highlighted = false, deletingId, onEdit, onDelete, onResetPassword }) {
  const initials = (user.username || "?").slice(0, 2).toUpperCase();

  return (
    <div
      id={`admin-user-${user.id}`}
      className={`border rounded-lg overflow-hidden transition-colors ${
        highlighted
          ? "border-[color:var(--primary)] ring-1 ring-[color:var(--primary)]"
          : "border-[color:var(--border)]"
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        <UserProfileLink
          userId={user.id}
          username={user.username}
          className="shrink-0 w-10 h-10 rounded-full bg-[var(--surface-strong)] border border-[color:var(--border)] text-xs font-semibold text-[color:var(--text-muted)] flex items-center justify-center"
        >
          <span>{initials}</span>
        </UserProfileLink>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <UserProfileLink userId={user.id} username={user.username} className="font-semibold text-[color:var(--text)] truncate">
              <p className="font-semibold text-[color:var(--text)] truncate">{user.username}</p>
            </UserProfileLink>
            <span className="border border-[color:var(--border)] rounded-full px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text-soft)] shrink-0">
              {user.role}
            </span>
          </div>
          <p className="text-xs text-[color:var(--text-muted)] truncate">{user.email}</p>
          {Array.isArray(user.projects) && user.projects.length > 0 && (
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{user.projects.length} project{user.projects.length === 1 ? "" : "s"}</p>
          )}
        </div>
      </div>
      <div className="flex items-center border-t border-[color:var(--border)] px-3 py-2 gap-1">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] transition-colors text-xs">
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
        <button onClick={onResetPassword}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-amber-500 hover:bg-[var(--surface-soft)] transition-colors text-xs">
          <KeyRound className="w-3.5 h-3.5" />
          <span>Password</span>
        </button>
        <button onClick={onDelete} disabled={deletingId === user.id}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-red-500 hover:bg-[var(--surface-soft)] transition-colors text-xs disabled:opacity-40">
          <Trash2 className="w-3.5 h-3.5" />
          <span>{deletingId === user.id ? "Deleting…" : "Delete"}</span>
        </button>
      </div>
    </div>
  );
}
