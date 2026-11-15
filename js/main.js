// Vanta · Einstieg und Navigation
import { load } from './store.js';
import { icon } from './ui.js';
import { calm, stagger, countUps, haptic } from './fx.js';
import { homeView } from './views/home.js';
import { listView } from './views/list.js';
import { formView } from './views/form.js';
import { detailView } from './views/detail.js';
import { statsView } from './views/stats.js';
import { calendarView } from './views/calendar.js';
import { settingsView } from './views/settings.js';
import { reviewView, reviewsView } from './views/review.js';

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
  review: { view: reviewView, full: true },
  reviews: { view: reviewsView, tab: 'home' },
};

const TABS = [
  ['home', 'Home', 'home'],
  ['trades', 'Trades', 'list'],
  ['new', '', 'plus'],
  ['stats', 'Statistik', 'stats'],
  ['calendar', 'Kalender', 'calendar'],
];
const SLOT = { home: 0, trades: 1, stats: 3, calendar: 4 };
const DEPTH = { trade: 1, settings: 1, reviews: 1, new: 2, edit: 2, review: 2 };
const MODAL = new Set(['new', 'edit', 'review']);

export function go(path, replace = false) {
  const h = `#/${path}`;
  if (replace) history.replaceState(null, '', h);
  else history.pushState(null, '', h);
  render();
}

function renderTabs(route) {
  if (!tabs.dataset.built) {
    tabs.innerHTML = `<span class="tab-ind" aria-hidden="true"></span>${TABS.map(([id, label, ic]) =>
      id === 'new'
        ? `<div class="tab-slot"><a class="tab-new" href="#/new" aria-label="Neuer Trade">${icon(ic)}</a></div>`
        : `<a class="tab" data-tab="${id}" href="#/${id}">${icon(ic)}<span>${label}</span></a>`,
    ).join('')}`;
    tabs.dataset.built = '1';
    tabs.addEventListener('click', (e) => e.target.closest('a') && haptic());
  }
  tabs.querySelectorAll('.tab').forEach((a) => a.classList.toggle('on', a.dataset.tab === route.tab));
  tabs.style.setProperty('--slot', SLOT[route.tab] ?? 0);
}

// Richtung des Übergangs aus Tiefe und Tab-Reihenfolge
function direction(from, to) {
  if (!from) return 'none';
  const df = DEPTH[from] || 0;
  const dt = DEPTH[to] || 0;
  if (dt > df) return MODAL.has(to) ? 'up' : 'push';
  if (dt < df) return MODAL.has(from) ? 'down' : 'pop';
  if (df === 0 && from !== to) return (SLOT[ROUTES[to]?.tab] ?? 0) > (SLOT[ROUTES[from]?.tab] ?? 0) ? 'left' : 'right';
  return from === to ? 'none' : 'fade';
}

let scrollMemo = {};
let current = '';
let currentName = '';
let activeVT = null;

export async function render() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, ...args] = raw.split('/');
  const route = ROUTES[name] || ROUTES.home;
  const key = ROUTES[name] ? name : 'home';
  scrollMemo[current] = window.scrollY;
  const sameRoute = current === raw;
  const dir = sameRoute ? 'none' : direction(currentName, key);
  current = raw;
  currentName = key;

  // Offene Sheets und Bildansicht gehören zur alten Seite
  document.querySelectorAll('.sheet-wrap').forEach((w) => w.close?.());
  document.querySelectorAll('.lightbox').forEach((l) => l.remove());

  const swap = async () => {
    document.body.classList.toggle('full', !!route.full);
    renderTabs(route);
    // Frischer Container pro Ansicht, damit keine alten Listener hängen bleiben
    const view = document.createElement('div');
    view.className = 'view';
    if (!document.startViewTransition && dir !== 'none' && !calm()) view.classList.add(`nav-${dir}`);
    app.replaceChildren(view);
    await route.view(view, ...args);
    // Tabs behalten ihre Scrollposition, alles andere startet oben
    window.scrollTo(0, sameRoute || (!route.full && key !== 'trade') ? scrollMemo[raw] || 0 : 0);
    if (!sameRoute) {
      stagger(view);
      countUps(view);
    }
  };

  if (document.startViewTransition && dir !== 'none' && !calm() && document.visibilityState === 'visible') {
    // Laufenden Übergang abbrechen, sonst wirft der Browser bei schnellem Tippen
    activeVT?.skipTransition();
    document.documentElement.dataset.nav = dir;
    const vt = document.startViewTransition(swap);
    activeVT = vt;
    vt.ready.catch(() => {});
    vt.finished.catch(() => {}).then(() => activeVT === vt && (activeVT = null));
    await vt.updateCallbackDone.catch(() => {});
  } else {
    await swap();
  }
}

// Kopfzeile bekommt beim Scrollen eine Linie
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 4), { passive: true });

// Start-Animation: einmal pro Sitzung
function splash() {
  const el = document.getElementById('splash');
  if (!el) return Promise.resolve();
  let seen = false;
  try {
    seen = sessionStorage.getItem('vanta.splash') === '1';
    sessionStorage.setItem('vanta.splash', '1');
  } catch {}
  if (seen || calm()) {
    el.remove();
    return Promise.resolve();
  }
  el.classList.add('play');
  return new Promise((r) => setTimeout(r, 1150)).then(() => {
    el.classList.add('done');
    setTimeout(() => el.remove(), 700);
  });
}

window.addEventListener('hashchange', render);

(async () => {
  const intro = splash();
  await load();
  await intro;
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
