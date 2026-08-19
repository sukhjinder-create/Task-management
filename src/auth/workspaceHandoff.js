// src/auth/workspaceHandoff.js
//
// Moving a signed-in session from app.<domain> to <slug>.<domain>.
//
// Those are separate origins, so localStorage does not follow the user across
// the redirect and the session has to be re-established on arrival. The
// tempting way to do that is to put the tokens in the redirect URL -- which is
// what this app used to do (`?_t=<jwt>&_r=<refresh>`). URLs end up in browser
// history, in Referer headers, and in every access log between the user and the
// app, so that hands out long-lived credentials to anywhere those are read.
//
// Instead the redirect carries an opaque code that is single-use and expires in
// about a minute, and the real tokens are fetched over POST on arrival. A code
// recovered from a log is already spent or already dead.

import { API_BASE_URL, WORKSPACE_DOMAIN, buildWorkspaceRedirectUrl } from "../config/runtime";

// Deliberately not named like the old `_t`: anything still producing those is a
// bug, and a distinct name makes that obvious rather than silently compatible.
const HANDOFF_PARAM = "_hc";

/**
 * Build the URL that moves this session to `slug`'s subdomain.
 *
 * Returns null when the handoff cannot be arranged -- no workspace domain
 * configured, or the code request failed. Callers must treat null as "stay
 * here": the app is fully functional on the primary host, so a failed handoff
 * should cost the user nothing. Falling back to putting tokens in the URL
 * would trade a minor inconvenience for the exact leak this exists to avoid.
 */
export async function buildWorkspaceHandoffUrl(slug, path, token) {
  if (!slug || !token) return null;

  // Cheap early exit: if no workspace domain is configured there is nowhere to
  // send anyone, and we should not spend a round trip finding that out.
  if (!buildWorkspaceRedirectUrl(slug, path || "/projects")) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/handoff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;

    const { code } = await response.json();
    if (!code) return null;

    return buildWorkspaceRedirectUrl(slug, path || "/projects", { [HANDOFF_PARAM]: code });
  } catch {
    return null;
  }
}

/** Is there a handoff code waiting in the current URL? */
export function hasPendingHandoff(search = window.location.search) {
  return new URLSearchParams(search).has(HANDOFF_PARAM);
}

/**
 * Strip the code from the address bar.
 *
 * Done before the network call, not after: a single-use code is spent the
 * moment it is redeemed, and leaving it in the URL invites a refresh that
 * fails confusingly. Also keeps it out of the history entry.
 */
function scrubHandoffParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete(HANDOFF_PARAM);
  // Legacy token params. Nothing produces these any more; clearing them means
  // an old bookmark cannot leave credentials sitting in the address bar.
  params.delete("_t");
  params.delete("_r");
  params.delete("_u");

  const search = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
}

/**
 * Redeem the code in the URL for a session.
 *
 * Returns { user, token, refreshToken } on success, or null if there was no
 * code or it could not be redeemed -- in which case the caller should carry on
 * with whatever session it already had, which is normally none, leaving the
 * user at the login screen.
 */
export async function consumeWorkspaceHandoff() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get(HANDOFF_PARAM);
  if (!code) return null;

  scrubHandoffParam();

  try {
    const response = await fetch(`${API_BASE_URL}/auth/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.token || !data?.user) return null;

    return { user: data.user, token: data.token, refreshToken: data.refreshToken || null };
  } catch {
    return null;
  }
}

export { HANDOFF_PARAM };

/**
 * The workspace slug implied by the hostname, or null if this is not a
 * workspace host.
 *
 * `acme.asystence.com` -> "acme"; `app.asystence.com` and the apex -> null.
 */
export function workspaceSlugFromHost(hostname = window.location.hostname) {
  const domain = String(WORKSPACE_DOMAIN || "").trim().toLowerCase();
  if (!domain) return null;

  const host = String(hostname || "").toLowerCase();
  if (!host.endsWith(`.${domain}`)) return null;

  const label = host.slice(0, -1 * (domain.length + 1));
  // Multi-label hosts are not workspaces, and reserved hosts are not either.
  if (!label || label.includes(".")) return null;
  if (["app", "www", "api", "api-tunnel"].includes(label)) return null;

  return label;
}

/**
 * Is this session on the wrong workspace host?
 *
 * A user whose workspace is `1801` can end up sitting on
 * `apyhub.asystence.com` -- by an old bookmark, a shared link, or simply
 * signing in there. Their data is never at risk (the API scopes every request
 * from the JWT, not the hostname), but the address bar names someone else's
 * workspace, which is alarming and looks exactly like a leak.
 */
export function isOnWrongWorkspaceHost(userSlug, hostname = window.location.hostname) {
  const hostSlug = workspaceSlugFromHost(hostname);
  if (!hostSlug || !userSlug) return false;
  return hostSlug !== String(userSlug).toLowerCase();
}
