const shortcuts = document.querySelector('#shortcuts');
const manage = document.querySelector('#manage');
const editor = document.querySelector('#editor');
const form = document.querySelector('#bookmark-form');
const titleInput = document.querySelector('#bookmark-title');
const urlInput = document.querySelector('#bookmark-url');
let bookmarks = [];
let editing = false;
let editedIndex = null;

function iconFor(bookmark) { return bookmark.icon || bookmark.title.trim()[0] || 'B'; }

function openEditor(index = null) {
  editedIndex = index;
  const bookmark = index === null ? { title: '', url: '' } : bookmarks[index];
  document.querySelector('#editor-title').textContent = index === null ? 'Новая закладка' : 'Изменить закладку';
  titleInput.value = bookmark.title;
  urlInput.value = bookmark.url;
  editor.showModal();
  titleInput.focus();
}

async function persist() {
  bookmarks = await window.bromidBookmarks.save(bookmarks);
  render();
}

function render() {
  shortcuts.replaceChildren();
  for (const [index, bookmark] of bookmarks.entries()) {
    const card = document.createElement(editing ? 'div' : 'a');
    card.className = 'shortcut';
    if (!editing) card.href = bookmark.url;
    const icon = document.createElement('i');
    icon.textContent = iconFor(bookmark);
    const name = document.createElement('span');
    name.textContent = bookmark.title;
    card.append(icon, name);
    if (editing) {
      const actions = document.createElement('div');
      actions.className = 'shortcut-actions';
      const change = document.createElement('button'); change.type = 'button'; change.textContent = 'Изменить'; change.addEventListener('click', () => openEditor(index));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; remove.textContent = 'Удалить'; remove.addEventListener('click', async () => { bookmarks.splice(index, 1); await persist(); });
      actions.append(change, remove); card.append(actions);
    }
    shortcuts.append(card);
  }
  if (editing && bookmarks.length < 24) {
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'shortcut add'; add.innerHTML = '<i>+</i><span>Добавить</span>';
    add.addEventListener('click', () => openEditor());
    shortcuts.append(add);
  }
  manage.textContent = editing ? 'Готово' : 'Изменить';
}

manage.addEventListener('click', () => { editing = !editing; render(); });
document.querySelector('#cancel').addEventListener('click', () => editor.close());
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const bookmark = { title: titleInput.value.trim(), url: urlInput.value.trim(), icon: titleInput.value.trim()[0] || 'B' };
  if (editedIndex === null) bookmarks.push(bookmark); else bookmarks[editedIndex] = bookmark;
  await persist();
  editor.close();
});

window.bromidBookmarks.get().then((saved) => { bookmarks = saved; render(); });
