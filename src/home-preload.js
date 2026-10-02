const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('bromidBookmarks', {
    get: () => ipcRenderer.invoke('bookmarks:get'),
    save: (bookmarks) => ipcRenderer.invoke('bookmarks:save', bookmarks)
  });
}
