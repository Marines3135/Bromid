const { app, BrowserWindow, BrowserView, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

let window;
let settingsWindow;
let historyWindow;
let nextTabId = 1;
const tabs = new Map();
let activeTabId = null;
let historyEntries = [];
let bookmarks = [];
const HISTORY_LIMIT = 500;
const HOME_PAGE_PATH = path.join(__dirname, 'ui', 'home.html');
const HOME_PAGE_URL = pathToFileURL(HOME_PAGE_PATH).href;
const APP_ICON = path.join(__dirname, 'assets', 'bromid-logo.png');
const DEFAULT_BOOKMARKS = [
  { title: 'Google', url: 'https://www.google.com', icon: 'G' },
  { title: 'Яндекс', url: 'https://ya.ru', icon: 'Я' },
  { title: 'YouTube', url: 'https://www.youtube.com', icon: '▶' },
  { title: 'GitHub', url: 'https://github.com', icon: '⌘' },
  { title: 'Wikipedia', url: 'https://wikipedia.org', icon: 'W' },
  { title: 'Почта', url: 'https://mail.google.com', icon: '✉' }
];

const TOOLBAR_HEIGHT = 94;
const DEFAULT_SETTINGS = {
  homePage: 'https://www.google.com',
  searchEngine: 'google',
  theme: 'dark'
};
const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=',
  yandex: 'https://ya.ru/search/?text=',
  duckduckgo: 'https://duckduckgo.com/?q='
};
let settings = { ...DEFAULT_SETTINGS };

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    settings = { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function historyPath() {
  return path.join(app.getPath('userData'), 'history.json');
}

function loadHistory() {
  try {
    const saved = JSON.parse(fs.readFileSync(historyPath(), 'utf8'));
    historyEntries = Array.isArray(saved) ? saved.slice(0, HISTORY_LIMIT) : [];
  } catch {
    historyEntries = [];
  }
}

function saveHistory() {
  fs.writeFileSync(historyPath(), JSON.stringify(historyEntries), 'utf8');
}

function bookmarksPath() {
  return path.join(app.getPath('userData'), 'bookmarks.json');
}

function sanitizeBookmarks(incoming) {
  if (!Array.isArray(incoming)) return [];
  return incoming.slice(0, 24).flatMap((item) => {
    try {
      const url = new URL(String(item?.url || '').trim());
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      const title = String(item?.title || url.hostname).trim().slice(0, 64) || url.hostname;
      const icon = String(item?.icon || title[0] || 'B').trim().slice(0, 2) || 'B';
      return [{ title, url: url.href, icon }];
    } catch {
      return [];
    }
  });
}

function loadBookmarks() {
  try {
    bookmarks = sanitizeBookmarks(JSON.parse(fs.readFileSync(bookmarksPath(), 'utf8')));
  } catch {
    bookmarks = DEFAULT_BOOKMARKS;
  }
}

function saveBookmarks() {
  fs.writeFileSync(bookmarksPath(), JSON.stringify(bookmarks, null, 2), 'utf8');
}

function sendHistory() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.webContents.send('history:changed', historyEntries);
  }
}

function recordHistory(contents) {
  const url = contents.getURL();
  if (!/^https?:\/\//i.test(url)) return;
  const entry = { url, title: contents.getTitle() || url, visitedAt: Date.now() };
  historyEntries = historyEntries.filter((item) => item.url !== url);
  historyEntries.unshift(entry);
  historyEntries = historyEntries.slice(0, HISTORY_LIMIT);
  saveHistory();
  sendHistory();
}

function normalizeUrl(input) {
  const value = String(input || '').trim();
  if (!value) return settings.homePage;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  if (/\s/.test(value) || !value.includes('.')) {
    return `${SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google}${encodeURIComponent(value)}`;
  }
  return `https://${value}`;
}

function tabState(tab) {
  const contents = tab.view.webContents;
  const currentUrl = contents.getURL();
  return {
    id: tab.id,
    title: contents.getTitle() || 'Новая вкладка',
    url: currentUrl.startsWith(HOME_PAGE_URL) ? '' : currentUrl,
    loading: contents.isLoading(),
    canGoBack: contents.canGoBack(),
    canGoForward: contents.canGoForward()
  };
}

function sendTabs() {
  if (!window || window.isDestroyed()) return;
  window.webContents.send('browser:tabs', {
    tabs: [...tabs.values()].map(tabState),
    activeTabId
  });
}

function layoutActiveView() {
  for (const [id, tab] of tabs) {
    if (id === activeTabId) {
      window.setBrowserView(tab.view);
      const [width, height] = window.getContentSize();
      tab.view.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
      tab.view.setAutoResize({ width: true, height: true });
    }
  }
}

function createTab(url = null, activate = true) {
  const id = nextTabId++;
  const view = new BrowserView({
  webPreferences: {
      preload: path.join(__dirname, 'home-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  const tab = { id, view };
  tabs.set(id, tab);

  const update = () => sendTabs();
  view.webContents.on('did-start-loading', update);
  view.webContents.on('did-stop-loading', () => { update(); recordHistory(view.webContents); });
  view.webContents.on('page-title-updated', update);
  view.webContents.on('did-navigate', update);
  view.webContents.on('did-navigate-in-page', update);
  view.webContents.setWindowOpenHandler(({ url: target }) => {
    createTab(target, true);
    return { action: 'deny' };
  });
  view.webContents.on('will-navigate', (event, target) => {
    if (/^(mailto:|tel:)/i.test(target)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  if (url === null || url === undefined) {
    view.webContents.loadFile(HOME_PAGE_PATH).catch(() => {});
  } else {
    view.webContents.loadURL(normalizeUrl(url)).catch(() => {});
  }

  if (activate) switchTab(id);
  else sendTabs();
  return id;
}

function switchTab(id) {
  if (!tabs.has(id)) return;
  activeTabId = id;
  layoutActiveView();
  sendTabs();
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  const ids = [...tabs.keys()];
  const index = ids.indexOf(id);
  tabs.delete(id);
  tab.view.webContents.close();
  if (activeTabId === id) {
    activeTabId = tabs.size ? [...tabs.keys()][Math.max(0, index - 1)] : null;
    if (activeTabId) layoutActiveView();
  else createTab();
  }
  sendTabs();
}

function activeContents() {
  return tabs.get(activeTabId)?.view.webContents;
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 500,
    title: 'Bromid',
    icon: APP_ICON,
    backgroundColor: '#180000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  window.loadFile(path.join(__dirname, 'ui', 'index.html'));
  window.on('resize', layoutActiveView);
  window.on('closed', () => { window = null; });
  window.webContents.on('before-input-event', (event, input) => {
    const ctrl = input.control || input.meta;
    if (ctrl && input.key.toLowerCase() === 'l') { event.preventDefault(); window.webContents.send('browser:focus-address'); }
    if (ctrl && input.key.toLowerCase() === 't') { event.preventDefault(); createTab(); }
    if (ctrl && input.key.toLowerCase() === 'w') { event.preventDefault(); closeTab(activeTabId); }
    if (ctrl && input.key.toLowerCase() === 'r') { event.preventDefault(); activeContents()?.reload(); }
    if (input.alt && input.key === 'Left') { event.preventDefault(); activeContents()?.goBack(); }
    if (input.alt && input.key === 'Right') { event.preventDefault(); activeContents()?.goForward(); }
  });
  createTab();
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 440,
    height: 390,
    minWidth: 440,
    maxWidth: 440,
    minHeight: 390,
    maxHeight: 390,
    resizable: false,
    modal: true,
    parent: window,
    title: 'Настройки Bromid',
    icon: APP_ICON,
    backgroundColor: '#300001',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  settingsWindow.removeMenu();
  settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }
  historyWindow = new BrowserWindow({
    width: 650,
    height: 620,
    minWidth: 460,
    minHeight: 400,
    title: 'История Bromid',
    icon: APP_ICON,
    backgroundColor: '#180000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  historyWindow.removeMenu();
  historyWindow.loadFile(path.join(__dirname, 'ui', 'history.html'));
  historyWindow.on('closed', () => { historyWindow = null; });
}

function createApplicationMenu() {
  Menu.setApplicationMenu(null);
}

function showBrowserMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Новая вкладка', accelerator: 'Ctrl+T', click: () => createTab() },
    { label: 'Закрыть вкладку', accelerator: 'Ctrl+W', click: () => closeTab(activeTabId) },
    { type: 'separator' },
    { label: 'Назад', accelerator: 'Alt+Left', click: () => activeContents()?.canGoBack() && activeContents().goBack() },
    { label: 'Вперёд', accelerator: 'Alt+Right', click: () => activeContents()?.canGoForward() && activeContents().goForward() },
    { label: 'Перезагрузить', accelerator: 'Ctrl+R', click: () => activeContents()?.reload() },
    { type: 'separator' },
    { label: 'История', click: createHistoryWindow },
    { label: 'Очистить историю', click: () => { historyEntries = []; saveHistory(); sendHistory(); } },
    { label: 'Настройки', click: createSettingsWindow },
    { type: 'separator' },
    { label: 'Полный экран', click: () => window?.setFullScreen(!window.isFullScreen()) },
    { label: 'Выход', click: () => app.quit() }
  ]);
  menu.popup({ window });
}

ipcMain.handle('browser:new-tab', (_, url) => createTab(url));
ipcMain.handle('browser:switch-tab', (_, id) => switchTab(id));
ipcMain.handle('browser:close-tab', (_, id) => closeTab(id));
ipcMain.handle('browser:navigate', (_, input) => activeContents()?.loadURL(normalizeUrl(input)).catch(() => {}));
ipcMain.handle('browser:back', () => activeContents()?.canGoBack() && activeContents().goBack());
ipcMain.handle('browser:forward', () => activeContents()?.canGoForward() && activeContents().goForward());
ipcMain.handle('browser:reload', () => activeContents()?.reload());
ipcMain.handle('browser:show-menu', showBrowserMenu);
ipcMain.handle('settings:open', createSettingsWindow);
ipcMain.handle('settings:close', () => settingsWindow?.close());
ipcMain.handle('history:open', createHistoryWindow);
ipcMain.handle('history:get', () => historyEntries);
ipcMain.handle('history:clear', () => {
  historyEntries = [];
  saveHistory();
  sendHistory();
});
ipcMain.handle('history:navigate', (_, url) => createTab(url, true));
ipcMain.handle('bookmarks:get', () => bookmarks);
ipcMain.handle('bookmarks:save', (_, incoming) => {
  bookmarks = sanitizeBookmarks(incoming);
  saveBookmarks();
  return bookmarks;
});
ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:save', (_, incoming) => {
  const homePage = String(incoming?.homePage || '').trim();
  settings = {
    homePage: /^https?:\/\//i.test(homePage) ? homePage : DEFAULT_SETTINGS.homePage,
    searchEngine: SEARCH_ENGINES[incoming?.searchEngine] ? incoming.searchEngine : DEFAULT_SETTINGS.searchEngine,
    theme: incoming?.theme === 'light' ? 'light' : 'dark'
  };
  saveSettings();
  window?.webContents.send('settings:changed', settings);
  return settings;
});

app.whenReady().then(() => {
  loadSettings();
  loadHistory();
  loadBookmarks();
  createApplicationMenu();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
