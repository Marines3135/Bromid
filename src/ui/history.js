const entries = document.querySelector('#entries');

function render(items) {
  entries.replaceChildren();
  if (!items.length) {
    entries.append(document.querySelector('#empty').content.cloneNode(true));
    return;
  }
  for (const item of items) {
    const button = document.createElement('button');
    button.className = 'entry';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const url = document.createElement('span');
    url.textContent = item.url;
    const date = document.createElement('time');
    date.textContent = new Date(item.visitedAt).toLocaleString('ru-RU');
    button.append(title, url, date);
    button.addEventListener('click', () => window.browser.navigateHistoryItem(item.url));
    entries.append(button);
  }
}

document.querySelector('#clear').addEventListener('click', () => window.browser.clearHistory());
window.browser.getHistory().then(render);
window.browser.onHistoryChanged(render);
