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
  if (!_currentAuthToken || !fcmToken) return;
  try {
    await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_currentAuthToken}`,
      },
      body: JSON.stringify({ platform: "android", fcmToken }),
    });
  } catch {}
}

async function subscribeWebPush(authToken) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidKey = await fetchVapidKey(authToken);
  if (!vapidKey) return;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = sub.toJSON();
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

async function subscribeCapacitorPush(authToken) {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const { receive } = await PushNotifications.requestPermissions();
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

      // Foreground: show UI for huddle or native notification for others
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
        import("./native").then(({ showNotification }) => {
          showNotification(notification.title || "Asystence", notification.body || "");
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
        const url = data.url;
        if (url) {
          window.__PUSH_NAVIGATE__ = url;
          window.dispatchEvent(new CustomEvent("push:navigate", { detail: { url } }));
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
          window.__PUSH_NAVIGATE__ = data.url;
        }
      }
    }

    // Always call register() so FCM refreshes/confirms the token
    await PushNotifications.register();

  } catch (err) {
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
