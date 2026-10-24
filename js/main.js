// Edge · Start, Navigation, Ereignisse, Service Worker
import { S, loadAll, flushWrites, hooks } from './store.js';
import { $, toast, haptic, today, countUp, reduceMotion, IS_PREVIEW } from './util.js';
import { icon, DEFS, topSheet } from './ui.js';
import { actions, inputs, changes, act, app } from './app.js';
import * as todayView from './views/today.js';
import * as tradesView from './views/trades.js';
import * as calendarView from './views/calendar.js';
import * as statsView from './views/stats.js';
import * as journalView from './views/journal.js';
import { applySettings, showLock, showOnboarding } from './settings.js';
import { stopDictation } from './speech.js';
import { loadDemo } from './demo.js';
import { pullSync, syncOn } from './sync.js';

const VIEWS = { today: todayView, trades: tradesView, calendar: calendarView, stats: statsView, journal: journalView };
const TABS = [
  ['today', 'Heute', 'today'],
  ['trades', 'Trades', 'candles'],
  ['calendar', 'Kalender', 'calendar'],
  ['stats', 'Analyse', 'stats'],
  ['journal', 'Journal', 'journal'],
];
let current = 'today';
let renderedDay = today();
let switching = null;

function shell() {
  document.body.insertAdjacentHTML(
    'afterbegin',
    `${DEFS}<div class="ambient" aria-hidden="true"></div>
    <main class="app" id="app"><div class="view" id="view"></div></main>
    <nav class="tabbar" aria-label="Bereiche"><div class="tabbar-in" id="tabbar"></div></nav>
    <div class="toasts" id="toasts"></div>`,
  );
}

const visibleTabs = () => TABS;
function buildTabs() {
  const tabs = visibleTabs();
  const bar = $('#tabbar');
  bar.style.setProperty('--tabs', tabs.length);
  bar.classList.toggle('many', tabs.length > 6);
  bar.innerHTML = `<span class="tab-pill" id="tab-pill"></span>${tabs
    .map(([id, label, ic]) => `<button type="button" class="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`)
    .join('')}`;
  markTab();
}
function markTab() {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === current;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  const i = visibleTabs().findIndex((t) => t[0] === current);
  const pill = $('#tab-pill');
  if (pill) {
    pill.style.setProperty('--i', Math.max(0, i));
    pill.style.opacity = i < 0 ? '0' : '';
  }
}

function render({ animate = false } = {}) {
  const view = VIEWS[current];
  const el = $('#view');
  el.innerHTML = view.render();
  el.dataset.view = current;
  if (animate && !reduceMotion()) {
    let i = 0;
    el.querySelectorAll(':scope > *, :scope > .stack > *').forEach((c) => {
      if (c.classList.contains('stack')) return;
      c.classList.add('reveal');
      c.style.setProperty('--d', Math.min(i++, 10));
    });
  }
  view.mount?.(el);
  if (animate) countUp(el);
  markTab();
  renderedDay = today();
}

app.go = (name, opts = {}) => {
  if (!VIEWS[name]) return;
  stopDictation();
  flushWrites();
  VIEWS[name].enter?.(opts);
  current = name;
  clearTimeout(switching);
  const el = $('#view');
  if (opts.instant || reduceMotion()) {
    el.classList.remove('out');
    render({ animate: !!opts.instant });
    window.scrollTo(0, 0);
    return;
  }
  el.classList.add('out');
  switching = setTimeout(() => {
    render({ animate: true });
    el.classList.remove('out');
    window.scrollTo(0, 0);
  }, 130);
};
app.refresh = ({ animate = false } = {}) => {
  const y = window.scrollY;
  render({ animate });
  if (!document.body.classList.contains('locked')) window.scrollTo(0, y);
};
app.current = () => current;

act('go', (el) => app.go(el.dataset.to, { date: el.dataset.date || undefined }));

/* ---------- Ereignisse ---------- */
function wire() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    actions[el.dataset.act]?.(el, e);
  });
  document.addEventListener('input', (e) => {
    const k = e.target.dataset?.input;
    if (k) inputs[k]?.(e.target, e);
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset?.change;
    if (k) changes[k]?.(e.target, e);
  });

  $('#tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    haptic();
    t.classList.remove('bump');
    void t.offsetWidth;
    t.classList.add('bump');
    if (t.dataset.tab === current) {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      return;
    }
    app.go(t.dataset.tab);
  });

  // Tastatur offen → Tableiste weg
  const isField = (el) =>
    !!el &&
    (el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button', 'submit', 'range'].includes(el.type)));
  document.addEventListener('focusin', (e) => {
    if (isField(e.target)) document.body.classList.add('kb-open');
  });
  document.addEventListener('focusout', () =>
    setTimeout(() => {
      if (!isField(document.activeElement)) document.body.classList.remove('kb-open');
    }, 80),
  );
  // Sichtbarer Bereich über der Tastatur – damit Sheets nicht dahinter verschwinden
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const upd = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
      document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    };
    vv.addEventListener('resize', upd);
    vv.addEventListener('scroll', upd);
    upd();
  }

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (!S.settings) return;
    if (document.hidden) {
      flushWrites();
      stopDictation();
      hiddenAt = Date.now();
      if (S.settings.pinHash && S.settings.lockAfter === 0) showLock();
    } else {
      if (S.settings.pinHash && hiddenAt && Date.now() - hiddenAt >= S.settings.lockAfter * 1000) showLock();
      if (today() !== renderedDay && !topSheet()) app.refresh();
      autoSync();
    }
  });
  window.addEventListener('pagehide', flushWrites);
}

/* ---------- Offline & Updates ---------- */
function registerSW() {
  if (IS_PREVIEW || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Eine neue Version von Edge ist da', { action: 'Aktualisieren', ms: 12000, onAction: () => w.postMessage('skip') });
          }
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('Service Worker:', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

async function boot() {
  shell();
  wire();
  hooks.onError = () => toast('Speichern hat nicht geklappt. Ist der Speicher deines iPhones voll?', { ms: 6000 });
  await loadAll();
  applySettings();
  buildTabs();
  if (IS_PREVIEW && !S.settings.demoLoaded && S.trades.size === 0) await loadDemo();
  if (S.settings.pinHash) showLock();
  app.go('today', { instant: true });
  if (!S.settings.onboarded && !IS_PREVIEW) showOnboarding();
  registerSW();
  if (!IS_PREVIEW) {
    autoSync();
    setInterval(() => !document.hidden && autoSync(), 5 * 60e3);
  }
}

// MT5 automatisch: neue Trades abholen, wenn die App aufgeht (höchstens alle zwei Minuten)
async function autoSync() {
  if (IS_PREVIEW || !syncOn() || Date.now() - (S.settings.mt5?.last?.checked || 0) < 2 * 60e3) return;
  const r = await pullSync();
  if (r.state !== 'ok') return;
  if (r.added) toast(r.added === 1 ? 'Ein neuer Trade aus MT5' : `${r.added} neue Trades aus MT5`, { icon: icon('repeat'), ms: 4000 });
  // Nicht neu zeichnen, während jemand gerade tippt
  if (!topSheet() && !document.activeElement?.closest?.('#view textarea, #view input')) app.refresh();
}

boot().catch((err) => {
  console.error(err);
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#151a2e;background:#f3f5f9;font:16px system-ui';
  box.textContent = `Edge konnte nicht starten: ${err?.message || err}`;
  document.body.appendChild(box);
});
