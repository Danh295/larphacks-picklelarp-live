// Sandboxed preload must be CommonJS. Exposes one function to the renderer.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('plarp', {
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen')
});
