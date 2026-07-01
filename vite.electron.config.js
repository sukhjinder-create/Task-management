// vite.electron.config.js
// Used when building for Electron. It keeps file:// assets relative and
// injects the API URL only from environment configuration.

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl =
    env.VITE_API_BASE_URL ||
    env.VITE_API_URL ||
    env.VITE_BACKEND_URL ||
    "";

  return {
    plugins: [react()],
    base: "./",
    define: apiUrl
      ? {
          "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
          "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiUrl),
        }
      : {},
    optimizeDeps: {
      include: ["react-quill"],
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
