// main.js
const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let safeWindow = null;
let safeVisible = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // 打开调试控制台
  mainWindow.webContents.openDevTools();
}

function createSafeWindow() {
  safeWindow = new BrowserWindow({
    show: false,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      contextIsolation: true
    }
  });

  safeWindow.loadFile(path.join(__dirname, 'assets', 'safe_page.html'));
  safeWindow.on('closed', () => { safeWindow = null; });
}

function toggleSafeWindow() {
  if (!safeWindow) return;
  safeVisible = !safeVisible;
  if (safeVisible) {
    safeWindow.show();
    safeWindow.focus();
  } else {
    safeWindow.hide();
    if (mainWindow) mainWindow.focus();
  }
}

app.whenReady().then(() => {
  createMainWindow();
  // 不再在启动时创建 safeWindow，只在需要时创建

  // 注册老板键（CommandOrControl+Shift+X）
  const registered = globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleSafeWindow();
  });
  if (!registered) {
    console.warn('globalShortcut registration failed');
  }

  // 注册切换开发者工具的快捷键（F12 或 CommandOrControl+Shift+I）
  const devToolsRegistered1 = globalShortcut.register('F12', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });
  const devToolsRegistered2 = globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });
  if (!devToolsRegistered1 && !devToolsRegistered2) {
    console.warn('DevTools shortcut registration failed');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC from renderer
ipcMain.on('show-safe', () => {
  if (!safeWindow) {
    createSafeWindow();
  }
  safeVisible = true;
  safeWindow.show();
  safeWindow.focus();
});

ipcMain.on('hide-safe', () => {
  if (!safeWindow) return;
  safeVisible = false;
  safeWindow.hide();
  if (mainWindow) mainWindow.focus();
});
