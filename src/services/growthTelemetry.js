import { API_BASE_URL } from "../config/runtime";

const ANONYMOUS_KEY = "growth_anonymous_id";
const SESSION_KEY = "growth_session_id";
const SESSION_SENT_KEY = "growth_session_started";
const ACQUISITION_KEY = "growth_acquisition";
let lastPageKey = null;
let lastPageAt = 0;

const CLIENT_PRODUCT_EVENTS = new Set([
  "product.feature_viewed",
  "product.feature_used",
  "product.action_clicked",
  "product.session_flow_step",
  "product.friction_detected",
  "product.abandonment_detected",
  "product.search_performed",
  "product.search_result_clicked",
  "product.ai_feature_used",
  "product.recommendation_viewed",
  "product.recommendation_actioned",
  "product.explainability_opened",
  "product.workflow_viewed",
  "product.workflow_actioned",
  "product.dashboard_viewed",
  "product.onboarding_step",
]);

const SAFE_PROPERTY_KEYS = new Set([
  "feature_name",
  "surface",
  "screen",
  "route",
  "from_path",
  "to_path",
  "section",
  "tab",
  "component",
  "action_name",
  "action_type",
  "workflow_name",
  "workflow_step",
  "workflow_status",
  "recommendation_action",
  "recommendation_surface",
  "explain_subject",
  "search_scope",
  "query_length",
  "result_count",
  "result_type",
  "rank",
  "duration_ms",
  "idle_ms",
  "hesitation_ms",
  "click_count",
  "step_count",
  "path_length",
  "completion_time_ms",
  "abandoned_after_ms",
  "success",
  "reason",
  "error_code",
  "is_keyboard",
  "is_quick_exit",
]);

const FEATURE_PATH_RULES = [
  [/^\/dashboard(?:\/|$)/, "Dashboard"],
  [/^\/projects?(?:\/|$)/, "Projects"],
  [/^\/tasks?(?:\/|$)/, "Tasks"],
  [/^\/sprints?(?:\/|$)/, "Sprint Management"],
  [/^\/time(?:\/|$)|^\/timesheets?(?:\/|$)/, "Time Tracking"],
  [/^\/chat(?:\/|$)/, "Chat"],
  [/^\/huddles?(?:\/|$)/, "Huddles"],
  [/^\/meetings?(?:\/|$)|^\/meeting-intelligence(?:\/|$)/, "Meeting Intelligence"],
  [/^\/executive-summary(?:\/|$)|^\/summaries(?:\/|$)/, "Executive Summary"],
  [/^\/enterprise-intelligence(?:\/|$)|^\/workspace-intelligence(?:\/|$)/, "Workspace Intelligence"],
  [/^\/adaptive(?:\/|$)/, "Adaptive Runtime"],
  [/^\/autopilot(?:\/|$)/, "Autopilot"],
  [/^\/testing-agent(?:\/|$)/, "Testing Agent"],
  [/^\/search(?:\/|$)|^\/operations\/search(?:\/|$)/, "Workspace Search"],
  [/^\/wiki(?:\/|$)|^\/knowledge(?:\/|$)/, "Wiki"],
  [/^\/okr(?:\/|$)|^\/okrs(?:\/|$)/, "OKRs"],
  [/^\/reviews?(?:\/|$)/, "Reviews"],
  [/^\/attendance(?:\/|$)/, "Attendance"],
  [/^\/leave(?:\/|$)/, "Leave"],
  [/^\/reports?(?:\/|$)/, "Reports"],
  [/^\/notifications?(?:\/|$)/, "Notifications"],
  [/^\/integrations?(?:\/|$)/, "Integrations"],
  [/^\/billing(?:\/|$)|^\/plans?(?:\/|$)/, "Billing"],
  [/^\/onboarding(?:\/|$)|^\/welcome(?:\/|$)/, "Onboarding"],
];

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

function cleanPath(path) {
  if (!path) return "/";
  try {
    const parsed = new URL(path, window.location.origin);
    return parsed.pathname || "/";
  } catch {
    return String(path).split(/[?#]/)[0].slice(0, 500) || "/";
  }
}

function safeNumber(value, max = 1_000_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(0, Math.min(max, Math.round(number)));
}

function safeString(value, max = 120) {
  if (value === undefined || value === null) return undefined;
  const cleaned = String(value).trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function safeProperties(properties = {}) {
  const result = {};
  for (const [key, value] of Object.entries(properties || {})) {
    if (!SAFE_PROPERTY_KEYS.has(key)) continue;
    if (typeof value === "boolean") result[key] = value;
    else if (typeof value === "number") {
      const safe = safeNumber(value);
      if (safe !== undefined) result[key] = safe;
    } else if (typeof value === "string") {
      const safe = safeString(value);
      if (safe !== undefined) result[key] = safe;
    }
  }
  return result;
}

function send(events) {
  if (!events?.length) return;
  const headers = { "Content-Type": "application/json", ...getGrowthContextHeaders(), ...authHeaders() };
  fetch(`${API_BASE_URL}/growth/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ events }),
    keepalive: true,
    credentials: "include",
  }).catch(() => {});
}

export function featureNameForPath(path = "/") {
  const clean = cleanPath(path);
  const match = FEATURE_PATH_RULES.find(([pattern]) => pattern.test(clean));
  if (match) return match[1];
  const firstSegment = clean.split("/").filter(Boolean)[0];
  if (!firstSegment) return "Home";
  return firstSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

export function trackProductEvent(eventName, properties = {}, options = {}) {
  if (!CLIENT_PRODUCT_EVENTS.has(eventName)) return;
  const path = cleanPath(options.pagePath || window.location.pathname);
  if (path.startsWith("/superadmin")) return;
  const acquisition = acquisitionContext(path, window.location.search);
  send([{
    id: createId(),
    eventName,
    pagePath: path,
    entityType: safeString(options.entityType, 80),
    entityId: safeString(options.entityId, 160),
    ...acquisition,
    occurredAt: new Date().toISOString(),
    properties: safeProperties({
      feature_name: featureNameForPath(path),
      route: path,
      ...properties,
    }),
  }]);
}

export function trackFeatureViewed(path = window.location.pathname, properties = {}) {
  const clean = cleanPath(path);
  const eventName = featureNameForPath(clean) === "Dashboard" ? "product.dashboard_viewed" : "product.feature_viewed";
  trackProductEvent(eventName, {
    feature_name: featureNameForPath(clean),
    surface: featureNameForPath(clean),
    route: clean,
    ...properties,
  }, { pagePath: clean });
}

export function trackSessionFlowStep({ path, fromPath, toPath, durationMs, clickCount, pathLength }) {
  const clean = cleanPath(path);
  trackProductEvent("product.session_flow_step", {
    feature_name: featureNameForPath(clean),
    surface: featureNameForPath(clean),
    route: clean,
    from_path: cleanPath(fromPath || clean),
    to_path: toPath ? cleanPath(toPath) : undefined,
    duration_ms: durationMs,
    click_count: clickCount,
    path_length: pathLength,
  }, { pagePath: clean });
}

export function trackAbandonment({ path, durationMs, clickCount, pathLength, reason = "quick_exit" }) {
  const clean = cleanPath(path);
  trackProductEvent("product.abandonment_detected", {
    feature_name: featureNameForPath(clean),
    surface: featureNameForPath(clean),
    route: clean,
    abandoned_after_ms: durationMs,
    duration_ms: durationMs,
    click_count: clickCount,
    path_length: pathLength,
    reason,
    is_quick_exit: durationMs < 5000,
  }, { pagePath: clean });
}

export function trackFrictionDetected({ path, reason, hesitationMs, idleMs, clickCount, pathLength }) {
  const clean = cleanPath(path);
  trackProductEvent("product.friction_detected", {
    feature_name: featureNameForPath(clean),
    surface: featureNameForPath(clean),
    route: clean,
    reason,
    hesitation_ms: hesitationMs,
    idle_ms: idleMs,
    click_count: clickCount,
    path_length: pathLength,
  }, { pagePath: clean });
}

export function trackActionClicked({ path, actionName, actionType, component, toPath, hesitationMs, clickCount, isKeyboard }) {
  const clean = cleanPath(path);
  trackProductEvent("product.action_clicked", {
    feature_name: featureNameForPath(clean),
    surface: featureNameForPath(clean),
    route: clean,
    action_name: actionName,
    action_type: actionType,
    component,
    to_path: toPath ? cleanPath(toPath) : undefined,
    hesitation_ms: hesitationMs,
    click_count: clickCount,
    is_keyboard: Boolean(isKeyboard),
  }, { pagePath: clean });
}

export function trackSearchPerformed({ path = window.location.pathname, queryLength = 0, resultCount, searchScope = "workspace" } = {}) {
  const clean = cleanPath(path);
  trackProductEvent("product.search_performed", {
    feature_name: "Workspace Search",
    surface: featureNameForPath(clean),
    route: clean,
    search_scope: searchScope,
    query_length: queryLength,
    result_count: resultCount,
  }, { pagePath: clean, entityType: "search" });
}

export function trackRecommendationUsage({ path = window.location.pathname, action = "viewed", surface = "Adaptive Recommendations" } = {}) {
  const clean = cleanPath(path);
  trackProductEvent(action === "viewed" ? "product.recommendation_viewed" : "product.recommendation_actioned", {
    feature_name: "Adaptive Recommendations",
    surface,
    route: clean,
    recommendation_action: action,
    recommendation_surface: surface,
  }, { pagePath: clean, entityType: "recommendation" });
}

export function trackExplainabilityOpened({ path = window.location.pathname, subject = "recommendation" } = {}) {
  const clean = cleanPath(path);
  trackProductEvent("product.explainability_opened", {
    feature_name: "Explainability",
    surface: featureNameForPath(clean),
    route: clean,
    explain_subject: subject,
  }, { pagePath: clean });
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
