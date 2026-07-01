import { API_BASE_URL } from "../config/runtime";

const ANONYMOUS_KEY = "growth_anonymous_id";
const SESSION_KEY = "growth_session_id";
const SESSION_SENT_KEY = "growth_session_started";
const ACQUISITION_KEY = "growth_acquisition";
let lastPageKey = null;
let lastPageAt = 0;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreate(storage, key) {
  try {
    let value = storage.getItem(key);
    if (!value) {
      value = createId();
      storage.setItem(key, value);
    }
    return value;
  } catch {
    return createId();
  }
}

function identities() {
  return {
    anonymousId: getOrCreate(localStorage, ANONYMOUS_KEY),
    sessionId: getOrCreate(sessionStorage, SESSION_KEY),
  };
}

export function getGrowthContextHeaders() {
  const { anonymousId, sessionId } = identities();
  return {
    "x-growth-anonymous-id": anonymousId,
    "x-growth-session-id": sessionId,
  };
}

function acquisitionContext(path, search) {
  try {
    const existing = sessionStorage.getItem(ACQUISITION_KEY);
    if (existing) return JSON.parse(existing);
    const params = new URLSearchParams(search || "");
    let referrerHost = null;
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : null; } catch { referrerHost = null; }
    const value = {
      landingPage: path || "/",
      referrerHost,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    };
    sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(value));
    return value;
  } catch {
    return { landingPage: path || "/" };
  }
}

function authHeaders() {
  try {
    const auth = JSON.parse(localStorage.getItem("auth") || "null");
    const workspaceId = auth?.user?.workspaceId || auth?.user?.workspace_id;
    return {
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(workspaceId ? { "x-workspace-id": String(workspaceId) } : {}),
    };
  } catch {
    return {};
  }
}

function send(events) {
  const headers = { "Content-Type": "application/json", ...getGrowthContextHeaders(), ...authHeaders() };
  fetch(`${API_BASE_URL}/growth/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ events }),
    keepalive: true,
    credentials: "include",
  }).catch(() => {});
}

export function trackPageView(path, search = "") {
  if (!path || path.startsWith("/superadmin")) return;
  const key = `${path}${search}`;
  const now = Date.now();
  if (lastPageKey === key && now - lastPageAt < 1000) return;
  lastPageKey = key;
  lastPageAt = now;

  const acquisition = acquisitionContext(path, search);
  const shared = {
    ...acquisition,
    occurredAt: new Date().toISOString(),
    properties: {
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    },
  };
  const events = [];
  try {
    if (!sessionStorage.getItem(SESSION_SENT_KEY)) {
      sessionStorage.setItem(SESSION_SENT_KEY, "1");
      events.push({ id: createId(), eventName: "website.session_started", pagePath: path, ...shared });
    }
  } catch {
    // Storage-disabled browsers still send page views.
  }
  events.push({ id: createId(), eventName: "website.page_view", pagePath: path, ...shared });
  send(events);
}
