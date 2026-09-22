/* eslint-disable react-refresh/only-export-components -- context and hook intentionally share this module */
import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL, BROWSER_AUTH_HEADERS } from "../api";
import { isConfiguredPrimaryAppHost } from "../config/runtime";
import {
  buildWorkspaceHandoffUrl,
  consumeWorkspaceHandoff,
  hasPendingHandoff,
  isOnWrongWorkspaceHost,
} from "../auth/workspaceHandoff";
import { initPush, teardownPush } from "../utils/pushNotifications";

const AuthContext = createContext(null);

function isSuperadminPath() {
  return window.location.pathname === "/superadmin" || window.location.pathname.startsWith("/superadmin/");
}

async function request(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...BROWSER_AUTH_HEADERS, ...(options.headers || {}) },
  });
}

async function migrateLegacySession(legacy) {
  if (!legacy?.token && !legacy?.refreshToken) return false;

  if (legacy.refreshToken) {
    const refreshed = await request("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: legacy.refreshToken }),
    }).catch(() => null);
    if (refreshed?.ok) return true;
  }

  if (!legacy.token) return false;
  const migrated = await request("/auth/browser-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${legacy.token}` },
  }).catch(() => null);
  return migrated?.ok === true;
}

async function loadCurrentUser() {
  let response = await request("/auth/me").catch(() => null);
  if (response?.status === 401) {
    const refreshed = await request("/auth/refresh", { method: "POST" }).catch(() => null);
    if (refreshed?.ok) response = await request("/auth/me").catch(() => null);
  }
  return response?.ok ? response.json() : null;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => ({ user: null, token: null, isReady: isSuperadminPath() }));

  const establishSession = (user) => {
    if (!user) return;
    window.__AUTH_TOKEN__ = null;
    window.__WORKSPACE_ID__ = user.workspaceId || user.workspace_id || null;
    setAuth({ user, token: true, isReady: true });
    window.dispatchEvent(new CustomEvent("auth:updated", { detail: { user } }));
    initPush().catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      localStorage.removeItem("attendanceStatus");
      window.__AUTH_TOKEN__ = null;

      if (isSuperadminPath()) {
        localStorage.removeItem("auth");
        window.__WORKSPACE_ID__ = null;
        return;
      }

      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem("auth") || "null"); } catch { /* invalid legacy data */ }

      try {
        if (hasPendingHandoff()) {
          const handoff = await consumeWorkspaceHandoff();
          if (handoff?.user && !cancelled) {
            establishSession(handoff.user);
            return;
          }
        }

        if (legacy) await migrateLegacySession(legacy);
        const user = await loadCurrentUser();
        if (!user || cancelled) {
          if (!cancelled) setAuth({ user: null, token: null, isReady: true });
          return;
        }

        establishSession(user);

        const slug = user.workspace_slug;
        const hostname = window.location.hostname;
        if (slug && (isConfiguredPrimaryAppHost(hostname) || isOnWrongWorkspaceHost(slug, hostname))) {
          const targetUrl = await buildWorkspaceHandoffUrl(slug, window.location.pathname);
          if (targetUrl && !cancelled) window.location.href = targetUrl;
        }
      } finally {
        localStorage.removeItem("auth");
        window.__AUTH_TOKEN__ = null;
        if (!cancelled) setAuth((current) => current.isReady ? current : { ...current, isReady: true });
      }
    }

    hydrate().catch(() => {
      localStorage.removeItem("auth");
      if (!cancelled) setAuth({ user: null, token: null, isReady: true });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleRefresh = (event) => {
      const user = event.detail?.user;
      if (user) establishSession(user);
    };
    const handleLogout = () => {
      window.__AUTH_TOKEN__ = null;
      window.__WORKSPACE_ID__ = null;
      setAuth({ user: null, token: null, isReady: true });
    };
    const handleRole = (event) => {
      const { userId, role } = event.detail || {};
      setAuth((current) => {
        if (!current.user || String(current.user.id) !== String(userId) || !role) return current;
        return { ...current, user: { ...current.user, role } };
      });
    };

    window.addEventListener("auth:session-refreshed", handleRefresh);
    window.addEventListener("auth:logout", handleLogout);
    window.addEventListener("auth:role-updated", handleRole);
    return () => {
      window.removeEventListener("auth:session-refreshed", handleRefresh);
      window.removeEventListener("auth:logout", handleLogout);
      window.removeEventListener("auth:role-updated", handleRole);
    };
  }, []);

  const login = (user) => establishSession(user);

  const logout = () => {
    teardownPush().catch(() => {});
    request("/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("auth");
    window.dispatchEvent(new CustomEvent("auth:logout"));
  };

  const updateUser = (patch) => {
    setAuth((current) => ({ ...current, user: { ...current.user, ...patch } }));
  };

  if (!auth.isReady) return null;

  return (
    <AuthContext.Provider value={{ auth, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
