// vite.capacitor.config.js
// Vite build config for Capacitor mobile (iOS + Android).
// base "./" is required so that asset paths resolve correctly inside the WebView.
// Output goes to dist-mobile/ to keep separate from web and electron builds.
// Loads .env.mobile so VITE_API_URL points to the correct backend for mobile builds.

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Merge standard env + .env.mobile overrides
  const env = {
    ...loadEnv(mode, process.cwd()),
    ...loadEnv("mobile", process.cwd(), ""),
  };

  return {
    plugins: [react()],
    base: "./",
    optimizeDeps: {
      include: ["react-quill"],
    },
    build: {
      outDir: "dist-mobile",
      emptyOutDir: true,
    },
    define: {
      "import.meta.env.VITE_API_URL":     JSON.stringify(env.VITE_API_URL     || "http://10.0.2.2:3000"),
      "import.meta.env.VITE_BACKEND_URL": JSON.stringify(env.VITE_BACKEND_URL || env.VITE_API_URL || "http://10.0.2.2:3000"),
      __CAPACITOR__: JSON.stringify(true),
    },
  };
});
