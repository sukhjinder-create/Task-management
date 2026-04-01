// pages/AuthCallback.jsx
// Handles two flows:
//   1. Google SSO redirect  → /auth/callback?token=...&user=...
//   2. Magic link click     → /auth/magic?token=...  (fetches token from backend)

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../api";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login }      = useAuth();
  const navigate       = useNavigate();
  const [status, setStatus] = useState("Signing you in…");

  const safePersistAuth = (user, token, refreshToken = null) => {
    try {
      localStorage.setItem("auth", JSON.stringify({ token, user, refreshToken }));
      window.__AUTH_TOKEN__    = token;
      window.__WORKSPACE_ID__  = user?.workspaceId || user?.workspace_id || "GLOBAL";
      window.dispatchEvent(new Event("auth:updated"));
    } catch (_) {}
  };

  useEffect(() => {
    async function handle() {
      try {
        // ── Flow 1: Google SSO (token passed in URL by backend redirect) ──
        const urlToken = searchParams.get("token");
        const urlUser  = searchParams.get("user");

        if (urlToken && urlUser) {
          const user = JSON.parse(decodeURIComponent(urlUser));
          // Google SSO: no refresh token (can't put it in URL safely)
          safePersistAuth(user, urlToken, null);
          login(user, urlToken, null);
          toast.success(`Welcome, ${user.username}!`);
          navigate("/projects", { replace: true });
          return;
        }

        // ── Flow 2: Magic link (token is query param, exchange with backend) ──
        const magicToken = searchParams.get("token");
        if (magicToken) {
          const res = await axios.get(`${API_BASE_URL}/auth/magic`, {
            params: { token: magicToken },
          });
          const { token, user, refreshToken = null } = res.data;
          safePersistAuth(user, token, refreshToken);
          login(user, token, refreshToken);
          toast.success(`Welcome, ${user.username}! You're now logged in.`);
          navigate("/projects", { replace: true });
          return;
        }

        // No token found at all
        setStatus("Invalid link. Please contact your admin.");
      } catch (err) {
        const msg = err.response?.data?.error || err.message || "Login failed";
        setStatus(msg);
        toast.error(msg);
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    }

    handle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center theme-bg">
      <div className="theme-surface border theme-border rounded-xl shadow p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        </div>
        <p className="theme-text text-sm">{status}</p>
      </div>
    </div>
  );
}
