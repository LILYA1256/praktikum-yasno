import { catalogue } from './catalogue.js';

const { groups, entries } = catalogue;
const groupById = new Map(groups.map(group => [group.id, group]));
const entryById = new Map(entries.map(entry => [entry.id, entry]));
const get = id => document.getElementById(id);
const search = get('search');
const view = get('view');
const reader = get('reader');
const groupNav = get('group-nav');
const cards = get('cards');
const storage = 'atlas-ego-teney';

function loadPreference(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(storage + '-' + key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(storage + '-' + key, JSON.stringify(value));
  } catch {
    // The current session still works if the browser blocks local storage.
  }
}

const saved = new Set(loadPreference('saved', []));
let selectedGroup = '';
let openEntry;
let lastCardButton;
let displayedEntries = [];

function make(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.textContent = content;
  return element;
}

function normalize(text) {
  return text.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
}

const index = new Map(entries.map(entry => {
  const study = entry.relatedStudy;
  const sections = [...entry.sections, ...(study?.sections ?? [])];
  const fields = sections.flatMap(section => [section.title, section.text, ...(section.items ?? [])]);
  return [entry.id, normalize([entry.title, groupById.get(entry.groupId).title, study?.title, ...fields].join(' '))];
}));
for (const group of [{ id: '', title: 'Все проявления' }, ...groups.filter(group => entries.some(entry => entry.groupId === group.id))]) {
  const button = make('button', 'group-button');
  button.type = 'button';
  button.dataset.group = group.id;
  button.textContent = group.title;
  button.addEventListener('click', () => {
    selectedGroup = group.id;
    showCatalogue();
  });
  groupNav.append(button);
}

function buildCard(entry) {
  const item = make('article', 'catalogue-card');
  item.append(make('p', 'card-group', groupById.get(entry.groupId).title));
  const heading = make('h3');
  const button = make('button', 'card-open', entry.title);
  button.type = 'button';
  button.dataset.card = entry.id;
  button.addEventListener('click', () => {
    lastCardButton = button;
    window.location.hash = entry.id;
    showReader(entry);
  });
  heading.append(button);
  item.append(heading);
  const summary = entry.sections[0]?.text;
  if (summary) item.append(make('p', 'card-summary', summary));
  if (entry.relatedStudy) item.append(make('p', 'card-related', 'Авторский разбор · ' + entry.relatedStudy.title));
  if (saved.has(entry.id)) item.append(make('span', 'saved-mark', 'В избранном'));
  return item;
}

function showCatalogue() {
  const group = groupById.get(selectedGroup);
  const terms = normalize(search.value).split(/\s+/).filter(Boolean);
  displayedEntries = entries.filter(entry =>
    (!group || entry.groupId === group.id) &&
    (view.value !== 'saved' || saved.has(entry.id)) &&
    terms.every(term => index.get(entry.id).includes(term))
  );
  for (const button of groupNav.children) {
    button.setAttribute('aria-pressed', String(button.dataset.group === selectedGroup));
  }
  get('catalogue-title').textContent = group?.title ?? 'Все проявления';
  const note = get('group-note');
  note.hidden = !group?.description;
  note.textContent = group?.description ?? '';
  get('results-count').textContent = 'Найдено ' + displayedEntries.length;
  cards.replaceChildren(...displayedEntries.map(buildCard));
  get('empty').hidden = displayedEntries.length > 0;
  get('empty-text').textContent =
    view.value === 'saved' && saved.size === 0 ? 'Избранное пока пусто. Карточку можно сохранить в режиме чтения.' :
    'По выбранным фильтрам ничего не найдено.';
  get('reset').hidden = !(selectedGroup || terms.length || view.value !== 'all');
}

function showSavedState() {
  const isSaved = saved.has(openEntry.id);
  get('save-card').setAttribute('aria-pressed', String(isSaved));
  get('save-label').textContent = isSaved ? 'В избранном' : 'В избранное';
}

function renderSection(section, headingTag) {
  const block = make('section', 'reader-section');
  block.append(make(headingTag, '', section.title));
  if (section.text) block.append(make('p', '', section.text));
  if (section.items?.length) {
    const list = make('ul');
    list.append(...section.items.map(item => make('li', '', item)));
    block.append(list);
  }
  return block;
}

function showRelatedStudy(study) {
  const link = get('study-link');
  const panel = get('card-study');
  link.hidden = panel.hidden = !study;
  panel.replaceChildren();
  if (!study) return;
  link.textContent = 'Читать разбор «' + study.title + '»';
  const title = make('h3', 'study-title', study.title);
  title.tabIndex = -1;
  panel.append(
    make('p', 'card-group', study.source),
    title,
    ...study.sections.map(section => renderSection(section, 'h4'))
  );
}

function showReader(entry) {
  if (reader.open && openEntry === entry) return;
  openEntry = entry;
  get('card-group').textContent = groupById.get(entry.groupId).title;
  get('card-title').textContent = entry.title;
  get('card-sections').replaceChildren(...entry.sections.map(section => renderSection(section, 'h3')));
  get('card-source').textContent = entry.source ?? '';
  showRelatedStudy(entry.relatedStudy);
  const position = displayedEntries.indexOf(entry);
  get('reader-nav').hidden = position === -1 || displayedEntries.length < 2;
  get('previous').disabled = position <= 0;
  get('next').disabled = position >= displayedEntries.length - 1;
  showSavedState();
  if (!reader.open) reader.showModal();
  reader.scrollTop = 0;
}

function syncReader() {
  const entry = entryById.get(window.location.hash.slice(1));
  if (entry) showReader(entry);
  else if (reader.open) reader.close();
}

function moveReader(step) {
  const target = displayedEntries[displayedEntries.indexOf(openEntry) + step];
  if (!target) return;
  window.history.replaceState(null, '', '#' + target.id);
  showReader(target);
}

function setLargeText(enabled) {
  reader.classList.toggle('large-text', enabled);
  get('large-text').setAttribute('aria-pressed', String(enabled));
}

search.addEventListener('input', showCatalogue);
view.addEventListener('change', showCatalogue);
get('reset').addEventListener('click', () => {
  search.value = '';
  view.value = 'all';
  selectedGroup = '';
  showCatalogue();
  search.focus();
});
get('close-reader').addEventListener('click', () => reader.close());
get('study-link').addEventListener('click', () => {
  const title = get('card-study').querySelector('.study-title');
  title.scrollIntoView({ block: 'start' });
  title.focus({ preventScroll: true });
});
get('previous').addEventListener('click', () => moveReader(-1));
get('next').addEventListener('click', () => moveReader(1));
get('save-card').addEventListener('click', () => {
  const id = openEntry.id;
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  savePreference('saved', [...saved]);
  showSavedState();
});
get('large-text').addEventListener('click', () => {
  const enabled = !reader.classList.contains('large-text');
  savePreference('large-text', enabled);
  setLargeText(enabled);
});
reader.addEventListener('close', () => {
  const id = openEntry.id;
  if (window.location.hash === '#' + id) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  openEntry = undefined;
  showCatalogue();
  if (lastCardButton) {
    const button = cards.querySelector('[data-card="' + id + '"]');
    (button ?? search).focus({ preventScroll: true });
    lastCardButton = undefined;
  }
});
window.addEventListener('hashchange', syncReader);
document.addEventListener('keydown', event => {
  if (event.key === '/' && !reader.open && !event.ctrlKey && !event.metaKey &&
      !event.target.closest?.('input, select, textarea, [contenteditable]')) {
    event.preventDefault();
    search.focus();
  }
});

setLargeText(loadPreference('large-text', false));
showCatalogue();
syncReader();
