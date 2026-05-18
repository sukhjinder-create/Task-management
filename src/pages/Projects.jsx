import { useEffect, useState, useMemo } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban, Plus, Edit2, Trash2, Users as UsersIcon,
  GitBranch, ChevronRight, Search, AlertTriangle, ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { Modal, Input, Button, EmptyState, Skeleton } from "../components/ui";
import GitAutomationModal from "../components/GitAutomationModal";

export default function Projects() {
  const api = useApi();
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.added_by?.toLowerCase().includes(q)
    );
  }, [projects, query]);

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
    <div className="flex flex-col gap-5 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Workspace
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            Projects
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            {loading
              ? "Loading…"
              : `${projects.length} active ${projects.length === 1 ? "project" : "projects"} across the workspace.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {auth.user.role === "admin" && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<UsersIcon className="w-4 h-4" />}
              onClick={() => navigate("/admin/users")}
            >
              Admin
            </Button>
          )}
          {canManageProjects && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              New project
            </Button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[420px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-soft)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)] transition-[border-color,box-shadow] duration-150"
          />
        </div>
        <div className="text-[11px] text-[color:var(--text-soft)]">
          {filtered.length} of {projects.length}
        </div>
      </div>

      {/* Notice rows */}
      {!canManageProjects && !loading && (
        <div className="flex items-start gap-2.5 px-3 py-2 rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)]">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[color:var(--score-warning)]" />
          <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
            View-only access. Contact an admin or manager to create or modify projects.
          </p>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 px-3 py-2 rounded-[8px] border border-[color:var(--score-danger-border)] bg-[color:var(--score-danger-bg)]">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[color:var(--score-danger)]" />
          <p className="text-xs text-[color:var(--score-danger)] leading-relaxed">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--surface)] border border-[color:var(--border)] rounded-[10px] p-4"
            >
              <Skeleton className="h-3 w-1/3 mb-3" />
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="w-5 h-5" />}
          title="No projects yet"
          description={
            canManageProjects
              ? "Spin up your first project to start tracking work and assigning tasks."
              : "Projects created in this workspace will appear here."
          }
          action={
            canManageProjects && (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowCreateModal(true)}
              >
                Create your first project
              </Button>
            )
          }
        />
      )}

      {/* No-results state */}
      {!loading && projects.length > 0 && filtered.length === 0 && (
        <EmptyState
          compact
          icon={<Search className="w-5 h-5" />}
          title="No matching projects"
          description={`Nothing matches "${query}". Try a different search.`}
        />
      )}

      {/* Project grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <article
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="group cursor-pointer bg-[var(--surface)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)] rounded-[10px] transition-colors overflow-hidden"
            >
              <div className="p-4 flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-[8px] bg-[var(--primary-soft)] flex items-center justify-center">
                  <FolderKanban className="w-4 h-4 text-[color:var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[color:var(--text)] truncate tracking-tight">
                      {p.name}
                    </p>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[color:var(--text-soft)] group-hover:text-[color:var(--primary)] transition-colors shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[color:var(--text-soft)]">
                    <span className="truncate">by {p.added_by || "—"}</span>
                    {p.created_at && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {(canManageProjects || auth.user.role === "admin") && (
                <div
                  className="flex border-t border-[color:var(--border)] bg-[var(--surface-soft)] divide-x divide-[color:var(--border)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canManageProjects && (
                    <button
                      onClick={() => { setSelectedProjectForGit(p); setShowGitModal(true); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[var(--surface-strong)] transition-colors"
                    >
                      <GitBranch className="w-3 h-3" />
                      Git
                    </button>
                  )}
                  {canManageProjects && (
                    <button
                      onClick={() => openEditModal(p)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[var(--surface-strong)] transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Rename
                    </button>
                  )}
                  {auth.user.role === "admin" && (
                    <button
                      onClick={() => openDeleteModal(p)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium text-[color:var(--score-danger)] hover:bg-[color:var(--score-danger-bg)] transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Modals */}
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
              <Modal.Title>Rename project</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Input
                label="Project name"
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
        <Modal isOpen={true} onClose={() => setShowDeleteModal(false)} size="sm">
          <Modal.Header>
            <Modal.Title>Delete project</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
              Delete{" "}
              <span className="text-[color:var(--text)] font-semibold">
                {deletingProject.name}
              </span>
              ? This action cannot be undone — all associated tasks will also be removed.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" onClick={() => setShowDeleteModal(false)} variant="secondary">
              Cancel
            </Button>
            <Button type="button" onClick={handleDeleteProject} variant="danger">
              Delete project
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {showCreateModal && (
        <Modal isOpen={true} onClose={() => !creating && setShowCreateModal(false)} size="sm">
          <form onSubmit={handleCreateProject}>
            <Modal.Header>
              <Modal.Title>Create new project</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Input
                label="Project name"
                type="text"
                placeholder="e.g. Platform Migration Q3"
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
              <Button
                type="submit"
                variant="primary"
                loading={creating}
                disabled={creating}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create project
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
