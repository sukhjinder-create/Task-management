// electron/main.cjs
// Electron main process — wraps the existing React web app for desktop (Mac + Windows)
// CommonJS format required because Electron does not support ESM named imports.
// The React frontend code is completely untouched.

const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain, Notification } = require("electron");
const path = require("path");
const fs   = require("fs");

const isDev  = process.env.NODE_ENV === "development" || process.env.ELECTRON_DEV === "true";
const isMac  = process.platform === "darwin";
const isWin  = process.platform === "win32";
const rendererUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";

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

// ─── App icon helper ──────────────────────────────────────────────────────────
function getAppIcon() {
  const iconFile = isWin ? "icon.ico" : isMac ? "icon.icns" : "icon.png";
  const iconPath = path.join(__dirname, "../public", iconFile);

  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }

  return nativeImage.createEmpty();
}

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
    title:           "Proxima",
    titleBarStyle:   isMac ? "hiddenInset" : "default",
    backgroundColor: "#0f172a",
    show:            false,
    icon:            getAppIcon(),
    webPreferences: {
      preload:           path.join(__dirname, "preload.cjs"),
      contextIsolation:  true,
      nodeIntegration:   false,
      webSecurity:       true,
    },
  });

  if (state.isMaximized) mainWindow.maximize();

  if (isDev) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isMac) app.dock && app.dock.show();
  });

  mainWindow.on("close", () => saveWindowState(mainWindow));

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
  tray.setToolTip("Proxima");

  const menu = Menu.buildFromTemplate([
    { label: "Open Proxima", click: () => { mainWindow && mainWindow.show(); mainWindow && mainWindow.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.on("double-click", () => { mainWindow && mainWindow.show(); mainWindow && mainWindow.focus(); });
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow && mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (e, url) => {
    const allow = url.startsWith("http://localhost") || url.startsWith("file://");
    if (!allow) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
});
