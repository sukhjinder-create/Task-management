// vite.electron.config.js
// Used when building for Electron (npm run electron:build)
// Sets base to './' so file:// paths resolve correctly in the packaged app.
// The original vite.config.js is untouched and still used for web builds.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",                  // ← critical for Electron file:// loading
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify("https://asystence-api-616077735050.asia-south1.run.app"),
  },
  optimizeDeps: {
    include: ["react-quill"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
