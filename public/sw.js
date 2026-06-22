// public/sw.js - Web Push service worker.
// Receives push events and preserves Huddle metadata so notification clicks can
// open the incoming-call UI, not just navigate to chat.

function mergePushData(data) {
  const extra = data && typeof data.extraData === "object" ? data.extraData : {};
  return { ...(data || {}), ...extra };
}

function huddleAwareUrl(rawUrl, data) {
  const merged = mergePushData(data || {});
  const base = rawUrl || merged.url || "/";
  try {
    const url = new URL(base, self.location.origin);
    if (merged.type === "huddle" || merged.huddleId || merged.huddle_id) {
      if (merged.channelId || merged.channel_id) {
        url.searchParams.set("channel", merged.channelId || merged.channel_id);
      }
      if (merged.huddleId || merged.huddle_id) {
        url.searchParams.set("huddleId", merged.huddleId || merged.huddle_id);
      }
      if (merged.sessionId || merged.session_id) {
        url.searchParams.set("sessionId", merged.sessionId || merged.session_id);
      }
      if (merged.startedBy || merged.started_by) {
        url.searchParams.set("startedBy", merged.startedBy || merged.started_by);
      }
      if (merged.startedByName || merged.started_by_name) {
        url.searchParams.set("startedByName", merged.startedByName || merged.started_by_name);
      }
      if (merged.provider) url.searchParams.set("provider", merged.provider);
      url.searchParams.set("huddleIncoming", "1");
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return base;
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Notification", body: event.data.text(), url: "/" };
  }

  const merged = mergePushData(data);
  const title = data.title || "Asystence";
  const url = huddleAwareUrl(data.url || "/", merged);
  const options = {
    body: data.body || "",
    icon: "/asystence-logo.png?v=vivid-orange-2026-06-08",
    data: { ...merged, url },
    tag: merged.huddleId ? `huddle:${merged.huddleId}` : data.type || "general",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";
  const isHuddle = data.type === "huddle" || Boolean(data.huddleId || data.huddle_id);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if (isHuddle && "postMessage" in client) {
            client.postMessage({ type: "huddle:notification-click", payload: data });
          }
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
