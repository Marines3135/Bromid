const tabsElement = document.querySelector('#tabs');
const address = document.querySelector('#address');
const back = document.querySelector('#back');
const forward = document.querySelector('#forward');
const settingsDialog = document.querySelector('#settings-dialog');
const settingsForm = document.querySelector('#settings-form');
const homePage = document.querySelector('#home-page');
const searchEngine = document.querySelector('#search-engine');
const theme = document.querySelector('#theme');
let latestState = { tabs: [], activeTabId: null };
let hasReceivedTabs = false;
const tabAppearances = new Map();

function applyTheme(value) {
  document.documentElement.dataset.theme = value;
}

function fillSettings(value) {
  homePage.value = value.homePage;
  searchEngine.value = value.searchEngine;
  theme.value = value.theme;
  applyTheme(value.theme);
}

function render(state) {
  const oldIds = new Set(latestState.tabs.map((tab) => tab.id));
  if (hasReceivedTabs) {
    for (const tab of state.tabs) {
      if (!oldIds.has(tab.id)) {
        tabAppearances.set(tab.id, Date.now() + 360);
        setTimeout(() => {
          tabAppearances.delete(tab.id);
          if (latestState.tabs.some((current) => current.id === tab.id)) render(latestState);
        }, 370);
      }
    }
  }
  latestState = state;
  hasReceivedTabs = true;
  const active = state.tabs.find((tab) => tab.id === state.activeTabId);
  address.value = active?.url || '';
  back.disabled = !active?.canGoBack;
  forward.disabled = !active?.canGoForward;
  tabsElement.replaceChildren(...state.tabs.map((tab) => {
    const item = document.createElement('div');
    item.className = `tab ${tab.id === state.activeTabId ? 'active' : ''} ${tabAppearances.has(tab.id) ? 'appearing' : ''}`;
    item.title = tab.title;
    const icon = document.createElement('img');
    icon.className = 'tab-logo';
    icon.src = '../assets/bromid-logo.png';
    icon.alt = '';
    const text = document.createElement('span');
    text.textContent = tab.loading ? `◌ ${tab.title}` : tab.title;
    const close = document.createElement('button');
    close.textContent = '×'; close.title = 'Закрыть вкладку';
    close.addEventListener('click', (event) => { event.stopPropagation(); window.browser.closeTab(tab.id); });
    item.append(icon, text, close);
    item.addEventListener('click', () => window.browser.switchTab(tab.id));
    return item;
  }));
}

document.querySelector('#navigation').addEventListener('submit', (event) => {
  event.preventDefault();
  window.browser.navigate(address.value);
});
document.querySelector('#new-tab').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.classList.remove('creating');
  void button.offsetWidth;
  button.classList.add('creating');
  window.browser.newTab();
});
document.querySelector('#reload').addEventListener('click', () => window.browser.reload());
document.querySelector('#menu').addEventListener('click', () => window.browser.showMenu());
document.querySelector('#close-settings').addEventListener('click', () => settingsDialog.close());
document.querySelector('#reset-settings').addEventListener('click', () => fillSettings({ homePage: 'https://www.google.com', searchEngine: 'google', theme: 'dark' }));
settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const saved = await window.browser.saveSettings({ homePage: homePage.value, searchEngine: searchEngine.value, theme: theme.value });
  fillSettings(saved);
  settingsDialog.close();
});
back.addEventListener('click', () => window.browser.back());
forward.addEventListener('click', () => window.browser.forward());
window.browser.onTabs(render);
window.browser.onFocusAddress(() => { address.focus(); address.select(); });
window.browser.onSettingsChanged(fillSettings);
window.browser.getSettings().then(fillSettings);
