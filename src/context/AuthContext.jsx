// src/context/AuthContext.jsx
/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect -- mount hydration synchronizes browser auth storage */
import { createContext, useContext, useEffect, useState } from "react";
import {
  API_BASE_URL,
  isConfiguredPrimaryAppHost,
} from "../config/runtime";
import {
  buildWorkspaceHandoffUrl,
  consumeWorkspaceHandoff,
  hasPendingHandoff,
  isOnWrongWorkspaceHost,
} from "../auth/workspaceHandoff";
import { initPush, teardownPush } from "../utils/pushNotifications";

const AuthContext = createContext(null);

function isSuperadminPath() {
  return (
    window.location.pathname === "/superadmin" ||
    window.location.pathname.startsWith("/superadmin/")
  );
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => ({
    user: null,
    token: null,
    isReady: isSuperadminPath(),
  }));

  /* ---------------------------------------------
     1. Restore from localStorage on page load
        Also handles ?_t=TOKEN from workspace subdomain redirects
  --------------------------------------------- */
  useEffect(() => {
    try {
      const isSuperadminSurface = isSuperadminPath();

      // Remove the legacy global attendance flag. Attendance is tied to the
      // authenticated user's workspace session and is hydrated from the API.
      localStorage.removeItem("attendanceStatus");

      // The platform console owns a dedicated auth/session boundary. A stored
      // workspace-user session must never redirect, hydrate, or open user
      // realtime/push services while this surface is loading.
      if (isSuperadminSurface) {
        const params = new URLSearchParams(window.location.search);
        if (params.has("_t") || params.has("_r") || params.has("_u")) {
          params.delete("_t");
          params.delete("_r");
          params.delete("_u");
          const search = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
        }
        window.__AUTH_TOKEN__ = null;
        window.__WORKSPACE_ID__ = null;
        return;
      }

      // A session arriving from a workspace-subdomain redirect. The URL carries
      // a single-use code, not the tokens -- see auth/workspaceHandoff.js for
      // why. Redeeming it also returns the user, so no follow-up /users/me.
      if (hasPendingHandoff()) {
        consumeWorkspaceHandoff()
          .then((session) => {
            if (!session) {
              // Expired, already spent, or refused. Fall through to the login
              // screen rather than stranding the user on a blank app.
              setAuth((prev) => ({ ...prev, isReady: true }));
              return;
            }

            const authData = {
              token: session.token,
              user: session.user,
              refreshToken: session.refreshToken,
            };
            localStorage.setItem("auth", JSON.stringify(authData));
            window.__AUTH_TOKEN__ = session.token;
            window.__WORKSPACE_ID__ =
              session.user?.workspaceId || session.user?.workspace_id || null;
            window.dispatchEvent(
              new CustomEvent("auth:updated", {
                detail: { user: session.user, token: session.token },
              })
            );
            setAuth({ user: session.user, token: session.token, isReady: true });
          })
          .catch(() => setAuth((prev) => ({ ...prev, isReady: true })));
        return;
      }

      const stored = localStorage.getItem("auth");
      if (stored) {
        const parsed = JSON.parse(stored);

        // 🔥 Global token so axios & socket use it automatically
        window.__AUTH_TOKEN__ = parsed?.token || null;

        // Redirect to a configured workspace subdomain on the primary production host.
        const user = parsed?.user;
        const slug = user?.workspace_slug;
        const hostname = window.location.hostname;
        // Move an existing session onto its workspace subdomain. Arranging the
        // handoff needs a round trip, so unlike the old synchronous redirect we
        // carry on setting the session up locally and navigate away only if it
        // succeeds. A failed handoff therefore costs the user nothing: they
        // stay signed in on this host instead of being stranded mid-redirect.
        // Two cases move a session: arriving on the primary host with a
        // workspace to go to, and sitting on the WRONG workspace host. The
        // second happens via an old bookmark or a shared link, and while the
        // data is never at risk -- the API scopes every request from the JWT,
        // never the hostname -- the address bar names someone else's workspace,
        // which is alarming and looks exactly like a leak.
        const needsMove =
          slug &&
          (isConfiguredPrimaryAppHost(hostname) || isOnWrongWorkspaceHost(slug, hostname));

        if (needsMove) {
          buildWorkspaceHandoffUrl(slug, window.location.pathname, parsed.token)
            .then((targetUrl) => {
              if (targetUrl) window.location.href = targetUrl;
            })
            .catch(() => {});
        }

        // Initialize socket immediately so huddle/chat works on any page (not just Chat)
        if (parsed?.token) {
          window.dispatchEvent(new CustomEvent("auth:updated", { detail: { user: parsed?.user, token: parsed?.token } }));
          initPush(parsed.token).catch(() => {});
        }

        setAuth({
          user: parsed?.user || null,
          token: parsed?.token || null,
          isReady: true,
        });
      } else {
        setAuth((prev) => ({ ...prev, isReady: true }));
      }
    } catch (e) {
      console.warn("Unable to restore auth", e);
      setAuth((prev) => ({ ...prev, isReady: true }));
    }
  }, []);

  /* ---------------------------------------------
     2. Listen for silent token refresh events
     (fired by the axios interceptor in api.js)
  --------------------------------------------- */
  useEffect(() => {
    const handler = (e) => {
      const { user, token } = e.detail || {};
      if (!token) return;
      setAuth((prev) => ({
        ...prev,
        token,
        user: user || prev.user,
      }));
    };
    window.addEventListener("auth:token-refreshed", handler);
    return () => window.removeEventListener("auth:token-refreshed", handler);
  }, []);

  useEffect(() => {
    const handler = () => setAuth({ user: null, token: null, isReady: true });
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  /* ---------------------------------------------
     3. Login handler → stores auth everywhere
        refreshToken is optional (Google SSO skips it)
  --------------------------------------------- */
  const login = (user, token, refreshToken = null) => {
    if (!token) return console.error("Login missing token!");

    const data = { user, token, refreshToken };

    // Store in browser (include refreshToken so the axios interceptor can use it)
    localStorage.setItem("auth", JSON.stringify(data));

    // 🔥 Set runtime global token so axios uses it instantly
    window.__AUTH_TOKEN__ = token;

    setAuth({
      user,
      token,
      isReady: true,
    });

    window.dispatchEvent(
      new CustomEvent("auth:updated", { detail: { user, token } })
    );

    // Initialize push notifications in background (non-blocking)
    initPush(token).catch(() => {});
  };

  /* ---------------------------------------------
     4. Logout → revoke session + clear everything
  --------------------------------------------- */
  const logout = () => {
    // Send refresh token to backend to revoke the session
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem("auth")); } catch { /* storage can be unavailable */ }

    if (stored?.token) {
      teardownPush(stored.token).catch(() => {});
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stored.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: stored.refreshToken || null }),
      }).catch(() => {});
    }

    localStorage.removeItem("auth");
    window.__AUTH_TOKEN__ = null;

    setAuth({
      user: null,
      token: null,
      isReady: true,
    });

    window.dispatchEvent(new CustomEvent("auth:logout"));
  };

  /* ---------------------------------------------
     5. updateUser — patch user fields in state
        Preserves the refreshToken in localStorage
  --------------------------------------------- */
  const updateUser = (patch) => {
    setAuth((prev) => {
      const updated = { ...prev, user: { ...prev.user, ...patch } };
      // Read refreshToken from current storage so we don't lose it
      let refreshToken = null;
      try {
        const current = JSON.parse(localStorage.getItem("auth"));
        refreshToken = current?.refreshToken || null;
      } catch { /* storage can be unavailable */ }
      localStorage.setItem(
        "auth",
        JSON.stringify({ user: updated.user, token: updated.token, refreshToken })
      );
      return updated;
    });
  };

  const value = {
    auth,
    login,
    logout,
    updateUser,
  };

  if (!auth.isReady) return null;

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
