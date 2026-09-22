// Web Push subscription lifecycle for the browser client.

import { API_BASE_URL } from "../api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function fetchVapidKey() {
  try {
    const response = await fetch(`${API_BASE_URL}/push/vapid-key`, {
      credentials: "include",
      headers: { "X-Auth-Mode": "cookie" },
    });
    if (!response.ok) return null;
    const { key } = await response.json();
    return key;
  } catch {
    return null;
  }
}

async function subscribeWebPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidKey = await fetchVapidKey();
  if (!vapidKey) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    let subscription = await registration.pushManager.getSubscription();
    if (
      subscription?.expirationTime &&
      subscription.expirationTime < Date.now()
    ) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = subscription.toJSON();
    await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Mode": "cookie",
      },
      body: JSON.stringify({
        platform: "web",
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });
  } catch (error) {
    console.warn("[push] Web push subscription failed:", error.message);
  }
}

export async function initPush() {
  await subscribeWebPush();
}

export async function teardownPush() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch(`${API_BASE_URL}/push/unsubscribe`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Auth-Mode": "cookie" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});
  } catch {
    // Push cleanup should never block logout.
  }
}
