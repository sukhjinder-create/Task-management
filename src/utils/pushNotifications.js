// src/utils/pushNotifications.js
// Initializes web push (VAPID) and FCM (Capacitor Android).
// Call initPush(token) after login or on app restore.

import { isCapacitor, isWeb } from "./native";
import { API_BASE_URL } from "../api";

// Module-level: token always up-to-date for the registration callback
let _currentAuthToken = null;
// Only register Capacitor listeners once per app session
let _capacitorSetupDone = false;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function fetchVapidKey(authToken) {
  try {
    const res = await fetch(`${API_BASE_URL}/push/vapid-key`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return null;
    const { key } = await res.json();
    return key;
  } catch {
    return null;
  }
}

async function registerFcmTokenWithBackend(fcmToken) {
  if (!_currentAuthToken || !fcmToken) {
    console.warn("[push] registerFcmToken skipped — missing token or auth", { hasAuth: !!_currentAuthToken, hasFcm: !!fcmToken });
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_currentAuthToken}`,
      },
      body: JSON.stringify({ platform: "android", fcmToken }),
    });
    console.log("[push] FCM token registered with backend, status:", res.status, "token:", fcmToken.slice(0, 20));
  } catch (err) {
    console.error("[push] FCM token registration failed:", err.message);
  }
}

async function subscribeWebPush(authToken) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidKey = await fetchVapidKey(authToken);
  if (!vapidKey) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    let sub = await reg.pushManager.getSubscription();
    // Force resubscribe if subscription is expired or missing
    if (sub && sub.expirationTime && sub.expirationTime < Date.now()) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = sub.toJSON();
    // Always re-register with backend to ensure token is current in DB
    await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        platform: "web",
        endpoint: json.endpoint,
        p256dh:   json.keys?.p256dh,
        auth:     json.keys?.auth,
      }),
    });
  } catch (err) {
    console.warn("[push] Web push subscription failed:", err.message);
  }
}

async function _pushDiag(authToken, msg) {
  try {
    await fetch(`${API_BASE_URL}/push/diag`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ msg, ts: Date.now() }),
    });
  } catch {}
}

// Parse a push notification URL and dispatch navigation.
// Navigates to the full URL including ?channel= param so the Chat.jsx URL param
// useEffect can switch the view immediately and reliably.
// coldStart=true adds a delay so React has time to mount its event listeners.
function _handlePushUrl(url, coldStart) {
  const delay = coldStart ? 800 : 0;
  let routePath = url;
  let channelKey = null;
  try {
    const u = new URL(url, "https://app.asystence.com");
    routePath = u.pathname;
    channelKey = u.searchParams.get("channel");
  } catch {}

  // Build the navigation URL — always include ?channel= so React Router exposes it
  const navUrl = (channelKey && routePath === "/chat")
    ? `/chat?channel=${encodeURIComponent(channelKey)}`
    : url;

  window.__PUSH_NAVIGATE__ = navUrl;

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent("push:navigate", { detail: { url: navUrl } }));
  }, delay);
}

async function subscribeCapacitorPush(authToken) {
  try {
    await _pushDiag(authToken, "subscribeCapacitorPush: start");

    // Access plugin via Capacitor bridge (works with remote URL without bundling)
    const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
    if (!PushNotifications) {
      await _pushDiag(authToken, "subscribeCapacitorPush: ERROR plugin not in bridge");
      return;
    }
    await _pushDiag(authToken, "subscribeCapacitorPush: plugin found in bridge");

    const { receive } = await PushNotifications.requestPermissions();
    await _pushDiag(authToken, `subscribeCapacitorPush: permissions=${receive}`);
    if (receive !== "granted") return;

    // Create notification channels with sound + vibration (Android 8+)
    if (window.Capacitor?.getPlatform() === "android") {
      const channels = [
        { id: "default", name: "General Notifications", importance: 5 },
        { id: "chat",    name: "Chat Messages",          importance: 5 },
        { id: "tasks",   name: "Task Updates",            importance: 4 },
        { id: "huddle",  name: "Huddle Calls",            importance: 5 },
      ];
      for (const ch of channels) {
        await PushNotifications.createChannel({ ...ch, sound: "default", vibration: true, visibility: 1 }).catch(() => {});
      }
    }

    // Register listeners ONCE — they use _currentAuthToken via module closure
    if (!_capacitorSetupDone) {
      _capacitorSetupDone = true;

      // Token registration (called on register() and on FCM token refresh)
      PushNotifications.addListener("registration", ({ value: fcmToken }) => {
        registerFcmTokenWithBackend(fcmToken);
      });

      // Foreground: show UI for huddle; skip LocalNotification for chat (WebSocket handles toast)
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        const data = notification.data || {};
        if (data.type === "huddle") {
          window.dispatchEvent(new CustomEvent("huddle:incoming", {
            detail: {
              huddleId: data.huddleId,
              channelId: data.channelId,
              startedByName: data.startedByName || "Someone",
              startedBy: data.startedBy,
            },
          }));
          return;
        }
        // Chat messages are already shown via WebSocket toast — skip LocalNotification
        // For non-chat types (task updates, etc.), show a local notification
        if (data.type === "chat") return;
        import("./native").then(({ showNotification }) => {
          const rawBody = notification.body || "";
          const looksLikeJson = rawBody.trim().startsWith("{") || rawBody.trim().startsWith("[");
          const safeBody = looksLikeJson ? "Sent a message" : rawBody;
          showNotification(notification.title || "Asystence", safeBody);
        });
      });

      // Tap on notification → navigate or show huddle
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = action.notification?.data || {};
        if (data.type === "huddle") {
          const inviteData = {
            huddleId: data.huddleId,
            channelId: data.channelId,
            startedByName: data.startedByName || "Someone",
            startedBy: data.startedBy,
          };
          window.__PENDING_HUDDLE_INVITE__ = inviteData;
          window.dispatchEvent(new CustomEvent("huddle:incoming", { detail: inviteData }));
          return;
        }
        if (data.url) {
          _handlePushUrl(data.url, false);
        }
        // Also dispatch chat:open-channel as a direct backup for Chat.jsx
        if (data.channelId) {
          window.dispatchEvent(new CustomEvent("chat:open-channel", { detail: { channelKey: data.channelId } }));
        } else if (data.url) {
          try {
            const u = new URL(data.url, "https://app.asystence.com");
            const ch = u.searchParams.get("channel");
            if (ch) window.dispatchEvent(new CustomEvent("chat:open-channel", { detail: { channelKey: ch } }));
          } catch {}
        }
      });

      // Launched from killed state
      PushNotifications.getDeliveredNotifications().catch(() => {});
      const launched = await PushNotifications.getLaunchNotification().catch(() => null);
      if (launched?.data) {
        const data = launched.data;
        if (data.type === "huddle") {
          const inviteData = {
            huddleId: data.huddleId,
            channelId: data.channelId,
            startedByName: data.startedByName || "Someone",
            startedBy: data.startedBy,
          };
          window.__PENDING_HUDDLE_INVITE__ = inviteData;
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("huddle:incoming", { detail: inviteData }));
          }, 2000);
        } else if (data.url) {
          // Cold start: React may not be mounted yet — use a delay so event listeners are ready
          _handlePushUrl(data.url, true);
          // Also store channelKey for chat:open-channel fallback
          try {
            const u = new URL(data.url, "https://app.asystence.com");
            const ch = u.searchParams.get("channel");
            if (ch) window.__PENDING_CHAT_CHANNEL__ = ch;
          } catch {}
        }
      }
    }

    // Always call register() so FCM refreshes/confirms the token
    await _pushDiag(authToken, "subscribeCapacitorPush: calling register()");
    await PushNotifications.register();
    await _pushDiag(authToken, "subscribeCapacitorPush: register() done");

  } catch (err) {
    await _pushDiag(authToken, `subscribeCapacitorPush: ERROR ${err.message}`);
    console.warn("[push] Capacitor push setup failed:", err.message);
  }
}

/** Call after login or on app restore with the current JWT auth token. */
export async function initPush(authToken) {
  if (!authToken) return;
  _currentAuthToken = authToken;
  if (isCapacitor) {
    await subscribeCapacitorPush(authToken);
  } else if (isWeb) {
    await subscribeWebPush(authToken);
  }
}

/** Unsubscribe from push notifications on logout. */
export async function teardownPush(authToken) {
  _currentAuthToken = null;
  _capacitorSetupDone = false;
  if (isCapacitor) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    if (authToken) {
      await fetch(`${API_BASE_URL}/push/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch {}
}
