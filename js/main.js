// Vanta · Einstieg und Navigation
import { load } from './store.js';
import { icon } from './ui.js';
import { listView } from './views/list.js';
import { formView } from './views/form.js';
import { detailView } from './views/detail.js';
import { statsView } from './views/stats.js';
import { calendarView } from './views/calendar.js';
import { settingsView } from './views/settings.js';

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');

const ROUTES = {
  trades: { view: listView, tab: 'trades' },
  stats: { view: statsView, tab: 'stats' },
  calendar: { view: calendarView, tab: 'calendar' },
  settings: { view: settingsView, tab: 'settings' },
  new: { view: formView, full: true },
  edit: { view: formView, full: true },
  trade: { view: detailView, tab: 'trades' },
};

const TABS = [
  ['trades', 'Trades', 'list'],
  ['stats', 'Statistik', 'stats'],
  ['new', '', 'plus'],
  ['calendar', 'Kalender', 'calendar'],
  ['settings', 'Mehr', 'settings'],
];

export function go(path, replace = false) {
  const h = `#/${path}`;
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
  render();
}

let scrollMemo = {};
let current = '';

export async function render() {
  const raw = location.hash.replace(/^#\/?/, '') || 'trades';
  const [name, ...args] = raw.split('/');
  const route = ROUTES[name] || ROUTES.trades;
  scrollMemo[current] = window.scrollY;
  const sameRoute = current === raw;
  current = raw;

  document.body.classList.toggle('full', !!route.full);
  tabs.innerHTML = route.full
    ? ''
    : TABS.map(([id, label, ic]) =>
        id === 'new'
          ? `<a class="tab-new" href="#/new" aria-label="Neuer Trade">${icon(ic)}</a>`
          : `<a class="tab ${route.tab === id ? 'on' : ''}" href="#/${id}">${icon(ic)}<span>${label}</span></a>`,
      ).join('');

  // Frischer Container pro Ansicht, damit keine alten Listener hängen bleiben
  const view = document.createElement('div');
  view.className = 'view';
  app.replaceChildren(view);
  await route.view(view, ...args);
  // Tabs behalten ihre Scrollposition, alles andere startet oben
  window.scrollTo(0, sameRoute || (!route.full && name !== 'trade') ? scrollMemo[raw] || 0 : 0);
}

window.addEventListener('hashchange', render);

(async () => {
  await load();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
