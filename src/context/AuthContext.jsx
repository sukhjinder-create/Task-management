// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { initPush, teardownPush } from "../utils/pushNotifications";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    user: null,
    token: null,
    isReady: false,
  });

  /* ---------------------------------------------
     1. Restore from localStorage on page load
        Also handles ?_t=TOKEN from workspace subdomain redirects
  --------------------------------------------- */
  useEffect(() => {
    // On Capacitor (mobile), detect a fresh install and clear any auth
    // that Android Auto Backup may have restored from a previous install.
    // We mark the install via Preferences (native storage). If the marker
    // is absent we know the app data was never initialised by THIS install.
    async function clearAuthIfFreshInstall() {
      if (!window.Capacitor) return;
      try {
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key: "install_v1" });
        if (!value) {
          localStorage.removeItem("auth");
          await Preferences.set({ key: "install_v1", value: "1" });
        }
      } catch {
        // Preferences not available — ignore
      }
    }

    clearAuthIfFreshInstall().then(() => {
    try {
      // Check for token passed via URL (cross-subdomain redirect)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("_t");
      const urlUser = params.get("_u");

      if (urlToken) {
        window.__AUTH_TOKEN__ = urlToken;
        // Clean token from URL immediately
        params.delete("_t");
        params.delete("_u");
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "");
        window.history.replaceState({}, "", newUrl);

        // Fetch user from API using the token
        fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/users/me`, {
          headers: { Authorization: `Bearer ${urlToken}` },
        })
          .then((r) => r.json())
          .then((user) => {
            const authData = { token: urlToken, user, refreshToken: null };
            localStorage.setItem("auth", JSON.stringify(authData));
            window.__WORKSPACE_ID__ = user?.workspaceId || user?.workspace_id || null;
            setAuth({ user, token: urlToken, isReady: true });
          })
          .catch(() => setAuth((prev) => ({ ...prev, isReady: true })));
        return;
      }

      const stored = localStorage.getItem("auth");
      if (stored) {
        const parsed = JSON.parse(stored);

        // 🔥 Global token so axios & socket use it automatically
        window.__AUTH_TOKEN__ = parsed?.token || null;

        // Redirect to workspace subdomain if on app.asystence.com
        const user = parsed?.user;
        const slug = user?.workspace_slug;
        const hostname = window.location.hostname;
        if (slug && hostname === "app.asystence.com") {
          window.location.href = `https://${slug}.asystence.com${window.location.pathname}?_t=${parsed.token}`;
          return;
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
    }); // end clearAuthIfFreshInstall().then
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
    try { stored = JSON.parse(localStorage.getItem("auth")); } catch {}

    if (stored?.token) {
      teardownPush(stored.token).catch(() => {});
      fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/auth/logout`, {
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
      } catch {}
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
