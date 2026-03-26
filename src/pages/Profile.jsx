// src/pages/Profile.jsx
import { useEffect, useRef, useState } from "react";
import { useApi, API_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { getSocket, initSocket } from "../socket";
import toast from "react-hot-toast";
import { Avatar } from "../components/ui";
import { Camera, User, Mail, Shield, FolderKanban, Building2 } from "lucide-react";

const BACKEND = API_BASE_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
function resolveUrl(src) {
  if (!src) return undefined;
  if (src.startsWith("http://localhost") || src.startsWith("http://127.0.0.1"))
    return BACKEND + src.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, "");
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:")) return src;
  return `${BACKEND}${src}`;
}

function presenceColor(status) {
  if (status === "online" || status === "available") return "bg-green-500";
  if (status === "aws") return "bg-amber-500";
  if (status === "lunch") return "bg-blue-500";
  if (status === "signed-off") return "bg-slate-400";
  return "bg-slate-300";
}

function presenceLabel(status) {
  if (status === "online" || status === "available") return "Available";
  if (status === "aws") return "Away from system";
  if (status === "lunch") return "On lunch break";
  if (status === "signed-off") return "Signed off";
  if (status === "offline") return "Offline";
  return "Offline";
}

export default function Profile() {
  const api = useApi();
  const { auth, updateUser } = useAuth();

  const [profile, setProfile] = useState(auth.user || null);
  const [loading, setLoading] = useState(!auth.user);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [presence, setPresence] = useState({ status: "unknown", at: null });

  useEffect(() => {
    api.get("/users/me").then((res) => {
      setProfile(res.data);
    }).catch((err) => {
      const msg = err.response?.data?.error || "Failed to load profile";
      setError(msg);
      toast.error(msg);
    }).finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    let socket = getSocket();
    if (!socket && auth.token) socket = initSocket(auth.token);
    if (!socket || !auth.user?.id) return;
    const handler = (payload) => {
      if (!payload || payload.userId !== auth.user.id) return;
      setPresence({ status: payload.status || "unknown", at: payload.at || new Date().toISOString() });
    };
    socket.on("presence:update", handler);
    return () => socket.off("presence:update", handler);
  }, [auth.token, auth.user?.id]);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      setUploading(true);
      const res = await api.post("/users/me/avatar", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setProfile((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
      updateUser({ avatar_url: res.data.avatar_url });
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const avatarSrc = resolveUrl(profile?.avatar_url);
  const statusDot = presenceColor(presence.status);
  const statusLabel = presenceLabel(presence.status);

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 theme-surface border-b theme-border shrink-0">
        <h1 className="text-lg font-bold theme-text">My Profile</h1>
        <p className="text-xs theme-text-muted mt-0.5">Account details and availability</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Loading */}
        {loading && (
          <div className="theme-surface border theme-border rounded-2xl p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-[var(--surface-soft)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--surface-soft)] rounded w-1/3" />
                <div className="h-3 bg-[var(--surface-soft)] rounded w-1/2" />
                <div className="h-3 bg-[var(--surface-soft)] rounded w-1/4" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Avatar card */}
        {!loading && profile && (
          <div className="theme-surface border theme-border rounded-2xl p-5 flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar name={profile.username} src={avatarSrc} size="xl" />
              {/* Online ring */}
              <span className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-white ${statusDot}`} />
              {/* Camera button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full theme-surface border theme-border shadow flex items-center justify-center active:opacity-70 transition-opacity"
                title="Change photo"
              >
                {uploading
                  ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  : <Camera size={14} className="theme-text-muted" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <div className="text-center">
              <p className="font-bold theme-text text-lg leading-tight">{profile.username}</p>
              <p className="text-sm theme-text-muted">{profile.email}</p>
            </div>

            {/* Status pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-soft)] border theme-border">
              <span className={`w-2 h-2 rounded-full ${statusDot}`} />
              <span className="text-xs font-medium theme-text">{statusLabel}</span>
            </div>

            <p className="text-xs theme-text-muted">
              {uploading ? "Uploading..." : "Tap camera icon to change photo"}
            </p>
          </div>
        )}

        {/* Info fields */}
        {!loading && profile && (
          <div className="theme-surface border theme-border rounded-2xl overflow-hidden divide-y theme-border">
            {[
              { icon: User,         label: "Username",  value: profile.username },
              { icon: Mail,         label: "Email",     value: profile.email },
              { icon: Shield,       label: "Role",      value: (profile.role || "").charAt(0).toUpperCase() + (profile.role || "").slice(1) },
              { icon: Building2,    label: "Workspace", value: profile.workspace_name || "—" },
              {
                icon: FolderKanban,
                label: "Projects",
                value: Array.isArray(profile.projects) && profile.projects.length > 0
                  ? `${profile.projects.length} assigned`
                  : "None assigned",
              },
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
          </div>
        )}

      </div>
    </div>
  );
}
