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
      enableRemoteModule: false,
      webviewTag: true,
      // 允许访问媒体设备（摄像头、麦克风）
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  });
  
  // 在生产环境中，确保权限请求正常工作
  if (app.isPackaged) {
    // 监听权限请求
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      // 允许摄像头和麦克风权限
      if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
        callback(true);
      } else {
        callback(false);
      }
    });
    
    // 监听权限检查结果
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (permission === 'media' || permission === 'camera' || permission === 'microphone') {
        return true;
      }
      return false;
    });
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：根据是否打包使用不同的路径
    const fs = require('fs');
    let indexPath;
    
    if (app.isPackaged) {
      // 打包后的应用
      // 在打包后，dist 文件夹应该在 app.asar 内部，或者与 app.asar 同级
      const appPath = app.getAppPath();
      indexPath = path.join(appPath, 'dist', 'index.html');
      
      // 如果不在 asar 中，尝试其他路径
      if (!fs.existsSync(indexPath)) {
        const alternativePaths = [
          path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html'),
          path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
          path.join(__dirname, '..', 'dist', 'index.html'),
          path.join(__dirname, 'dist', 'index.html')
        ];
        
        for (const altPath of alternativePaths) {
          if (fs.existsSync(altPath)) {
            indexPath = altPath;
            break;
          }
        }
      }
    } else {
      // 未打包，直接使用 __dirname
      indexPath = path.join(__dirname, 'dist', 'index.html');
    }
    
    console.log('生产环境路径信息:', {
      isPackaged: app.isPackaged,
      __dirname,
      appPath: app.getAppPath(),
      indexPath,
      resourcesPath: process.resourcesPath,
      exists: fs.existsSync(indexPath)
    });
    
    // 监听加载错误
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('页面加载失败:', {
        errorCode,
        errorDescription,
        validatedURL,
        indexPath
      });
      // 如果加载失败，打开开发者工具以便调试
      if (!mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools();
      }
    });
    
    // 加载文件
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('无法找到 index.html 文件，路径:', indexPath);
      // 打开开发者工具以便调试
      mainWindow.webContents.openDevTools();
    }
  }
  
  // 打开开发者工具以便调试（生产环境也可以临时打开）
  // mainWindow.webContents.openDevTools();
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
