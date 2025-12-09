// src/pages/UsersAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import Select from "react-select";

const ROLES = ["admin", "manager", "user"];
const ENTRIES_OPTIONS = [10, 25, 50, 100];

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

  // pagination
  const [pageSize, setPageSize] = useState(10); // min 10, max 100
  const [currentPage, setCurrentPage] = useState(1);

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // keep currentPage in range when users or pageSize change
  useEffect(() => {
    const total = users.length;
    const totalPagesNow = total === 0 ? 1 : Math.ceil(total / pageSize);
    if (currentPage > totalPagesNow) {
      setCurrentPage(totalPagesNow);
    }
  }, [users, pageSize, currentPage]);

  // ---------- Helpers / options ----------

  const handleCreateFieldChange = (e) => {
    const { name, value } = e.target;
    setNewUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // All projects as react-select options
  const projectOptions = useMemo(
    () =>
      (projects || []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [projects]
  );

  // Tasks derived from selected projects (for create)
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

  // react-select options for tasks
  const taskOptionsCreate = useMemo(
    () =>
      tasksForProjectsCreate.map((t) => ({
        value: t.id,
        label: `[${t.project_name}] ${t.task}`,
      })),
    [tasksForProjectsCreate]
  );

  // When project multi-select changes in CREATE
  const handleCreateProjectsChange = (selected) => {
    const ids = (selected || []).map((opt) => opt.value);
    setSelectedProjectsCreate(ids);

    // prune selected tasks that are no longer under selected projects
    setSelectedTasksCreate((prevSelected) => {
      const allowedTaskIds = new Set();
      ids.forEach((pid) => {
        (tasksByProject[pid] || []).forEach((t) => allowedTaskIds.add(t.id));
      });
      return prevSelected.filter((taskId) => allowedTaskIds.has(taskId));
    });
  };

  const handleCreateTasksChange = (selected) => {
    const ids = (selected || []).map((opt) => opt.value);
    setSelectedTasksCreate(ids);
  };

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
    setIsEditModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditUser({
      username: "",
      email: "",
      role: "user",
    });
    setSelectedProjectsEdit([]);
    setIsEditModalOpen(false);
  };

  const handleEditFieldChange = (e) => {
    const { name, value } = e.target;
    setEditUser((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditProjectsChange = (selected) => {
    const ids = (selected || []).map((opt) => opt.value);
    setSelectedProjectsEdit(ids);
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

  // ---------- Pagination derived values ----------

  const totalUsers = users.length;
  const totalPages = totalUsers === 0 ? 1 : Math.ceil(totalUsers / pageSize);

  const paginatedUsers = useMemo(() => {
    if (totalUsers === 0) return [];
    const start = (currentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, currentPage, pageSize, totalUsers]);

  const showingFrom =
    totalUsers === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo =
    totalUsers === 0 ? 0 : Math.min(currentPage * pageSize, totalUsers);

  const handlePageSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) return;
    const clamped = Math.min(100, Math.max(10, value));
    setPageSize(clamped);
    setCurrentPage(1);
  };

  // ---------- RENDER ----------

  // Values for react-select (create)
  const selectedProjectOptionsCreate = projectOptions.filter((opt) =>
    selectedProjectsCreate.includes(opt.value)
  );
  const selectedTaskOptionsCreate = taskOptionsCreate.filter((opt) =>
    selectedTasksCreate.includes(opt.value)
  );

  // Values for react-select (edit)
  const selectedProjectOptionsEdit = projectOptions.filter((opt) =>
    selectedProjectsEdit.includes(opt.value)
  );

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

      {/* Create section */}
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
              {/* Projects multi-select (dropdown) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs">
                    Projects (multi-select)
                  </label>
                </div>
                <Select
                  isMulti
                  options={projectOptions}
                  value={selectedProjectOptionsCreate}
                  onChange={handleCreateProjectsChange}
                  className="text-xs"
                  classNamePrefix="react-select"
                  placeholder="Select projects..."
                  noOptionsMessage={() => "No projects available"}
                />
              </div>

              {/* Tasks multi-select (dropdown) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs">
                    Tasks (optional, from selected projects)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    You can assign tasks now or later.
                  </span>
                </div>
                <Select
                  isMulti
                  options={taskOptionsCreate}
                  value={selectedTaskOptionsCreate}
                  onChange={handleCreateTasksChange}
                  className="text-xs"
                  classNamePrefix="react-select"
                  placeholder={
                    selectedProjectsCreate.length === 0
                      ? "Select project(s) first"
                      : "Select tasks..."
                  }
                  noOptionsMessage={() =>
                    selectedProjectsCreate.length === 0
                      ? "Select at least one project"
                      : "No tasks found for selected projects"
                  }
                  isDisabled={selectedProjectsCreate.length === 0}
                />
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
      </section>

      {/* Users list */}
      <section className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Existing Users</h2>
          <div className="flex items-center gap-2 text-xs">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border rounded px-2 py-1 text-xs"
            >
              {ENTRIES_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading users...</div>
        ) : totalUsers === 0 ? (
          <div className="text-sm text-slate-500">No users yet.</div>
        ) : (
          <>
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
                  {paginatedUsers.map((u) => (
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

            {/* Pagination footer */}
            <div className="flex items-center justify-between mt-3 text-xs">
              <span className="text-slate-500">
                Showing {showingFrom} to {showingTo} of {totalUsers} entries
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 border rounded disabled:opacity-40"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  « First
                </button>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-40"
                  onClick={() =>
                    setCurrentPage((p) => (p > 1 ? p - 1 : p))
                  }
                  disabled={currentPage === 1}
                >
                  ‹ Prev
                </button>
                <span className="px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-40"
                  onClick={() =>
                    setCurrentPage((p) =>
                      p < totalPages ? p + 1 : p
                    )
                  }
                  disabled={currentPage === totalPages}
                >
                  Next ›
                </button>
                <button
                  className="px-2 py-1 border rounded disabled:opacity-40"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last »
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* EDIT USER MODAL */}
      {isEditModalOpen && editingUserId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">
                Edit User ({editUser.username || editingUserId})
              </h2>
              <button
                className="text-xs px-2 py-1 rounded border"
                onClick={cancelEdit}
              >
                ✕
              </button>
            </div>

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
                  <Select
                    isMulti
                    options={projectOptions}
                    value={selectedProjectOptionsEdit}
                    onChange={handleEditProjectsChange}
                    className="text-xs"
                    classNamePrefix="react-select"
                    placeholder="Select projects..."
                    noOptionsMessage={() => "No projects available"}
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex justify-between gap-2 mt-2">
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
        </div>
      )}
    </div>
  );
}
