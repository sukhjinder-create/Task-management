// src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Profile() {
  const api = useApi();
  const { auth } = useAuth();

  const [profile, setProfile] = useState(auth.user || null);
  const [loading, setLoading] = useState(!auth.user);
  const [error, setError] = useState("");

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

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">My Profile</h1>
          <p className="text-xs text-slate-500">
            View your account details and preferences.
          </p>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-4 text-sm">
        {loading && (
          <div className="text-slate-500 text-sm">Loading profile...</div>
        )}

        {!loading && error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        {!loading && profile && !error && (
          <div className="space-y-3">
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
              <div className="font-medium">{profile.role}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Projects (IDs)</div>
              <div className="font-mono text-[11px]">
                {Array.isArray(profile.projects) &&
                profile.projects.length > 0
                  ? profile.projects.join(", ")
                  : "None"}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Editing profile (name / password / notification prefs) can be
              added later – right now this page is read-only.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
