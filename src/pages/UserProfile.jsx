import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import toast from "react-hot-toast";
import { KeyRound, Mail, PencilLine, Shield, Trash2, User, Users } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/ui";
import { getUserProfilePath } from "../utils/userProfiles";

const ROLES = ["admin", "manager", "user"];

export default function UserProfile() {
  const api = useApi();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { userId } = useParams();

  const isSelf = String(userId || "") === String(auth.user?.id || "");
  const isAdmin = auth.user?.role === "admin";

  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", email: "", role: "user" });
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [updating, setUpdating] = useState(false);

  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const projectOptions = useMemo(
    () => (projects || []).map((project) => ({ value: project.id, label: project.name })),
    [projects]
  );

  const assignedProjectOptions = useMemo(
    () => projectOptions.filter((option) => selectedProjects.includes(option.value)),
    [projectOptions, selectedProjects]
  );

  const assignedProjectNames = useMemo(() => {
    const lookup = new Map((projects || []).map((project) => [String(project.id), project.name]));
    return (profile?.projects || []).map((projectId) => lookup.get(String(projectId)) || String(projectId));
  }, [profile?.projects, projects]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const [profileRes, projectsRes] = await Promise.all([
          api.get(`/users/${userId}`),
          api.get("/projects").catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const nextProfile = profileRes.data;
        setProfile(nextProfile);
        setProjects(projectsRes.data || []);
        setEditForm({
          username: nextProfile.username || "",
          email: nextProfile.email || "",
          role: nextProfile.role || "user",
        });
        setSelectedProjects(Array.isArray(nextProfile.projects) ? nextProfile.projects : []);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError?.response?.data?.error || "Failed to load user profile";
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (userId) {
      loadProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [api, userId]);

  if (!userId) {
    return <Navigate to="/profile" replace />;
  }

  if (isSelf) {
    return <Navigate to={getUserProfilePath(auth.user?.id, auth.user?.id) || "/profile"} replace />;
  }

  async function handleUpdateProfile(event) {
    event.preventDefault();

    if (!editForm.username.trim()) return toast.error("Username is required");
    if (!editForm.email.trim()) return toast.error("Email is required");

    setUpdating(true);
    try {
      const res = await api.put(`/users/${userId}`, {
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        projects: selectedProjects,
      });
      setProfile(res.data);
      setIsEditOpen(false);
      toast.success("User updated");
    } catch (updateError) {
      toast.error(updateError?.response?.data?.error || "Failed to update user");
    } finally {
      setUpdating(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (!resetPassword || resetPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setResetting(true);
    try {
      await api.post(`/users/${userId}/reset-password`, { newPassword: resetPassword });
      setResetPassword("");
      toast.success("Password reset successfully");
    } catch (resetError) {
      toast.error(resetError?.response?.data?.error || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteUser() {
    if (!window.confirm(`Delete "${profile?.username || "this user"}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/users/${userId}`);
      toast.success("User deleted");
      navigate("/admin/users", { replace: true });
    } catch (deleteError) {
      toast.error(deleteError?.response?.data?.error || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 theme-surface border-b theme-border shrink-0">
        <h1 className="text-lg font-bold theme-text">User Profile</h1>
        <p className="text-xs theme-text-muted mt-0.5">
          Workspace member details{isAdmin ? " with admin actions" : ""}.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="theme-surface border theme-border rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-[var(--surface-soft)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--surface-soft)] rounded w-1/3" />
                <div className="h-3 bg-[var(--surface-soft)] rounded w-1/2" />
              </div>
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : null}

        {!loading && profile ? (
          <>
            <div className="theme-surface border theme-border rounded-2xl p-5 flex flex-col items-center gap-3">
              <Avatar name={profile.username} src={profile.avatar_url} size="xl" />
              <div className="text-center">
                <p className="font-bold theme-text text-lg leading-tight">{profile.username}</p>
                {isAdmin ? <p className="text-sm theme-text-muted">{profile.email}</p> : null}
              </div>
              <span className="px-3 py-1.5 rounded-full bg-[var(--surface-soft)] border theme-border text-xs font-medium theme-text capitalize">
                {profile.role}
              </span>
            </div>

            <div className="theme-surface border theme-border rounded-2xl overflow-hidden divide-y theme-border">
              {[
                { icon: User, label: "Username", value: profile.username },
                { icon: Mail, label: "Email", value: isAdmin ? profile.email : "Visible to admins only" },
                { icon: Shield, label: "Role", value: profile.role },
                { icon: Users, label: "Workspace", value: profile.workspace_name || "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 theme-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] theme-text-muted font-medium uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold theme-text truncate">{value || "—"}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 theme-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] theme-text-muted font-medium uppercase tracking-wide">Projects</p>
                  {assignedProjectNames.length ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {assignedProjectNames.map((projectName) => (
                        <span key={projectName} className="px-2 py-1 rounded-full bg-[var(--surface-soft)] text-xs theme-text">
                          {projectName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold theme-text truncate">None assigned</p>
                  )}
                </div>
              </div>
            </div>

            {isAdmin ? (
              <div className="theme-surface border theme-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b theme-border">
                  <div>
                    <p className="text-sm font-semibold theme-text">Admin Actions</p>
                    <p className="text-xs theme-text-muted">Manage this user without going back to the admin panel.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border theme-border px-3 py-2 text-sm font-medium theme-text hover:bg-[var(--surface-soft)]"
                  >
                    <PencilLine className="w-4 h-4" />
                    {isEditOpen ? "Close Edit" : "Edit User"}
                  </button>
                </div>

                {isEditOpen ? (
                  <form onSubmit={handleUpdateProfile} className="px-4 py-4 space-y-4 border-b theme-border">
                    <div>
                      <label className="block text-xs theme-text-muted mb-1">Username</label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
                        className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs theme-text-muted mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                        className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs theme-text-muted mb-1">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
                        className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs theme-text-muted mb-1">Projects</label>
                      <Select
                        isMulti
                        options={projectOptions}
                        value={assignedProjectOptions}
                        onChange={(selected) => setSelectedProjects((selected || []).map((option) => option.value))}
                        className="text-xs"
                        classNamePrefix="react-select"
                        placeholder="Select projects..."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={updating}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {updating ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditOpen(false);
                          setEditForm({
                            username: profile.username || "",
                            email: profile.email || "",
                            role: profile.role || "user",
                          });
                          setSelectedProjects(Array.isArray(profile.projects) ? profile.projects : []);
                        }}
                        className="rounded-lg border theme-border px-4 py-2 text-sm font-semibold theme-text"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="px-4 py-4 space-y-4">
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-semibold theme-text">Reset Password</p>
                    </div>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="Enter a new password"
                      className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-surface theme-text"
                    />
                    <button
                      type="submit"
                      disabled={resetting}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {resetting ? "Resetting..." : "Reset Password"}
                    </button>
                  </form>

                  <div className="pt-3 border-t theme-border">
                    <div className="flex items-center gap-2 text-red-500">
                      <Trash2 className="w-4 h-4" />
                      <p className="text-sm font-semibold">Delete User</p>
                    </div>
                    <p className="mt-1 text-xs theme-text-muted">
                      This permanently removes the user from the workspace.
                    </p>
                    <button
                      type="button"
                      onClick={handleDeleteUser}
                      disabled={deleting}
                      className="mt-3 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete User"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
