// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('moyuAPI', {
  showSafe: () => ipcRenderer.send('show-safe'),
  hideSafe: () => ipcRenderer.send('hide-safe')
});
