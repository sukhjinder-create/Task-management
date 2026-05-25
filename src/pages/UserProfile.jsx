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

  const fieldInputClass =
    "w-full border border-[color:var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[color:var(--text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]";

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-4 pb-3 border-b border-[color:var(--border)] shrink-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Members</p>
        <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">User Profile</h1>
        <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
          Workspace member details{isAdmin ? " with admin actions" : ""}.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="border border-[color:var(--border)] rounded-lg p-6 animate-pulse">
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
          <div className="px-4 py-3 rounded-lg border border-[color:var(--score-danger)]/40">
            <p className="text-sm text-[color:var(--score-danger)]">{error}</p>
          </div>
        ) : null}

        {!loading && profile ? (
          <>
            {/* Avatar card */}
            <div className="border border-[color:var(--border)] rounded-lg p-5 flex flex-col items-center gap-3">
              <Avatar name={profile.username} src={profile.avatar_url} size="xl" />
              <div className="text-center">
                <p className="font-bold text-[color:var(--text)] text-lg leading-tight">{profile.username}</p>
                {isAdmin ? <p className="text-sm text-[color:var(--text-muted)]">{profile.email}</p> : null}
              </div>
              <span className="border border-[color:var(--border)] rounded-full px-3 py-1.5 text-xs font-semibold text-[color:var(--text-soft)] capitalize">
                {profile.role}
              </span>
            </div>

            {/* Info fields */}
            <div className="border border-[color:var(--border)] rounded-lg overflow-hidden divide-y divide-[color:var(--border)]">
              {[
                { icon: User,   label: "Username",  value: profile.username },
                { icon: Mail,   label: "Email",     value: isAdmin ? profile.email : "Visible to admins only" },
                { icon: Shield, label: "Role",      value: profile.role },
                { icon: Users,  label: "Workspace", value: profile.workspace_name || "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[color:var(--text-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[color:var(--text-muted)] font-medium uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold text-[color:var(--text)] truncate">{value || "—"}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-[color:var(--text-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[color:var(--text-muted)] font-medium uppercase tracking-wide">Projects</p>
                  {assignedProjectNames.length ? (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {assignedProjectNames.map((projectName) => (
                        <span key={projectName} className="px-2 py-1 rounded-full border border-[color:var(--border)] text-xs text-[color:var(--text-soft)]">
                          {projectName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-[color:var(--text)] truncate">None assigned</p>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Actions */}
            {isAdmin ? (
              <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[color:var(--border)]">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)]">Admin Actions</p>
                    <p className="text-xs text-[color:var(--text-muted)]">Manage this user without going back to the admin panel.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors"
                  >
                    <PencilLine className="w-4 h-4" />
                    {isEditOpen ? "Close Edit" : "Edit User"}
                  </button>
                </div>

                {isEditOpen ? (
                  <form onSubmit={handleUpdateProfile} className="px-4 py-4 space-y-4 border-b border-[color:var(--border)]">
                    <div>
                      <label className="block text-xs text-[color:var(--text-muted)] mb-1">Username</label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
                        className={fieldInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[color:var(--text-muted)] mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                        className={fieldInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[color:var(--text-muted)] mb-1">Role</label>
                      <select
                        value={editForm.role}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
                        className={fieldInputClass}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[color:var(--text-muted)] mb-1">Projects</label>
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
                        className="rounded-lg bg-[var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
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
                        className="rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="px-4 py-4 space-y-4">
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[color:var(--primary)]" />
                      <p className="text-sm font-semibold text-[color:var(--text)]">Reset Password</p>
                    </div>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="Enter a new password"
                      className={fieldInputClass}
                    />
                    <button
                      type="submit"
                      disabled={resetting}
                      className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                    >
                      {resetting ? "Resetting..." : "Reset Password"}
                    </button>
                  </form>

                  <div className="pt-3 border-t border-[color:var(--border)]">
                    <div className="flex items-center gap-2 text-[color:var(--score-danger)]">
                      <Trash2 className="w-4 h-4" />
                      <p className="text-sm font-semibold">Delete User</p>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                      This permanently removes the user from the workspace.
                    </p>
                    <button
                      type="button"
                      onClick={handleDeleteUser}
                      disabled={deleting}
                      className="mt-3 rounded-lg bg-[var(--score-danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
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
