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

// ─── Lazy Capacitor plugin imports ────────────────────────────────────────────
// We import lazily so the bundle doesn't break when running in Electron/browser
// where Capacitor plugins are not present.

async function cap(pluginName) {
  if (!isCapacitor) return null;
  try {
    const { [pluginName]: plugin } = await import("@capacitor/" + pluginName.toLowerCase().replace(/([A-Z])/g, (m, c, i) => i ? "-" + c.toLowerCase() : c.toLowerCase()));
    return plugin ?? null;
  } catch {
    return null;
  }
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
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [{
          id:    Math.floor(Math.random() * 100000),
          title,
          body,
        }],
      });
    } catch {
      // LocalNotifications not available — skip silently
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
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const result = await PushNotifications.requestPermissions();
      return result.receive === "granted";
    } catch { return false; }
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
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch { /* ignore */ }
}

/**
 * Medium haptic feedback (e.g. task completed, drag-drop).
 */
export async function hapticMedium() {
  if (!isCapacitor) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch { /* ignore */ }
}

// ─── Status bar ───────────────────────────────────────────────────────────────

/**
 * Set status bar style. Call once on app init.
 */
export async function initStatusBar() {
  if (!isCapacitor) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0f172a" });
  } catch { /* ignore */ }
}

// ─── Splash screen ───────────────────────────────────────────────────────────

/**
 * Hide the native splash screen. Call after app has loaded.
 */
export async function hideSplash() {
  if (!isCapacitor) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch { /* ignore */ }
}

// ─── Persistent storage (replaces localStorage for mobile reliability) ────────

/**
 * Save a value. Falls back to localStorage on web/electron.
 */
export async function storageSet(key, value) {
  if (isCapacitor) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key, value: JSON.stringify(value) });
      return;
    } catch { /* fallthrough */ }
  }
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Get a value. Falls back to localStorage on web/electron.
 */
export async function storageGet(key) {
  if (isCapacitor) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch { /* fallthrough */ }
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Remove a value.
 */
export async function storageRemove(key) {
  if (isCapacitor) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key });
      return;
    } catch { /* fallthrough */ }
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
  try {
    const { App } = await import("@capacitor/app");
    const handle = await App.addListener("backButton", callback);
    return () => handle.remove();
  } catch {
    return () => {};
  }
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
