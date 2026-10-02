const homePage = document.querySelector('#home-page');
const searchEngine = document.querySelector('#search-engine');
const theme = document.querySelector('#theme');
const defaults = { homePage: 'https://www.google.com', searchEngine: 'google', theme: 'dark' };

function fill(settings) {
  homePage.value = settings.homePage;
  searchEngine.value = settings.searchEngine;
  theme.value = settings.theme;
}

window.browser.getSettings().then(fill);
document.querySelector('#reset').addEventListener('click', () => fill(defaults));
document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  await window.browser.saveSettings({ homePage: homePage.value, searchEngine: searchEngine.value, theme: theme.value });
  window.browser.closeSettings();
});
