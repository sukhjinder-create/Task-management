// src/pages/Profile.jsx
import { useEffect, useRef, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { getSocket, initSocket } from "../socket";
import toast from "react-hot-toast";
import { Avatar } from "../components/ui";
import { Camera } from "lucide-react";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

function presenceColor(status) {
  if (status === "online" || status === "available") return "bg-green-500";
  if (status === "aws") return "bg-amber-500";
  if (status === "lunch") return "bg-blue-500";
  if (status === "signed-off") return "bg-slate-400";
  if (status === "offline") return "bg-slate-300";
  return "bg-slate-300";
}

function presenceLabel(status) {
  if (status === "online" || status === "available") return "Available";
  if (status === "aws") return "Away from system";
  if (status === "lunch") return "On lunch break";
  if (status === "signed-off") return "Signed off";
  if (status === "offline") return "Offline";
  return "Unknown";
}

export default function Profile() {
  const api = useApi();
  const { auth, updateUser } = useAuth();

  const [profile, setProfile] = useState(auth.user || null);
  const [loading, setLoading] = useState(!auth.user);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // live presence
  const [presence, setPresence] = useState({ status: "unknown", at: null });

  useEffect(() => {
    async function loadMe() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/users/me");
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to load profile:", err);
        const msg = err.response?.data?.error || "Failed to load profile";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, [api]);

  // Subscribe to presence:update for *this* user
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
      const res = await api.post("/users/me/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const newAvatarUrl = res.data.avatar_url;
      setProfile((prev) => ({ ...prev, avatar_url: newAvatarUrl }));
      updateUser({ avatar_url: newAvatarUrl });
      toast.success("Profile photo updated!");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error(err.response?.data?.error || "Failed to upload photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const statusText = presenceLabel(presence.status);
  const statusDot = presenceColor(presence.status);
  const updatedAt = presence.at ? new Date(presence.at).toLocaleString() : null;

  const avatarSrc = profile?.avatar_url
    ? (profile.avatar_url.startsWith("http") ? profile.avatar_url : `${BACKEND}${profile.avatar_url}`)
    : undefined;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">My Profile</h1>
          <p className="text-xs text-slate-500">View your account details and live availability.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border px-3 py-[4px] bg-slate-50">
            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
            <span className="font-medium">{statusText}</span>
          </span>
          {updatedAt && (
            <span className="text-[11px] text-slate-400">updated at {updatedAt}</span>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-6 text-sm">
        {loading && <div className="text-slate-500 text-sm">Loading profile...</div>}
        {!loading && error && <div className="text-red-600 text-sm">{error}</div>}
        {!loading && profile && !error && (
          <div className="flex gap-6 items-start">
            {/* Avatar column */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <Avatar name={profile.username} src={avatarSrc} size="xl" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Change profile photo"
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white border border-slate-300 shadow flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  {uploading ? (
                    <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={13} className="text-slate-600" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <span className="text-[11px] text-slate-400">
                {uploading ? "Uploading..." : "Click camera to change"}
              </span>
            </div>

            {/* Info column */}
            <div className="space-y-3 flex-1">
              <div>
                <div className="text-xs text-slate-500">Username</div>
                <div className="font-medium">{profile.username}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="font-medium">{profile.email}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Role</div>
                <div className="font-medium capitalize">{profile.role}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Projects (IDs)</div>
                <div className="font-mono text-[11px]">
                  {Array.isArray(profile.projects) && profile.projects.length > 0
                    ? profile.projects.join(", ")
                    : "None"}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                Editing profile (name / password / notification prefs) can be added later – right now this page is read-only. Presence updates are driven by your Sign In / Sign Off / AWS / Lunch actions.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
