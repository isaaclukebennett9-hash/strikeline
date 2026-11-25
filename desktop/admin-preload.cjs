// Bridges the Strikeline Admin page to its main process (desktop/admin.cjs) without exposing Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('admin', {
  state: () => ipcRenderer.invoke('adm-state'),
  cmd: (m) => ipcRenderer.invoke('adm-cmd', m),
  log: (f) => ipcRenderer.invoke('adm-log', f),
  openFolder: () => ipcRenderer.invoke('adm-open-folder'),
  copy: (t) => ipcRenderer.invoke('adm-copy', t),
});
