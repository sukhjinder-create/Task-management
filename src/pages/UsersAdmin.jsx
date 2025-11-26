// src/pages/UsersAdmin.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function UsersAdmin() {
  const api = useApi();
  const { auth } = useAuth();

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    projects: [],
  });

  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (auth.user.role !== "admin") return;

    async function load() {
      setLoading(true);
      try {
        const [usersRes, projectsRes] = await Promise.all([
          api.get("/users"),
          api.get("/projects"),
        ]);
        setUsers(usersRes.data || []);
        setProjects(projectsRes.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load users/projects");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [auth.user.role]);

  if (auth.user.role !== "admin") {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <h1 className="text-lg font-semibold mb-2">Users</h1>
        <p className="text-sm text-slate-500">
          Only admin can manage users.
        </p>
      </div>
    );
  }

  const resetForm = () => {
    setForm({
      username: "",
      email: "",
      password: "",
      role: "user",
      projects: [],
    });
    setEditingId(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProjectsChange = (e) => {
    const options = Array.from(e.target.selectedOptions);
    const projectIds = options.map((o) => o.value);
    setForm((prev) => ({
      ...prev,
      projects: projectIds,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        // update (no password here)
        const res = await api.put(`/users/${editingId}`, {
          username: form.username,
          email: form.email,
          role: form.role,
          projects: form.projects,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === editingId ? res.data : u))
        );
        toast.success("User updated");
      } else {
        // create
        if (!form.password) {
          toast.error("Password is required for new user");
          setSaving(false);
          return;
        }
        const res = await api.post("/users", {
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
          projects: form.projects,
        });
        setUsers((prev) => [res.data, ...prev]);
        toast.success("User created");
      }
      resetForm();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to save user";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      projects: user.projects || [],
    });
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("User deleted");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to delete user";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="bg-white rounded-xl shadow p-4">
        <h1 className="text-lg font-semibold mb-1">User Management</h1>
        <p className="text-xs text-slate-500">
          Only admin can create, update and delete users. Assign users to projects and roles.
        </p>
      </section>

      {/* FORM */}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">
          {editingId ? "Edit User" : "Create User"}
        </h2>
        <form className="grid md:grid-cols-3 gap-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs mb-1">Username</label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleFormChange}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleFormChange}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleFormChange}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {!editingId && (
            <div>
              <label className="block text-xs mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleFormChange}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-xs mb-1">Projects</label>
            <select
              multiple
              value={form.projects}
              onChange={handleProjectsChange}
              className="w-full border rounded-lg px-3 py-2 text-sm h-24"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Hold Ctrl (Windows) / Cmd (Mac) to select multiple projects.
            </p>
          </div>

          <div className="md:col-span-3 flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs border border-slate-300 rounded-lg px-3 py-1 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="text-xs bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update User"
                : "Create User"}
            </button>
          </div>
        </form>
      </section>

      {/* USERS TABLE */}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-semibold mb-3">Existing Users</h2>

        {loading && (
          <div className="text-sm text-slate-500">Loading users...</div>
        )}

        {!loading && users.length === 0 && (
          <div className="text-sm text-slate-500">
            No users created yet.
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Username</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Projects</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">{u.username}</td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2">
                      {(u.projects || []).length === 0
                        ? "-"
                        : (u.projects || []).length}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(u)}
                        className="text-[11px] border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-[11px] border border-red-300 text-red-600 rounded px-2 py-1 hover:bg-red-50"
                      >
                        Delete
                      </button>
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
