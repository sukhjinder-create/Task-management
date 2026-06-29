import axios from "axios";
import { API_BASE_URL } from "./api";

export const SUPERADMIN_STORAGE_KEY = "superadmin_auth";

export function readSuperadminSession() {
  try {
    const raw = localStorage.getItem(SUPERADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSuperadminSession(session) {
  localStorage.setItem(SUPERADMIN_STORAGE_KEY, JSON.stringify(session));
  window.__SUPERADMIN_TOKEN__ = session?.token || null;
  window.dispatchEvent(new CustomEvent("superadmin:session-updated", { detail: session }));
}

export function clearSuperadminSession(reason = "logout") {
  localStorage.removeItem(SUPERADMIN_STORAGE_KEY);
  window.__SUPERADMIN_TOKEN__ = null;
  window.dispatchEvent(new CustomEvent("superadmin:session-cleared", { detail: { reason } }));
}

const superadminApi = axios.create({ baseURL: API_BASE_URL });
let refreshPromise = null;

superadminApi.interceptors.request.use((config) => {
  const session = readSuperadminSession();
  if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  return config;
});

superadminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config || {};
    const status = error.response?.status;
    const url = String(request.url || "");
    const isAuthRequest = url.includes("/superadmin/login") || url.includes("/superadmin/refresh");
    if (status !== 401 || request._superadminRefreshRetry || isAuthRequest) {
      return Promise.reject(error);
    }

    const session = readSuperadminSession();
    if (!session?.refreshToken) {
      clearSuperadminSession("unauthorized");
      return Promise.reject(error);
    }

    request._superadminRefreshRetry = true;
    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${API_BASE_URL}/superadmin/refresh`, { refreshToken: session.refreshToken })
        .then(({ data }) => {
          const updated = {
            token: data.token,
            refreshToken: data.refreshToken,
            superadmin: data.superadmin,
          };
          writeSuperadminSession(updated);
          return updated.token;
        })
        .catch((refreshError) => {
          clearSuperadminSession("expired");
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const token = await refreshPromise;
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${token}`;
    return superadminApi(request);
  }
);

export default superadminApi;

