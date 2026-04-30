// src/utils/native.js
// Unified native bridge — transparently routes to the right platform:
//   • Capacitor  (iOS / Android)
//   • Electron   (Mac / Windows desktop)
//   • Browser    (plain web — graceful no-ops)
//
// Import and call these helpers anywhere in the app.
// No platform checks needed at call-site.

// ─── Detect platform ──────────────────────────────────────────────────────────
export const isElectron   = typeof window !== "undefined" && !!window.electronAPI;
export const isCapacitor  = typeof window !== "undefined" && !!window.Capacitor;
export const isMobile     = isCapacitor;
export const isDesktop    = isElectron;
export const isWeb        = !isElectron && !isCapacitor;

// ─── Capacitor bridge helpers ────────────────────────────────────────────────
// All Capacitor plugins accessed via window.Capacitor.Plugins (native bridge).
// Dynamic import("@capacitor/...") won't work when packages are Vite-externalized
// and the app loads from a remote URL in the WebView.

function capPlugin(name) {
  return window.Capacitor?.Plugins?.[name] ?? null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * Show a local push notification (Capacitor) or OS notification (Electron).
 * Falls back to console.log in browser.
 */
export async function showNotification(title, body) {
  if (isElectron) {
    window.electronAPI.showNotification(title, body);
    return;
  }
  if (isCapacitor) {
    const LocalNotifications = capPlugin("LocalNotifications");
    if (LocalNotifications) {
      try {
        await LocalNotifications.schedule({
          notifications: [{ id: Math.floor(Math.random() * 100000), title, body }],
        });
      } catch { /* ignore */ }
    }
    return;
  }
  // Browser: use Web Notifications API if permitted
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

/**
 * Request push notification permission (Capacitor + browser).
 * Returns true if granted.
 */
export async function requestNotificationPermission() {
  if (isCapacitor) {
    const PushNotifications = capPlugin("PushNotifications");
    if (PushNotifications) {
      try {
        const result = await PushNotifications.requestPermissions();
        return result.receive === "granted";
      } catch { return false; }
    }
    return false;
  }
  if (typeof Notification !== "undefined") {
    const result = await Notification.requestPermission();
    return result === "granted";
  }
  return false;
}

// ─── Navigation / Deep-links ──────────────────────────────────────────────────

/**
 * Open a URL externally (system browser / OS handler).
 */
export function openExternal(url) {
  if (isElectron) {
    window.electronAPI.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

// ─── Haptics ─────────────────────────────────────────────────────────────────

/**
 * Light haptic feedback tap. No-op on non-mobile.
 */
export async function hapticTap() {
  if (!isCapacitor) return;
  const Haptics = capPlugin("Haptics");
  if (Haptics) {
    try { await Haptics.impact({ style: "LIGHT" }); } catch { /* ignore */ }
  }
}

/**
 * Medium haptic feedback (e.g. task completed, drag-drop).
 */
export async function hapticMedium() {
  if (!isCapacitor) return;
  const Haptics = capPlugin("Haptics");
  if (Haptics) {
    try { await Haptics.impact({ style: "MEDIUM" }); } catch { /* ignore */ }
  }
}

// ─── Status bar ───────────────────────────────────────────────────────────────

/**
 * Set status bar style. Call once on app init.
 */
export async function initStatusBar() {
  if (!isCapacitor) return;
  const StatusBar = capPlugin("StatusBar");
  if (StatusBar) {
    try {
      await StatusBar.setStyle({ style: "DARK" });
      await StatusBar.setBackgroundColor({ color: "#0f172a" });
    } catch { /* ignore */ }
  }
}

// ─── Splash screen ───────────────────────────────────────────────────────────

/**
 * Hide the native splash screen. Call after app has loaded.
 */
export async function hideSplash() {
  if (!isCapacitor) return;
  const SplashScreen = capPlugin("SplashScreen");
  if (SplashScreen) {
    try { await SplashScreen.hide(); } catch { /* ignore */ }
  }
}

// ─── Persistent storage (replaces localStorage for mobile reliability) ────────

/**
 * Save a value. Falls back to localStorage on web/electron.
 */
export async function storageSet(key, value) {
  if (isCapacitor) {
    const Preferences = capPlugin("Preferences");
    if (Preferences) {
      try { await Preferences.set({ key, value: JSON.stringify(value) }); return; } catch { /* fallthrough */ }
    }
  }
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Get a value. Falls back to localStorage on web/electron.
 */
export async function storageGet(key) {
  if (isCapacitor) {
    const Preferences = capPlugin("Preferences");
    if (Preferences) {
      try {
        const { value } = await Preferences.get({ key });
        return value ? JSON.parse(value) : null;
      } catch { /* fallthrough */ }
    }
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Remove a value.
 */
export async function storageRemove(key) {
  if (isCapacitor) {
    const Preferences = capPlugin("Preferences");
    if (Preferences) {
      try { await Preferences.remove({ key }); return; } catch { /* fallthrough */ }
    }
  }
  localStorage.removeItem(key);
}

// ─── App back-button handler (Android) ───────────────────────────────────────

/**
 * Register Android hardware back button handler.
 * Pass a callback; returns an unsubscribe function.
 * No-op on iOS/desktop.
 */
export async function onBackButton(callback) {
  if (!isCapacitor) return () => {};
  const App = capPlugin("App");
  if (App) {
    try {
      const handle = await App.addListener("backButton", callback);
      return () => handle.remove();
    } catch { /* ignore */ }
  }
  return () => {};
}

// ─── Platform info ────────────────────────────────────────────────────────────

/**
 * Returns "ios" | "android" | "electron" | "web"
 */
export function getPlatform() {
  if (isElectron)  return window.electronAPI.platform === "darwin" ? "macos" : "windows";
  if (isCapacitor) return window.Capacitor.getPlatform(); // "ios" | "android"
  return "web";
}
