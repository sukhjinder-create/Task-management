// electron/preload.cjs
// Secure bridge between the Electron main process and the React renderer.
// CommonJS format required — Electron loads preload scripts as CommonJS.
// Only explicitly exposed APIs are available — no full Node.js access.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Platform detection
  platform: process.platform,
  isElectron: true,

  // Trigger a native OS notification (used by notification system)
  showNotification: (title, body) => {
    ipcRenderer.send("show-notification", { title, body });
  },

  // Open a URL in the system default browser
  openExternal: (url) => {
    ipcRenderer.send("open-external", url);
  },
});
