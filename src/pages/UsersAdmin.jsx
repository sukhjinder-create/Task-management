// src/pages/UsersAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import Select from "react-select";
import { Users, Plus, Edit2, Trash2, Bot, ChevronDown, ChevronUp, X } from "lucide-react";

const ROLES = ["admin", "manager", "user"];

export default function UsersAdmin() {
  const api = useApi();
  const { auth } = useAuth();
  const currentUser = auth.user;

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiName, setAiName] = useState("");
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
  const [editUser, setEditUser] = useState({ username: "", email: "", role: "user", aiReplyEnabled: false });
  const [selectedProjectsEdit, setSelectedProjectsEdit] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6 text-sm text-red-600 theme-surface">Only admin can manage users.</div>
    );
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [usersRes, projectsRes] = await Promise.all([api.get("/users"), api.get("/projects")]);
        const aiRes = await api.get("/workspaces/ai-settings");
        setAiEnabled(!!aiRes.data?.aiEnabled);
        setAiName(aiRes.data?.aiName || "AI Assistant");
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

  const startEditUser = async (user) => {
    setEditingUserId(user.id);
    setEditUser({ username: user.username || "", email: user.email || "", role: user.role || "user", aiReplyEnabled: false });
    setSelectedProjectsEdit(Array.isArray(user.projects) ? user.projects : []);
    setIsEditModalOpen(true);
    try {
      const pref = await api.get(`/users/${user.id}/ai-preference`);
      setEditUser((prev) => ({ ...prev, aiReplyEnabled: pref.data?.aiReplyEnabled === true }));
    } catch {}
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditUser({ username: "", email: "", role: "user", aiReplyEnabled: false });
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
      await api.put(`/users/${editingUserId}/ai-preference`, { aiReplyEnabled: editUser.aiReplyEnabled === true });
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

  const selectedProjectOptionsCreate = projectOptions.filter((o) => selectedProjectsCreate.includes(o.value));
  const selectedTaskOptionsCreate = taskOptionsCreate.filter((o) => selectedTasksCreate.includes(o.value));
  const selectedProjectOptionsEdit = projectOptions.filter((o) => selectedProjectsEdit.includes(o.value));

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 theme-surface border-b theme-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold theme-text leading-tight">Admin Panel</h1>
              <p className="text-xs theme-text-muted">
                {loading ? "Loading…" : `${users.length} user${users.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAISettings((v) => !v)}
              className={`p-2.5 rounded-xl border theme-border transition-colors ${showAISettings ? "bg-indigo-600 text-white border-indigo-600" : "theme-surface theme-text"}`}
              title="AI Settings"
            >
              <Bot className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold active:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New User</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* AI Settings Inline Panel */}
        {showAISettings && (
          <div className="mt-3 p-3 rounded-xl border theme-border bg-indigo-50 space-y-3">
            <p className="text-xs font-semibold text-indigo-700">Workspace AI Settings</p>
            <div className="flex items-center justify-between">
              <span className="text-xs theme-text">Enable AI in workspace</span>
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="w-4 h-4" />
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">AI Display Name</label>
              <input
                type="text"
                value={aiName}
                onChange={(e) => setAiName(e.target.value)}
                className="w-full border theme-border rounded-lg px-3 py-2 text-sm theme-surface theme-text"
                placeholder="e.g. Project AI"
              />
            </div>
            <button
              disabled={savingAISettings}
              onClick={async () => {
                try {
                  setSavingAISettings(true);
                  await api.put("/workspaces/ai-settings", { aiEnabled, aiName });
                  toast.success("AI settings updated");
                } catch {
                  toast.error("Failed to update AI settings");
                } finally {
                  setSavingAISettings(false);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-700 disabled:opacity-50"
            >
              {savingAISettings ? "Saving…" : "Save AI Settings"}
            </button>
          </div>
        )}
      </div>

      {/* Create User Form — collapsible */}
      {showCreateForm && (
        <div className="mx-4 mt-4 p-4 theme-surface border theme-border rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold theme-text">Create New User</p>
            <button onClick={() => setShowCreateForm(false)} className="p-1 theme-text-muted active:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <label className="block text-xs theme-text-muted mb-1">Username</label>
              <input type="text" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text" placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Email</label>
              <input type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text" placeholder="Enter email" />
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Password</label>
              <input type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text" placeholder="Set a password" />
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Projects</label>
              <Select isMulti options={projectOptions} value={selectedProjectOptionsCreate}
                onChange={handleCreateProjectsChange} className="text-xs" classNamePrefix="react-select"
                placeholder="Select projects…" noOptionsMessage={() => "No projects"} />
            </div>
            {selectedProjectsCreate.length > 0 && (
              <div>
                <label className="block text-xs theme-text-muted mb-1">Tasks (optional)</label>
                <Select isMulti options={taskOptionsCreate} value={selectedTaskOptionsCreate}
                  onChange={(sel) => setSelectedTasksCreate((sel || []).map((o) => o.value))}
                  className="text-xs" classNamePrefix="react-select" placeholder="Select tasks…" />
              </div>
            )}
            <button type="submit" disabled={creating}
              className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold active:bg-primary-700 disabled:opacity-50">
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
              <div key={i} className="h-20 rounded-2xl theme-surface border theme-border animate-pulse" />
            ))}
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-5 rounded-full bg-[var(--surface-soft)]">
              <Users className="w-10 h-10 theme-text-muted" />
            </div>
            <div className="text-center">
              <p className="font-semibold theme-text mb-1">No users yet</p>
              <p className="text-sm theme-text-muted">Tap "New" to create the first user</p>
            </div>
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="flex flex-col gap-3">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                deletingId={deletingId}
                onEdit={() => startEditUser(u)}
                onDelete={() => handleDeleteUser(u.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && editingUserId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50">
          <div className="flex-1" onClick={cancelEdit} />
          <div className="theme-surface rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b theme-border">
              <p className="font-semibold theme-text">Edit User</p>
              <button onClick={cancelEdit} className="p-2 rounded-full theme-text-muted active:opacity-70">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Username</label>
                <input type="text" name="username" value={editUser.username}
                  onChange={(e) => setEditUser((p) => ({ ...p, username: e.target.value }))}
                  className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text" />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Email</label>
                <input type="email" name="email" value={editUser.email}
                  onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))}
                  className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text" />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Role</label>
                <select name="role" value={editUser.role}
                  onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))}
                  className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm theme-text">AI replies on behalf of user</span>
                <input type="checkbox" checked={editUser.aiReplyEnabled || false}
                  onChange={(e) => setEditUser((p) => ({ ...p, aiReplyEnabled: e.target.checked }))}
                  className="w-4 h-4" />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Projects</label>
                <Select isMulti options={projectOptions} value={selectedProjectOptionsEdit}
                  onChange={(sel) => setSelectedProjectsEdit((sel || []).map((o) => o.value))}
                  className="text-xs" classNamePrefix="react-select" placeholder="Select projects…" />
              </div>
              <div className="flex gap-3 pt-2 pb-4">
                <button type="button" onClick={cancelEdit}
                  className="flex-1 py-2.5 rounded-xl border theme-border theme-text text-sm font-semibold active:opacity-70">
                  Cancel
                </button>
                <button type="submit" disabled={updating}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700 disabled:opacity-50">
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

function UserCard({ user, deletingId, onEdit, onDelete }) {
  const roleColors = { admin: "bg-red-100 text-red-700", manager: "bg-blue-100 text-blue-700", user: "bg-slate-100 text-slate-600" };
  const initials = (user.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="theme-surface border theme-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
          <span className="text-primary-600 font-bold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold theme-text truncate">{user.username}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${roleColors[user.role] || roleColors.user}`}>
              {user.role}
            </span>
          </div>
          <p className="text-xs theme-text-muted truncate">{user.email}</p>
          {Array.isArray(user.projects) && user.projects.length > 0 && (
            <p className="text-xs theme-text-muted mt-0.5">{user.projects.length} project{user.projects.length === 1 ? "" : "s"}</p>
          )}
        </div>
      </div>
      <div className="flex items-center border-t theme-border px-3 py-2 gap-1" >
        <button onClick={onEdit}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg theme-text-muted hover:bg-[var(--surface-soft)] active:bg-[var(--surface-soft)] transition-colors text-xs">
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>
        <button onClick={onDelete} disabled={deletingId === user.id}
          className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-red-500 hover:bg-red-50 active:bg-red-50 transition-colors text-xs disabled:opacity-40">
          <Trash2 className="w-3.5 h-3.5" />
          <span>{deletingId === user.id ? "Deleting…" : "Delete"}</span>
        </button>
      </div>
    </div>
  );
}
