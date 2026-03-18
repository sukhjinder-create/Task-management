// capacitor.config.ts
// Capacitor configuration for iOS + Android mobile apps.
// TypeScript format is natively supported by Capacitor CLI regardless of package.json "type".

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.taskmanager.app",
  appName: "Task Manager",
  webDir: "dist-mobile",

  server: {
    cleartext: true,          // allow HTTP in dev (Android requires this for localhost)
    allowNavigation: ["*"],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0f172a",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },

    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f172a",
      overlaysWebView: false,
    },

    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,  // disable before release build
  },

  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
  },
};

export default config;
