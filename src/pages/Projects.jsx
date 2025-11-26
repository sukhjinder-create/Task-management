import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function Projects() {
  const api = useApi();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newProject, setNewProject] = useState("");

  const canManageProjects =
    auth.user.role === "admin" || auth.user.role === "manager";

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await api.get("/projects");
        setProjects(res.data || []);
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.error || "Failed to load projects";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.trim()) return;

    try {
      const res = await api.post("/projects", {
        name: newProject,
        added_by: auth.user.username,
      });
      setProjects((prev) => [res.data, ...prev]);
      setNewProject("");
      toast.success("Project created");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.error ||
        "Failed to create project (maybe not admin/manager?)";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleRenameProject = async (project) => {
    const name = window.prompt("New project name:", project.name);
    if (!name || !name.trim()) return;

    try {
      const res = await api.put(`/projects/${project.id}`, { name: name.trim() });
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? res.data : p))
      );
      toast.success("Project renamed");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to rename project";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Delete project "${project.name}"?`)) return;
    try {
      await api.delete(`/projects/${project.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success("Project deleted");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to delete project";
      setError(msg);
      toast.error(msg);
    }
  };

  const totalProjects = projects.length;

  return (
    <div className="space-y-6">
      {/* Simple dashboard */}
      <section className="bg-white rounded-xl shadow p-4 flex gap-6 text-sm">
        <div>
          <div className="text-xs text-slate-500">Total projects</div>
          <div className="text-lg font-semibold">{totalProjects}</div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Projects</h2>
          {auth.user.role === "admin" && (
            <Link
              to="/admin/users"
              className="text-xs text-blue-600 border border-blue-300 rounded-lg px-3 py-1 hover:bg-blue-50"
            >
              Admin: Users
            </Link>
          )}
        </div>

        {/* CREATE PROJECT */}
        {canManageProjects ? (
          <form
            onSubmit={handleCreateProject}
            className="bg-white rounded-xl shadow p-4 mb-6 flex gap-2 items-center"
          >
            <input
              type="text"
              placeholder="New project name"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700"
            >
              Create
            </button>
          </form>
        ) : (
          <div className="mb-6 text-xs text-slate-500">
            You don&apos;t have permission to create or manage projects. Contact
            an admin or manager if you need changes.
          </div>
        )}

        {loading && <div>Loading projects...</div>}

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="text-sm text-slate-500">
            No projects yet. {canManageProjects && "Create one above."}
          </div>
        )}

        {/* PROJECTS GRID */}
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow p-4 border border-slate-100 flex flex-col justify-between"
            >
              <button
                onClick={() => navigate(`/projects/${p.id}`)}
                className="text-left flex-1"
              >
                <h3 className="font-semibold mb-1">{p.name}</h3>
                <p className="text-xs text-slate-500">
                  Added by {p.added_by} •{" "}
                  {p.created_at
                    ? new Date(p.created_at).toLocaleString()
                    : "No date"}
                </p>
              </button>
              <div className="mt-3 flex gap-2">
                {canManageProjects && (
                  <button
                    onClick={() => handleRenameProject(p)}
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 hover:bg-slate-50"
                  >
                    Rename
                  </button>
                )}
                {auth.user.role === "admin" && (
                  <button
                    onClick={() => handleDeleteProject(p)}
                    className="text-xs text-red-600 border border-red-300 rounded-lg px-2 py-1 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
