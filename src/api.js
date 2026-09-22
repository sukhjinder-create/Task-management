import axios from "axios";
import { getGrowthContextHeaders } from "./services/growthTelemetry";
import { API_BASE_URL } from "./config/runtime";

export { API_BASE_URL };
export const BROWSER_AUTH_HEADERS = { "X-Auth-Mode": "cookie" };

function preconnectOrigin(url, marker) {
  if (typeof document === "undefined") return false;
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  if (!origin) return false;
  const attribute = marker || "data-api-preconnect";
  if (document.querySelector(`link[${attribute}="${origin}"]`)) return false;

  const dnsPrefetch = document.createElement("link");
  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = origin;
  dnsPrefetch.setAttribute(attribute, origin);

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = origin;
  preconnect.crossOrigin = "anonymous";
  preconnect.setAttribute(attribute, origin);

  document.head?.appendChild(dnsPrefetch);
  document.head?.appendChild(preconnect);
  return true;
}

export function preconnectApiOrigin() {
  return preconnectOrigin(API_BASE_URL, "data-api-preconnect");
}

preconnectApiOrigin();

let isRefreshing = false;
let refreshQueue = [];

function drainRefreshQueue(error) {
  refreshQueue.forEach((pending) => (error ? pending.reject(error) : pending.resolve()));
  refreshQueue = [];
}

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  withCredentials: true,
  headers: BROWSER_AUTH_HEADERS,
});

api.interceptors.request.use(
  (config) => {
    Object.assign(config.headers, getGrowthContextHeaders());
    if (window.__WORKSPACE_ID__) config.headers["x-workspace-id"] = window.__WORKSPACE_ID__;
    else delete config.headers["x-workspace-id"];
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.error || "";
    const code = error?.response?.data?.code;

    if (status === 401 && code === "EMAIL_VERIFICATION_REQUIRED") {
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(error);
    }

    if (status === 403) {
      const lower = String(message).toLowerCase();
      if (lower.includes("workspace is suspended") || lower.includes("workspace is deleted")) {
        window.dispatchEvent(new CustomEvent("workspace:blocked", { detail: { reason: message } }));
        window.dispatchEvent(new Event("auth:logout"));
      }
      return Promise.reject(error);
    }

    if (status !== 401) return Promise.reject(error);

    const lower = String(message).toLowerCase();
    const requestUrl = String(error?.config?.url || "").toLowerCase();
    const isPublicAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/dev-login") ||
      requestUrl.includes("/auth/mfa/") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/signup/") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/forgot") ||
      requestUrl.includes("/auth/reset") ||
      requestUrl.includes("/auth/magic") ||
      requestUrl.includes("/auth/email-verification/") ||
      requestUrl.includes("/auth/handoff/exchange") ||
      requestUrl.includes("/auth/browser-session");
    if (isPublicAuthEndpoint) return Promise.reject(error);

    const isSessionFailure =
      lower.includes("expired") ||
      lower.includes("invalid") ||
      lower.includes("no token") ||
      lower.includes("unauthenticated") ||
      lower.includes("unauthorized");

    if (!isSessionFailure) return Promise.reject(error);

    const originalRequest = error.config;
    if (originalRequest._refreshRetry) {
      drainRefreshQueue(error);
      isRefreshing = false;
      window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { expired: true } }));
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => refreshQueue.push({ resolve, reject }))
        .then(() => api(originalRequest));
    }

    isRefreshing = true;
    originalRequest._refreshRetry = true;
    try {
      const refreshResponse = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true, headers: BROWSER_AUTH_HEADERS }
      );
      window.dispatchEvent(new CustomEvent("auth:session-refreshed", { detail: refreshResponse.data }));
      drainRefreshQueue();
      return api(originalRequest);
    } catch (refreshError) {
      drainRefreshQueue(refreshError);
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export const getWorkspaceAISettings = () => api.get("/workspaces/ai-settings");
export const updateWorkspaceAISettings = (payload) => api.put("/workspaces/ai-settings", payload);

export const getUserAIPreference = (userId, workspaceId) =>
  api.get(`/users/${userId}/ai-preference`, { params: { workspaceId } });

export const updateUserAIPreference = (userId, workspaceId, enabled) =>
  api.put(`/users/${userId}/ai-preference`, { workspaceId, aiReplyEnabled: enabled });

export const useApi = () => api;
export default api;
