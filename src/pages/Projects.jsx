import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Edit2, Trash2, Users as UsersIcon, GitBranch, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { Modal, Input, Button } from "../components/ui";
import GitAutomationModal from "../components/GitAutomationModal";

export default function Projects() {
  const api = useApi();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newProject, setNewProject] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showGitModal, setShowGitModal] = useState(false);
  const [selectedProjectForGit, setSelectedProjectForGit] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(null);

  const canManageProjects =
    auth.user.role === "admin" || auth.user.role === "manager";

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await api.get("/projects");
        setProjects(res.data || []);
      } catch (err) {
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
    if (!newProject.trim()) { toast.error("Project name is required"); return; }
    setCreating(true);
    try {
      const res = await api.post("/projects", { name: newProject, added_by: auth.user.username });
      setProjects((prev) => [res.data, ...prev]);
      setNewProject("");
      setShowCreateModal(false);
      toast.success("Project created");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (project) => {
    setEditingProject(project);
    setEditName(project.name);
    setShowEditModal(true);
  };

  const handleRenameProject = async (e) => {
    e.preventDefault();
    if (!editName.trim()) { toast.error("Project name is required"); return; }
    setRenaming(true);
    try {
      const res = await api.put(`/projects/${editingProject.id}`, { name: editName.trim() });
      setProjects((prev) => prev.map((p) => (p.id === editingProject.id ? res.data : p)));
      setShowEditModal(false);
      toast.success("Project renamed");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to rename project");
    } finally {
      setRenaming(false);
    }
  };

  const openDeleteModal = (project) => {
    setDeletingProject(project);
    setShowDeleteModal(true);
  };

  const handleDeleteProject = async () => {
    try {
      await api.delete(`/projects/${deletingProject.id}`);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      setShowDeleteModal(false);
      toast.success("Project deleted");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete project");
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 theme-surface border-b theme-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-50 rounded-lg">
              <FolderKanban className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold theme-text leading-tight">Projects</h1>
              <p className="text-xs theme-text-muted">
                {loading ? "Loading…" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {auth.user.role === "admin" && (
              <button
                onClick={() => navigate("/admin/users")}
                className="p-2.5 rounded-xl theme-surface border theme-border theme-text active:opacity-70 transition-opacity"
                title="Admin panel"
              >
                <UsersIcon className="w-4 h-4" />
              </button>
            )}
            {canManageProjects && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold active:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Project</span>
                <span className="sm:hidden">New</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Permission notice ──────────────────────────────────────────────── */}
      {!canManageProjects && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200">
          <p className="text-xs text-yellow-700">
            View-only — contact an admin or manager to make changes.
          </p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl theme-surface border theme-border animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-5 rounded-full bg-[var(--surface-soft)]">
              <FolderKanban className="w-10 h-10 theme-text-muted" />
            </div>
            <div className="text-center">
              <p className="font-semibold theme-text mb-1">No projects yet</p>
              <p className="text-sm theme-text-muted">
                {canManageProjects
                  ? 'Tap "New" to create your first project'
                  : "Projects will appear here once created"}
              </p>
            </div>
            {canManageProjects && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold active:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Project
              </button>
            )}
          </div>
        )}

        {/* Project list */}
        {!loading && projects.length > 0 && (
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="theme-surface border theme-border rounded-2xl overflow-hidden active:opacity-80 transition-opacity cursor-pointer"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="flex items-center gap-3 p-4">
                  {/* Icon */}
                  <div className="shrink-0 p-2.5 rounded-xl bg-primary-50">
                    <FolderKanban className="w-5 h-5 text-primary-600" />
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold theme-text truncate">{p.name}</p>
                    <p className="text-xs theme-text-muted mt-0.5">
                      {p.added_by}
                      {p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>

                  {/* Chevron (tap area) */}
                  <ChevronRight className="w-4 h-4 theme-text-muted shrink-0" />
                </div>

                {/* Action row — only shown when user can manage */}
                {(canManageProjects || auth.user.role === "admin") && (
                  <div
                    className="flex items-center border-t theme-border px-3 py-2 gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canManageProjects && (
                      <button
                        onClick={() => { setSelectedProjectForGit(p); setShowGitModal(true); }}
                        className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg theme-text-muted hover:bg-[var(--surface-soft)] active:bg-[var(--surface-soft)] transition-colors text-xs"
                        title="Git automation"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Git</span>
                      </button>
                    )}
                    {canManageProjects && (
                      <button
                        onClick={() => openEditModal(p)}
                        className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg theme-text-muted hover:bg-[var(--surface-soft)] active:bg-[var(--surface-soft)] transition-colors text-xs"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Rename</span>
                      </button>
                    )}
                    {auth.user.role === "admin" && (
                      <button
                        onClick={() => openDeleteModal(p)}
                        className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-red-500 hover:bg-red-50 active:bg-red-50 transition-colors text-xs"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {showGitModal && selectedProjectForGit && (
        <GitAutomationModal
          isOpen={showGitModal}
          onClose={() => { setShowGitModal(false); setSelectedProjectForGit(null); }}
          project={selectedProjectForGit}
          canManage={canManageProjects}
        />
      )}

      {showEditModal && editingProject && (
        <Modal isOpen={true} onClose={() => !renaming && setShowEditModal(false)}>
          <form onSubmit={handleRenameProject}>
            <Modal.Header>
              <Modal.Title>Rename Project</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Input
                label="Project Name"
                type="text"
                placeholder="Enter project name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                required
              />
            </Modal.Body>
            <Modal.Footer>
              <Button type="button" onClick={() => setShowEditModal(false)} variant="secondary" disabled={renaming}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={renaming} disabled={renaming}>
                Save
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}

      {showDeleteModal && deletingProject && (
        <Modal isOpen={true} onClose={() => setShowDeleteModal(false)}>
          <Modal.Header>
            <Modal.Title>Delete Project</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm theme-text">
              Delete <strong>{deletingProject.name}</strong>? This cannot be undone.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" onClick={() => setShowDeleteModal(false)} variant="secondary">
              Cancel
            </Button>
            <Button type="button" onClick={handleDeleteProject} variant="danger">
              Delete
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {showCreateModal && (
        <Modal isOpen={true} onClose={() => !creating && setShowCreateModal(false)}>
          <form onSubmit={handleCreateProject}>
            <Modal.Header>
              <Modal.Title>Create New Project</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Input
                label="Project Name"
                type="text"
                placeholder="Enter project name"
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                autoFocus
                required
              />
            </Modal.Body>
            <Modal.Footer>
              <Button type="button" onClick={() => setShowCreateModal(false)} variant="secondary" disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={creating} disabled={creating} className="gap-2">
                <Plus className="w-4 h-4" />
                Create
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
