import axios from "axios";

export const API_BASE_URL = "http://localhost:3000";

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
  (err) => {
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
       EXISTING 401 LOGIC (UNCHANGED)
    --------------------------------------------- */
    if (status === 401) {
      console.warn("⚠️ Soft 401 captured:", message);
      const lower = String(message).toLowerCase();

      if (lower.includes("expired") || lower.includes("invalid")) {
        console.warn("🔴 Real token failure → logging out");

        try {
          localStorage.removeItem("auth");
        } catch {}

        window.dispatchEvent(
          new CustomEvent("auth:unauthorized", {
            detail: { expired: true },
          })
        );

        window.dispatchEvent(new Event("auth:logout"));
      } else {
        console.warn("🟡 401 not jwt-related → skip logout");
      }
    }

    return Promise.reject(err);
  }
);

export const useApi = () => api;
export default api;
