// Vanta · Einstieg und Navigation
import { load } from './store.js';
import { icon } from './ui.js';
import { homeView } from './views/home.js';
import { listView } from './views/list.js';
import { formView } from './views/form.js';
import { detailView } from './views/detail.js';
import { statsView } from './views/stats.js';
import { calendarView } from './views/calendar.js';
import { settingsView } from './views/settings.js';

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');

const ROUTES = {
  home: { view: homeView, tab: 'home' },
  trades: { view: listView, tab: 'trades' },
  stats: { view: statsView, tab: 'stats' },
  calendar: { view: calendarView, tab: 'calendar' },
  settings: { view: settingsView, tab: 'home' },
  new: { view: formView, full: true },
  edit: { view: formView, full: true },
  trade: { view: detailView, tab: 'trades' },
};

const TABS = [
  ['home', 'Home', 'home'],
  ['trades', 'Trades', 'list'],
  ['new', '', 'plus'],
  ['stats', 'Statistik', 'stats'],
  ['calendar', 'Kalender', 'calendar'],
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
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, ...args] = raw.split('/');
  const route = ROUTES[name] || ROUTES.home;
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
    // Neue Version übernimmt sofort: einmal neu laden, wenn ein Update aktiv wird
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
  }
})();
