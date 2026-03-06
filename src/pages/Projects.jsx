import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Edit2, Trash2, Users as UsersIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Card, Button, Modal, Input, Badge } from "../components/ui";

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
    if (!newProject.trim()) {
      toast.error("Project name is required");
      return;
    }

    setCreating(true);
    try {
      const res = await api.post("/projects", {
        name: newProject,
        added_by: auth.user.username,
      });
      setProjects((prev) => [res.data, ...prev]);
      setNewProject("");
      setShowCreateModal(false);
      toast.success("Project created successfully");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.error ||
        "Failed to create project (maybe not admin/manager?)";
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
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
      {/* Header */}
      <Card>
        <Card.Content className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-50 rounded-lg">
                <FolderKanban className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage your projects and collaborate with your team
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge color="neutral" size="lg" variant="subtle">
                {totalProjects} {totalProjects === 1 ? "Project" : "Projects"}
              </Badge>
              {canManageProjects && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="primary"
                  size="md"
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
              )}
              {auth.user.role === "admin" && (
                <Button
                  onClick={() => navigate("/admin/users")}
                  variant="secondary"
                  size="md"
                  className="gap-2"
                >
                  <UsersIcon className="w-4 h-4" />
                  Admin Panel
                </Button>
              )}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Error message */}
      {error && (
        <Card className="border-danger-200 bg-danger-50">
          <Card.Content className="p-4">
            <p className="text-sm text-danger-700">{error}</p>
          </Card.Content>
        </Card>
      )}

      {/* No permission message */}
      {!canManageProjects && (
        <Card className="border-warning-200 bg-warning-50">
          <Card.Content className="p-4">
            <p className="text-sm text-warning-700">
              You don't have permission to create or manage projects. Contact an admin or manager if you need changes.
            </p>
          </Card.Content>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading projects...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <Card>
          <Card.Content className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-gray-50 rounded-full">
                <FolderKanban className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {canManageProjects
                    ? "Get started by creating your first project"
                    : "Projects will appear here once they are created"}
                </p>
                {canManageProjects && (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    variant="primary"
                    size="md"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Project
                  </Button>
                )}
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Projects Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <Card.Content className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <FolderKanban className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {canManageProjects && (
                      <Button
                        onClick={() => handleRenameProject(p)}
                        variant="ghost"
                        size="xs"
                        className="text-gray-600 hover:text-primary-600"
                        title="Rename project"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                    {auth.user.role === "admin" && (
                      <Button
                        onClick={() => handleDeleteProject(p)}
                        variant="ghost"
                        size="xs"
                        className="text-gray-600 hover:text-danger-600"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{p.name}</h3>
                <p className="text-xs text-gray-500">
                  Created by {p.added_by}
                </p>
                <p className="text-xs text-gray-400">
                  {p.created_at
                    ? new Date(p.created_at).toLocaleDateString()
                    : "No date"}
                </p>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
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
              <p className="text-xs text-gray-500 mt-2">
                Choose a descriptive name for your project
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                type="button"
                onClick={() => setShowCreateModal(false)}
                variant="secondary"
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={creating}
                disabled={creating}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Project
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
