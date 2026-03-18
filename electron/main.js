// electron/main.js
// Electron main process — wraps the existing React web app for desktop (Mac + Windows)
// The React frontend code is completely untouched.

import { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, Notification } from "electron";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const isDev  = process.env.NODE_ENV === "development" || process.env.ELECTRON_DEV === "true";
const isMac  = process.platform === "darwin";
const isWin  = process.platform === "win32";

// ─── Window state persistence ─────────────────────────────────────────────────
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

function loadWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch (_) {}
  return { width: 1280, height: 800, x: undefined, y: undefined, isMaximized: false };
}

function saveWindowState(win) {
  try {
    const bounds = win.getBounds();
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      ...bounds,
      isMaximized: win.isMaximized(),
    }));
  } catch (_) {}
}

// ─── Globals ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;

// ─── Create main window ───────────────────────────────────────────────────────
function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width:           state.width,
    height:          state.height,
    x:               state.x,
    y:               state.y,
    minWidth:        900,
    minHeight:       600,
    title:           "Task Manager",
    titleBarStyle:   isMac ? "hiddenInset" : "default",
    backgroundColor: "#0f172a",
    show:            false, // show after ready-to-show to avoid flash
    icon:            getAppIcon(),
    webPreferences: {
      preload:           path.join(__dirname, "preload.js"),
      contextIsolation:  true,
      nodeIntegration:   false,
      webSecurity:       true,
    },
  });

  // Restore maximized state
  if (state.isMaximized) mainWindow.maximize();

  // Load the app
  if (isDev) {
    // Development: load Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // Production: load built files
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready to prevent white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isMac) app.dock?.show();
  });

  // Save window state on close
  mainWindow.on("close", () => saveWindowState(mainWindow));

  // Open external links in browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") && !url.includes("localhost")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── System tray ──────────────────────────────────────────────────────────────
function createTray() {
  const icon = getAppIcon();
  if (!icon) return;

  tray = new Tray(icon);
  tray.setToolTip("Task Manager");

  const menu = Menu.buildFromTemplate([
    { label: "Open Task Manager", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.on("double-click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── App icon helper ──────────────────────────────────────────────────────────
function getAppIcon() {
  const iconFile = isWin ? "icon.ico" : isMac ? "icon.icns" : "icon.png";
  const iconPath = path.join(__dirname, "../public", iconFile);

  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }

  // Fallback: create a simple placeholder icon (16x16 indigo square)
  return nativeImage.createEmpty();
}

// ─── macOS menu ───────────────────────────────────────────────────────────────
function setAppMenu() {
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    }] : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [
          { type: "separator" },
          { role: "front" },
        ] : [
          { role: "close" },
        ]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC: native notifications from renderer ──────────────────────────────────
ipcMain.on("show-notification", (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: getAppIcon() }).show();
  }
});

// ─── IPC: open external URL ───────────────────────────────────────────────────
ipcMain.on("open-external", (_, url) => {
  shell.openExternal(url);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setAppMenu();
  createWindow();
  createTray();

  app.on("activate", () => {
    // macOS: re-create window when clicking dock icon with no windows
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

// Quit when all windows closed (Windows/Linux)
app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

// Security: prevent navigation to external sites
app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (e, url) => {
    const allow = url.startsWith("http://localhost") || url.startsWith("file://");
    if (!allow) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
});
