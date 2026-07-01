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
import {
  buildWorkspaceRedirectUrl,
  isConfiguredWorkspaceDomainHost,
} from "../config/runtime";

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

  const redirectToWorkspace = (user, token, refreshToken = null) => {
    const slug = user?.workspace_slug;
    if (slug && isConfiguredWorkspaceDomainHost(window.location.hostname)) {
      const targetUrl = buildWorkspaceRedirectUrl(slug, "/projects", {
        _t: token,
        ...(refreshToken ? { _r: refreshToken } : {}),
      });
      if (targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }
    navigate("/projects", { replace: true });
  };

  useEffect(() => {
    async function handle() {
      try {
        // ── Flow 1: Google SSO (only token passed in URL, fetch user from API) ──
        const isMagicPath = window.location.pathname.endsWith("/auth/magic");
        const urlToken = searchParams.get("token");
        const urlRefreshToken = searchParams.get("refreshToken");

        if (urlToken && !isMagicPath) {
          const meRes = await axios.get(`${API_BASE_URL}/users/me`, {
            headers: { Authorization: `Bearer ${urlToken}` },
          });
          const user = meRes.data;
          safePersistAuth(user, urlToken, urlRefreshToken || null);
          login(user, urlToken, urlRefreshToken || null);
          toast.success(`Welcome, ${user.username}!`);
          redirectToWorkspace(user, urlToken, urlRefreshToken || null);
          return;
        }

        // ── Flow 2: Magic link (token is query param, exchange with backend) ──
        const magicToken = isMagicPath ? searchParams.get("token") : null;
        if (magicToken) {
          const res = await axios.get(`${API_BASE_URL}/auth/magic`, {
            params: { token: magicToken },
          });
          const { token, user, refreshToken = null } = res.data;
          safePersistAuth(user, token, refreshToken);
          login(user, token, refreshToken);
          toast.success(`Welcome, ${user.username}! You're now logged in.`);
          redirectToWorkspace(user, token, refreshToken);
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
    <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center p-4">
      <div className="border border-[color:var(--border)] rounded-xl p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-10 rounded-full border-4 border-[color:var(--primary)] border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">{status}</p>
      </div>
    </div>
  );
}
