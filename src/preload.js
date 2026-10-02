const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browser', {
  newTab: (url) => ipcRenderer.invoke('browser:new-tab', url),
  switchTab: (id) => ipcRenderer.invoke('browser:switch-tab', id),
  closeTab: (id) => ipcRenderer.invoke('browser:close-tab', id),
  navigate: (input) => ipcRenderer.invoke('browser:navigate', input),
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  showMenu: () => ipcRenderer.invoke('browser:show-menu'),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  closeSettings: () => ipcRenderer.invoke('settings:close'),
  openHistory: () => ipcRenderer.invoke('history:open'),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  navigateHistoryItem: (url) => ipcRenderer.invoke('history:navigate', url),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onTabs: (callback) => ipcRenderer.on('browser:tabs', (_, state) => callback(state)),
  onFocusAddress: (callback) => ipcRenderer.on('browser:focus-address', callback),
  onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (_, settings) => callback(settings)),
  onHistoryChanged: (callback) => ipcRenderer.on('history:changed', (_, entries) => callback(entries))
});
