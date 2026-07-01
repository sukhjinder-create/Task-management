const LOCAL_API_FALLBACK = "http://localhost:5000";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function envValue(name) {
  const value = import.meta.env?.[name];
  return typeof value === "string" ? value.trim() : "";
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function cleanUrl(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\/+$/, "");
}

function firstUrl(...values) {
  for (const value of values) {
    const cleaned = cleanUrl(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function browserLocation() {
  if (typeof window === "undefined") {
    return { protocol: "", hostname: "" };
  }
  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  };
}

export function isLocalBrowserRuntime() {
  const { protocol, hostname } = browserLocation();
  return /^https?:$/.test(protocol) && LOCAL_HOSTS.has(String(hostname || "").toLowerCase());
}

export function isProductionApiUrl(value) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "app.asystence.com" ||
      host.endsWith(".asystence.com") ||
      host.includes("asystence-api") ||
      host.endsWith(".run.app")
    );
  } catch {
    return false;
  }
}

export const AUTH_DEV_MODE_ENABLED = truthy(envValue("VITE_AUTH_DEV_MODE"));
export const ALLOW_LOCAL_PRODUCTION_API = truthy(envValue("VITE_ALLOW_LOCAL_PRODUCTION_API"));
export const APP_PRIMARY_HOST = envValue("VITE_APP_PRIMARY_HOST");
export const WORKSPACE_DOMAIN = envValue("VITE_WORKSPACE_DOMAIN");

export function isConfiguredPrimaryAppHost(hostname = "") {
  return Boolean(APP_PRIMARY_HOST) && String(hostname).toLowerCase() === APP_PRIMARY_HOST.toLowerCase();
}

export function isConfiguredWorkspaceDomainHost(hostname = "") {
  return Boolean(WORKSPACE_DOMAIN) && String(hostname).toLowerCase().endsWith(WORKSPACE_DOMAIN.toLowerCase());
}

export function buildWorkspaceRedirectUrl(slug, path = "/projects", params = {}) {
  if (!slug || !WORKSPACE_DOMAIN) return "";
  const url = new URL(path, `https://${slug}.${WORKSPACE_DOMAIN}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function resolveApiBaseUrl() {
  const localFallback = firstUrl(envValue("VITE_LOCAL_API_URL"), LOCAL_API_FALLBACK);
  const configured = firstUrl(
    envValue("VITE_API_BASE_URL"),
    envValue("VITE_API_URL"),
    envValue("VITE_BACKEND_URL")
  );

  if (
    configured &&
    isLocalBrowserRuntime() &&
    isProductionApiUrl(configured) &&
    !ALLOW_LOCAL_PRODUCTION_API
  ) {
    console.error(
      `[runtime] Refusing production API ${configured} while running on localhost. Falling back to ${localFallback}.`
    );
    return localFallback;
  }

  if (configured) return configured;
  return isLocalBrowserRuntime() ? localFallback : "";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const SOCKET_BASE_URL = firstUrl(
  envValue("VITE_SOCKET_URL"),
  envValue("VITE_BACKEND_URL"),
  API_BASE_URL
);
