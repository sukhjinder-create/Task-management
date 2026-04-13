import axios from "axios";

// VITE_API_URL can be set per-build via .env files:
//   Web/Electron: defaults to localhost:3000
//   Mobile (Android emulator): set to http://10.0.2.2:3000
//   Mobile (real device): set to your PC's local network IP e.g. http://192.168.x.x:3000
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ── Silent refresh state ──────────────────────────────────────────────────────
// Tracks whether a /auth/refresh call is already in flight, and queues any
// requests that fail while the refresh is happening so they can be retried.
let _isRefreshing = false;
let _refreshQueue = []; // [{ resolve, reject }]

function _drainQueue(err, token) {
  _refreshQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  _refreshQueue = [];
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // important
});

/* ------------------------------------------
   1. Attach JWT token + workspace id (SAFE)
--------------------------------------------- */
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem("auth");
      const parsed = stored ? JSON.parse(stored) : null;

      const token = parsed?.token || parsed?.accessToken || null;
      const user = parsed?.user || parsed;

      /* ---------- AUTH TOKEN ---------- */
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        try {
          window.__AUTH_TOKEN__ = token;
        } catch {}
      }

      /* ---------- WORKSPACE ID ---------- */
      const workspaceId =
        user?.workspaceId ||
        user?.workspace_id ||
        parsed?.workspaceId ||
        parsed?.workspace_id ||
        null;

      /**
       * 🚫 DO NOT send fake workspace IDs
       * ✅ Only attach header if we have a REAL one
       */
      if (workspaceId) {
        const wid = String(workspaceId);
        config.headers["x-workspace-id"] = wid;

        try {
          window.__WORKSPACE_ID__ = wid;
        } catch {}
      } else {
        // ensure we don't leak old values
        delete config.headers["x-workspace-id"];
        try {
          delete window.__WORKSPACE_ID__;
        } catch {}
      }
    } catch (e) {
      console.warn("Auth token parse failed:", e);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------------------
   2. RESPONSE HANDLER
--------------------------------------------- */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const message = err?.response?.data?.error || "";

    /* ------------------------------------------
       WORKSPACE ENFORCEMENT (Backend authority)
    --------------------------------------------- */
    if (status === 403) {
      const lower = String(message).toLowerCase();

      if (
        lower.includes("workspace is suspended") ||
        lower.includes("workspace is deleted")
      ) {
        console.warn("🚫 Workspace access revoked:", message);

        try {
          localStorage.removeItem("auth");
        } catch {}

        window.dispatchEvent(
          new CustomEvent("workspace:blocked", {
            detail: { reason: message },
          })
        );

        window.dispatchEvent(new Event("auth:logout"));
      }

      return Promise.reject(err);
    }

    /* ------------------------------------------
       401 — try silent token refresh first
    --------------------------------------------- */
    if (status === 401) {
      const lower = String(message).toLowerCase();
      const reqUrl = String(err?.config?.url || "").toLowerCase();
      const isAuthEndpoint =
        reqUrl.includes("/auth/login") ||
        reqUrl.includes("/auth/register") ||
        reqUrl.includes("/auth/refresh") ||
        reqUrl.includes("/auth/forgot") ||
        reqUrl.includes("/auth/reset");
      const isTokenFailure =
        lower.includes("expired") ||
        lower.includes("invalid") ||
        lower.includes("no token") ||
        lower.includes("unauthenticated") ||
        (!isAuthEndpoint && lower.includes("unauthorized"));

      if (!isTokenFailure) {
        // Business-logic 401 (e.g. wrong password) — don't touch auth state
        return Promise.reject(err);
      }

      const originalRequest = err.config;

      // Avoid infinite retry loop
      if (originalRequest._refreshRetry) {
        _drainQueue(err, null);
        _isRefreshing = false;
        try { localStorage.removeItem("auth"); } catch {}
        window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { expired: true } }));
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(err);
      }

      // If a refresh is already in flight, queue this request to retry after
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        });
      }

      // Check whether we have a refresh token to use
      let stored;
      try { stored = JSON.parse(localStorage.getItem("auth")); } catch { stored = null; }
      const refreshToken = stored?.refreshToken;

      if (!refreshToken) {
        // No refresh token — just log out
        try { localStorage.removeItem("auth"); } catch {}
        window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { expired: true } }));
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(err);
      }

      // Start silent refresh
      _isRefreshing = true;
      originalRequest._refreshRetry = true;

      try {
        const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { token: newToken, refreshToken: newRefreshToken, user } = refreshRes.data;

        // Persist updated tokens
        const updatedAuth = {
          user: user || stored?.user,
          token: newToken,
          refreshToken: newRefreshToken,
        };
        localStorage.setItem("auth", JSON.stringify(updatedAuth));
        try { window.__AUTH_TOKEN__ = newToken; } catch {}

        // Notify React context (AuthContext listens for this)
        window.dispatchEvent(new CustomEvent("auth:token-refreshed", { detail: updatedAuth }));

        _drainQueue(null, newToken);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        _drainQueue(refreshErr, null);
        try { localStorage.removeItem("auth"); } catch {}
        try { window.__AUTH_TOKEN__ = null; } catch {}
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

// =======================
// AI SETTINGS (FRONTEND)
// =======================

// Workspace AI settings
export const getWorkspaceAISettings = () => {
  return api.get("/workspaces/ai-settings");
};

export const updateWorkspaceAISettings = (payload) => {
  return api.put("/workspaces/ai-settings", payload);
};

// User AI preference
export const getUserAIPreference = (userId, workspaceId) => {
  return api.get(`/users/${userId}/ai-preference`, {
    params: { workspaceId },
  });
};

export const updateUserAIPreference = (userId, workspaceId, enabled) => {
  return api.put(`/users/${userId}/ai-preference`, {
    workspaceId,
    aiReplyEnabled: enabled,
  });
};


export const useApi = () => api;
export default api;
