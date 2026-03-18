// vite.electron.config.js
// Used when building for Electron (npm run electron:build)
// Sets base to './' so file:// paths resolve correctly in the packaged app.
// The original vite.config.js is untouched and still used for web builds.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",                  // ← critical for Electron file:// loading
  optimizeDeps: {
    include: ["react-quill"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
