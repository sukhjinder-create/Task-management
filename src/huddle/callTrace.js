import api from "../api";

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function currentClientSurface() {
  if (typeof window === "undefined") return "web";
  try {
    return window.matchMedia?.("(max-width: 767px)")?.matches
      ? "mobile_browser"
      : "web";
  } catch {
    return "web";
  }
}

export async function recordHuddleCallTrace({
  step,
  huddleId,
  channelId,
  sessionId,
  status = "observed",
  reason = null,
  metadata = {},
} = {}) {
  const resolvedStep = safeString(step);
  const resolvedHuddleId = safeString(huddleId);
  if (!resolvedStep || !resolvedHuddleId) return;
  try {
    await api.post("/huddle/call-trace/events", {
      step: resolvedStep,
      huddleId: resolvedHuddleId,
      channelId: safeString(channelId) || null,
      sessionId: safeString(sessionId) || resolvedHuddleId,
      platform: "web",
      clientSurface: currentClientSurface(),
      status,
      ...(reason ? { reason } : {}),
      metadata: {
        ...metadata,
        visibilityState: typeof document !== "undefined" ? document.visibilityState : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
    });
  } catch {
    // Diagnostics only; never block call setup.
  }
}

export function normalizeHuddleInvitePayload(input = {}) {
  const extra = input.extraData && typeof input.extraData === "object" ? input.extraData : {};
  const data = { ...input, ...extra };
  const channelId = safeString(data.channelId || data.channel_id);
  const huddleId = safeString(data.huddleId || data.huddle_id);
  if (!channelId || !huddleId) return null;
  const startedByName = safeString(data.startedByName || data.started_by_name) || "Someone";
  const startedById = safeString(data.startedBy || data.started_by || data.startedByUserId || data.started_by_user_id);
  return {
    huddleId,
    channelId,
    sessionId: safeString(data.sessionId || data.session_id) || huddleId,
    provider: safeString(data.provider || data.providerType || data.provider_type) || null,
    startedByName,
    startedBy: {
      userId: startedById || null,
      username: startedByName,
    },
    at: data.at || new Date().toISOString(),
    source: data.source || "push",
  };
}

export function publishIncomingHuddleFromPayload(payload = {}, source = "push") {
  if (typeof window === "undefined") return null;
  const invite = normalizeHuddleInvitePayload({ ...payload, source });
  if (!invite) return null;
  window.__PENDING_HUDDLE_INVITE__ = invite;
  window.dispatchEvent(new CustomEvent("huddle:incoming", { detail: invite }));
  return invite;
}

export function readPendingHuddleInviteFromUrl() {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search || "");
    const huddleId = params.get("huddleId") || params.get("huddle_id") || params.get("huddle");
    const channelId = params.get("channel") || params.get("channelId") || params.get("channel_id");
    if (!huddleId || !channelId) return null;
    return normalizeHuddleInvitePayload({
      huddleId,
      channelId,
      sessionId: params.get("sessionId") || params.get("session_id") || huddleId,
      startedBy: params.get("startedBy") || params.get("started_by"),
      startedByName: params.get("startedByName") || params.get("started_by_name") || "Someone",
      provider: params.get("provider"),
      source: "push_url",
    });
  } catch {
    return null;
  }
}
