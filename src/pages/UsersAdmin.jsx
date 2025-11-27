// src/pages/UsersAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const ROLES = ["admin", "manager", "user"];

export default function UsersAdmin() {
  const api = useApi();
  const { auth } = useAuth();
  const currentUser = auth.user;

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasksByProject, setTasksByProject] = useState({}); // { projectId: [tasks...] }

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Create user form
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
  });
  const [selectedProjectsCreate, setSelectedProjectsCreate] = useState([]); // project IDs
  const [selectedTasksCreate, setSelectedTasksCreate] = useState([]); // task IDs

  // Edit user form
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUser, setEditUser] = useState({
    username: "",
    email: "",
    role: "user",
  });
  const [selectedProjectsEdit, setSelectedProjectsEdit] = useState([]); // project IDs

  if (currentUser?.role !== "admin") {
    return (
      <div className="bg-white rounded-xl shadow p-4 text-sm text-red-600">
        Only admin can manage users.
      </div>
    );
  }

  // Load users + projects + tasks
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [usersRes, projectsRes] = await Promise.all([
          api.get("/users"),
          api.get("/projects"),
        ]);

        setUsers(usersRes.data || []);
        setProjects(projectsRes.data || []);

        const tasksMap = {};
        for (const p of projectsRes.data || []) {
          try {
            const res = await api.get(`/tasks/${p.id}`);
            tasksMap[p.id] = res.data || [];
          } catch (err) {
            console.error("Failed to load tasks for project", p.id, err);
          }
        }
        setTasksByProject(tasksMap);
      } catch (err) {
        console.error("Failed to load users/projects", err);
        const msg =
          err.response?.data?.error || "Failed to load users and projects";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [api]);

  // ---------- Helpers for create ----------

  const handleCreateFieldChange = (e) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateProjectToggle = (projectId) => {
    setSelectedProjectsCreate((prev) => {
      if (prev.includes(projectId)) {
        // deselect project → also remove its tasks from selectedTasksCreate
        const newProjects = prev.filter((id) => id !== projectId);
        setSelectedTasksCreate((prevTasks) =>
          prevTasks.filter(
            (taskId) =>
              !(tasksByProject[projectId] || []).some((t) => t.id === taskId)
          )
        );
        return newProjects;
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleCreateTaskToggle = (taskId) => {
    setSelectedTasksCreate((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const tasksForProjectsCreate = useMemo(() => {
    const list = [];
    for (const projectId of selectedProjectsCreate) {
      const project = projects.find((p) => p.id === projectId);
      const tasks = tasksByProject[projectId] || [];
      for (const t of tasks) {
        list.push({
          ...t,
          project_name: project?.name || "Unknown project",
        });
      }
    }
    return list;
  }, [selectedProjectsCreate, tasksByProject, projects]);

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!newUser.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!newUser.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!newUser.password.trim()) {
      toast.error("Password is required");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
        projects: selectedProjectsCreate, // uuid[]
      };

      // 1. Create the user
      const res = await api.post("/users", payload);
      const createdUser = res.data;

      // 2. Assign selected tasks (optional)
      if (selectedTasksCreate.length > 0) {
        for (const taskId of selectedTasksCreate) {
          try {
            await api.put(`/tasks/${taskId}`, {
              assigned_to: createdUser.id,
            });
          } catch (err) {
            console.error("Failed to assign task", taskId, err);
          }
        }
      }

      setUsers((prev) => [createdUser, ...prev]);

      // reset create form
      setNewUser({
        username: "",
        email: "",
        password: "",
        role: "user",
      });
      setSelectedProjectsCreate([]);
      setSelectedTasksCreate([]);

      toast.success("User created successfully");
    } catch (err) {
      console.error("Create user error:", err);
      const msg = err.response?.data?.error || "Failed to create user";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // ---------- Helpers for edit ----------

  const startEditUser = (user) => {
    setEditingUserId(user.id);
    setEditUser({
      username: user.username || "",
      email: user.email || "",
      role: user.role || "user",
    });
    if (Array.isArray(user.projects)) {
      setSelectedProjectsEdit(user.projects);
    } else {
      setSelectedProjectsEdit([]);
    }
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditUser({
      username: "",
      email: "",
      role: "user",
    });
    setSelectedProjectsEdit([]);
  };

  const handleEditFieldChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditProjectToggle = (projectId) => {
    setSelectedProjectsEdit((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUserId) return;

    if (!editUser.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!editUser.email.trim()) {
      toast.error("Email is required");
      return;
    }

    setUpdating(true);
    try {
      const payload = {
        username: editUser.username.trim(),
        email: editUser.email.trim(),
        role: editUser.role,
        projects: selectedProjectsEdit, // uuid[]
      };

      const res = await api.put(`/users/${editingUserId}`, payload);
      const updated = res.data;

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUserId ? updated : u))
      );

      toast.success("User updated");
      cancelEdit();
    } catch (err) {
      console.error("Update user error:", err);
      const msg = err.response?.data?.error || "Failed to update user";
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  // ---------- Delete ----------

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    setDeletingId(userId);
    try {
      await api.delete(`/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted");
      if (editingUserId === userId) {
        cancelEdit();
      }
    } catch (err) {
      console.error("Delete user error:", err);
      const msg = err.response?.data?.error || "Failed to delete user";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // ---------- RENDER ----------

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">User Management</h1>
          <p className="text-xs text-slate-500">
            Admin can create, edit, delete users, assign projects and optionally
            tasks.
          </p>
        </div>
      </section>

      {/* Create + Edit section */}
      <section className="bg-white rounded-xl shadow p-4 space-y-6">
        {/* CREATE USER */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Create New User</h2>

          <form
            onSubmit={handleCreateUser}
            className="grid md:grid-cols-2 gap-4 text-sm"
          >
            <div className="space-y-2">
              <label className="block text-xs">Username</label>
              <input
                type="text"
                name="username"
                value={newUser.username}
                onChange={handleCreateFieldChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Enter username"
              />

              <label className="block text-xs mt-3">Email</label>
              <input
                type="email"
                name="email"
                value={newUser.email}
                onChange={handleCreateFieldChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Enter email"
              />

              <label className="block text-xs mt-3">Password</label>
              <input
                type="password"
                name="password"
                value={newUser.password}
                onChange={handleCreateFieldChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Set a password"
              />

              <label className="block text-xs mt-3">Role</label>
              <select
                name="role"
                value={newUser.role}
                onChange={handleCreateFieldChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {/* Projects multi-select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs">
                    Projects (multi-select)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Select one or more projects
                  </span>
                </div>
                <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto text-xs space-y-1">
                  {projects.length === 0 ? (
                    <div className="text-slate-400">
                      No projects available. Create a project first.
                    </div>
                  ) : (
                    projects.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProjectsCreate.includes(p.id)}
                          onChange={() => handleCreateProjectToggle(p.id)}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Tasks (optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs">
                    Tasks (optional, from selected projects)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    You can assign tasks now or later.
                  </span>
                </div>
                <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto text-xs space-y-1">
                  {selectedProjectsCreate.length === 0 ? (
                    <div className="text-slate-400">
                      Select at least one project to see its tasks.
                    </div>
                  ) : tasksForProjectsCreate.length === 0 ? (
                    <div className="text-slate-400">
                      No tasks found for selected projects.
                    </div>
                  ) : (
                    tasksForProjectsCreate.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTasksCreate.includes(t.id)}
                          onChange={() => handleCreateTaskToggle(t.id)}
                        />
                        <span>
                          [{t.project_name}] {t.task}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white text-xs rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>

        {/* EDIT USER */}
        {editingUserId && (
          <div className="border-t pt-4 mt-2">
            <h2 className="text-sm font-semibold mb-2">
              Edit User ({editUser.username || editingUserId})
            </h2>
            <form
              onSubmit={handleUpdateUser}
              className="grid md:grid-cols-2 gap-4 text-sm"
            >
              <div className="space-y-2">
                <label className="block text-xs">Username</label>
                <input
                  type="text"
                  name="username"
                  value={editUser.username}
                  onChange={handleEditFieldChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                <label className="block text-xs mt-3">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editUser.email}
                  onChange={handleEditFieldChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                <label className="block text-xs mt-3">Role</label>
                <select
                  name="role"
                  value={editUser.role}
                  onChange={handleEditFieldChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs">
                      Projects (multi-select)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Adjust assigned projects
                    </span>
                  </div>
                  <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto text-xs space-y-1">
                    {projects.length === 0 ? (
                      <div className="text-slate-400">No projects.</div>
                    ) : (
                      projects.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProjectsEdit.includes(p.id)}
                            onChange={() => handleEditProjectToggle(p.id)}
                          />
                          <span>{p.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs border rounded-lg px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-emerald-600 text-white text-xs rounded-lg px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Update User"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Users list */}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">Existing Users</h2>

        {loading ? (
          <div className="text-sm text-slate-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-slate-500">No users yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Projects</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{u.username}</td>
                    <td className="py-2 pr-3">{u.email}</td>
                    <td className="py-2 pr-3 uppercase">{u.role}</td>
                    <td className="py-2 pr-3">
                      {Array.isArray(u.projects)
                        ? `${u.projects.length} project(s)`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <button
                          className="text-[11px] px-2 py-1 rounded border border-slate-300"
                          onClick={() => startEditUser(u)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-[11px] px-2 py-1 rounded border border-red-300 text-red-600"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingId === u.id}
                        >
                          {deletingId === u.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
