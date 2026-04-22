// src/utils/pushNotifications.js
// Initializes web push (VAPID) and FCM (Capacitor Android).
// Call initPush(token) after login.

import { isCapacitor, isWeb } from "./native";
import { API_BASE_URL } from "../api";

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

    await PushNotifications.register();

    PushNotifications.addListener("registration", async ({ value: fcmToken }) => {
      try {
        await fetch(`${API_BASE_URL}/push/subscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            platform: "android",
            fcmToken,
          }),
        });
      } catch {}
    });

    // Handle foreground notifications (show local notification)
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      import("./native").then(({ showNotification }) => {
        showNotification(notification.title || "Asystence", notification.body || "");
      });
    });

    // Handle notification tap → navigate
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (url && typeof window !== "undefined") {
        window.__PUSH_NAVIGATE__ = url;
        window.dispatchEvent(new CustomEvent("push:navigate", { detail: { url } }));
      }
    });
  } catch (err) {
    console.warn("[push] Capacitor push setup failed:", err.message);
  }
}

/** Call once after login with the JWT auth token. */
export async function initPush(authToken) {
  if (!authToken) return;
  if (isCapacitor) {
    await subscribeCapacitorPush(authToken);
  } else if (isWeb) {
    await subscribeWebPush(authToken);
  }
}

/** Unsubscribe from push notifications on logout. */
export async function teardownPush(authToken) {
  if (isCapacitor) return; // Capacitor: token removed on backend via logout
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
