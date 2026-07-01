import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function packageNameFromId(id) {
  const normalizedId = id.replace(/\\/g, "/");
  const nodeModulesIndex = normalizedId.lastIndexOf("/node_modules/");
  if (nodeModulesIndex === -1) return "";
  const parts = normalizedId.slice(nodeModulesIndex + "/node_modules/".length).split("/");
  if (!parts[0]) return "";
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1] || ""}` : parts[0];
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react-quill"],
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          const packageName = packageNameFromId(id);
          if (!packageName) return undefined;
          if (["react", "react-dom", "scheduler"].includes(packageName)) {
            return "vendor-react";
          }
          if (packageName === "livekit-client") {
            return "vendor-livekit-client";
          }
          if (packageName.startsWith("@livekit/")) {
            return "vendor-livekit-components";
          }
          if (packageName === "jspdf") {
            return "vendor-jspdf";
          }
          if (packageName === "html2canvas") {
            return "vendor-html2canvas";
          }
          if (packageName === "dompurify") {
            return "vendor-sanitize";
          }
          if (["react-router", "react-router-dom", "@remix-run/router"].includes(packageName)) {
            return "vendor-router";
          }
          if (packageName === "lucide-react") {
            return "vendor-icons";
          }
          if (["axios", "socket.io-client", "engine.io-client", "socket.io-parser", "engine.io-parser"].includes(packageName)) {
            return "vendor-network";
          }
          if (packageName === "recharts") {
            return "vendor-recharts";
          }
          if (packageName === "react-select") {
            return "vendor-select";
          }
          if (["react-quill", "quill", "parchment"].includes(packageName)) {
            return "vendor-editor";
          }
          return "vendor";
        },
      },
    },
  },
})
