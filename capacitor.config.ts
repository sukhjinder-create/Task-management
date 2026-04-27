// capacitor.config.ts
// Capacitor configuration for iOS + Android mobile apps.
// TypeScript format is natively supported by Capacitor CLI regardless of package.json "type".

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.proxima.app",
  appName: "Asystence",
  webDir: "dist-mobile",

  server: {
    // Load web assets from the production Vercel deployment so mobile always
    // runs the latest web code without needing an APK rebuild.
    url: "https://app.asystence.com",
    cleartext: false,
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
