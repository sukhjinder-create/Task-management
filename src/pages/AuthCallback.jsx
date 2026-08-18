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
  isConfiguredWorkspaceDomainHost,
} from "../config/runtime";
import { buildWorkspaceHandoffUrl } from "../auth/workspaceHandoff";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login }      = useAuth();
  const navigate       = useNavigate();
  const fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  // Query support keeps old emailed/deep links working; new web callbacks use
  // the fragment so credentials are not sent in the HTTP request or referrer.
  const callbackParam = (key) => fragmentParams.get(key) || searchParams.get(key);
  const isSignupFlow = callbackParam("flow") === "signup";
  const [status, setStatus] = useState(
    isSignupFlow ? "Connecting your new workspace…" : "Signing you in…"
  );
  const [failed, setFailed] = useState(false);

  const safePersistAuth = (user, token, refreshToken = null) => {
    try {
      localStorage.setItem("auth", JSON.stringify({ token, user, refreshToken }));
      window.__AUTH_TOKEN__    = token;
      window.__WORKSPACE_ID__  = user?.workspaceId || user?.workspace_id || "GLOBAL";
      window.dispatchEvent(new Event("auth:updated"));
    } catch (error) {
      console.warn("Failed to persist the authenticated session:", error);
    }
  };

  const redirectToWorkspace = async (user, token) => {
    const slug = user?.workspace_slug;
    // The session moves as a single-use code, never as the tokens themselves --
    // see auth/workspaceHandoff.js. A handoff that cannot be arranged leaves
    // the user signed in here rather than failing the flow.
    if (slug && isConfiguredWorkspaceDomainHost(window.location.hostname)) {
      const targetUrl = await buildWorkspaceHandoffUrl(slug, "/projects", token);
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
        const urlToken = callbackParam("token");
        const urlRefreshToken = callbackParam("refreshToken");

        if (urlToken && !isMagicPath) {
          // Credentials are single-use callback inputs. Remove them from the
          // visible URL/history before making any further network request.
          window.history.replaceState({}, document.title, window.location.pathname);
          const meRes = await axios.get(`${API_BASE_URL}/users/me`, {
            headers: { Authorization: `Bearer ${urlToken}` },
          });
          const user = meRes.data;
          safePersistAuth(user, urlToken, urlRefreshToken || null);
          login(user, urlToken, urlRefreshToken || null);
          setStatus(isSignupFlow ? "Workspace ready. Opening Asystence…" : "Sign-in complete. Opening Asystence…");
          toast.success(isSignupFlow ? `Welcome to your workspace, ${user.username}.` : `Welcome, ${user.username}!`);
          await redirectToWorkspace(user, urlToken);
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
          await redirectToWorkspace(user, token);
          return;
        }

        // No token found at all
        setFailed(true);
        setStatus("Invalid link. Please contact your admin.");
      } catch (err) {
        const msg = err.response?.data?.error || err.message || "Login failed";
        setFailed(true);
        setStatus(msg);
        toast.error(msg);
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    }

    handle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[color:var(--text)] flex items-center justify-center p-6">
      <div className="border border-[color:var(--border)] bg-[var(--surface)] rounded-2xl p-8 sm:p-10 w-full max-w-md text-center shadow-2xl shadow-black/10">
        <img src="/asystence-logo.png" alt="Asystence" className="mx-auto h-16 w-16 object-contain" />
        <p className="mt-4 text-[10px] uppercase tracking-[0.18em] font-semibold text-[color:var(--primary)]">
          {isSignupFlow ? "Workspace onboarding" : "Secure sign-in"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isSignupFlow ? "Your work continues here." : "Welcome back."}
        </h1>
        <div className="mt-7 flex justify-center">
          {failed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-red-500/40 text-red-400">!</div>
          ) : (
            <div className="w-10 h-10 rounded-full border-4 border-[color:var(--primary)] border-t-transparent animate-spin" />
          )}
        </div>
        <p className="mt-4 text-sm leading-6 text-[color:var(--text-muted)]">{status}</p>
        {isSignupFlow && !failed && (
          <p className="mt-3 text-xs text-[color:var(--text-soft)]">
            Your seven-day trial is active. No payment details were collected.
          </p>
        )}
      </div>
    </div>
  );
}
