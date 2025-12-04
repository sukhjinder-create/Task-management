// src/api.js
import axios from "axios";

export const API_BASE_URL = "http://localhost:3000";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // important
});

/* ------------------------------------------
   1. Always attach JWT token cleanly
--------------------------------------------- */
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem("auth");
      const parsed = stored ? JSON.parse(stored) : null;

      if (parsed?.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    } catch (e) {
      console.warn("Auth token parse failed:", e);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------------------
   2. SAFE 401 Handler (no aggressive logout)
      - prevents logout loop during channel create
      - only logs out IF backend returns "Invalid token"
--------------------------------------------- */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const message = err?.response?.data?.error || "";

    // Ignore OPTIONS preflight & 404 (not auth related)
    if (status === 404 || status === 403) {
      return Promise.reject(err);
    }

    // Prevent logout if 401 came due to permissions or channel creation mismatch
    const allowSoft = [
      "Not allowed",
      "Missing",
      "Cannot",
      "Denied",
      "Forbidden",
      "Private",
    ];

    if (status === 401) {
      console.warn("⚠️ Soft 401 captured:", message);

      const lower = message.toLowerCase();

      // Only logout if explicitly invalid token or expired
      if (lower.includes("expired") || lower.includes("invalid")) {
        console.warn("🔴 Real token failure → logging out");

        localStorage.removeItem("auth");

        window.dispatchEvent(
          new CustomEvent("auth:unauthorized", {
            detail: { expired: true },
          })
        );
      } else {
        console.warn("🟡 401 not jwt-related → skip logout");
      }
    }

    return Promise.reject(err);
  }
);

export const useApi = () => api;
export default api;
