// Edge · Hilfsfunktionen: Datum, Formatierung, DOM, Haptik, Toasts

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/* ---------- Datum (immer lokale Zeit, Format JJJJ-MM-TT) ---------- */
export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => iso(new Date());
export const addDays = (s, n) => {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const addMonths = (s, n) => {
  const d = fromISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return iso(d);
};
export const firstOfMonth = (s) => `${s.slice(0, 7)}-01`;
export const diffDays = (a, b) => Math.round((fromISO(a) - fromISO(b)) / 864e5);

export const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function fmtLong(s) {
  const d = fromISO(s);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}
export function fmtShort(s) {
  const d = fromISO(s);
  return `${WD[d.getDay()]}, ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
}
export function fmtDayMonth(s) {
  const d = fromISO(s);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}
export function relDay(s) {
  return { '-2': 'Vorgestern', '-1': 'Gestern', 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen' }[diffDays(s, today())] || null;
}
// Wer nach Mitternacht schreibt, meint meistens noch den Vortag.
export function journalDate() {
  const now = new Date();
  return now.getHours() < 5 ? addDays(iso(now), -1) : iso(now);
}
export function datesBack(n, end = today()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/* ---------- Uhrzeiten ---------- */
export const toMin = (t) => {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (m) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const addMin = (t, n) => fromMin((toMin(t) ?? 0) + n);
export function fmtDur(h) {
  if (h == null) return '–';
  const t = Math.round(h * 60);
  const hh = Math.floor(t / 60);
  const mm = t % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
// 7:45 h – kompakt für Kacheln
export function fmtHM(h) {
  if (h == null) return '–';
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
}
export const fmtNum = (n, d = 1) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- Diverses ---------- */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${fmtNum(b / 1024, 0)} KB`;
  return `${fmtNum(b / 1048576, 1)} MB`;
}
// Datum + Uhrzeit für <input type="datetime-local"> und zurück
export const toLocalInput = (ms) => {
  const d = new Date(ms);
  return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export function fromLocalInput(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || '');
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
}
export const hm = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// Zahl aus einem Eingabefeld (Komma oder Punkt)
// Zahlen aus Eingabefeldern: Komma oder Punkt als Dezimalzeichen, Tausenderzeichen werden erkannt
export const num = (v) => {
  let s = String(v ?? '').replace(/[\s'’]/g, '');
  const c = s.lastIndexOf(',');
  const d = s.lastIndexOf('.');
  if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c > -1) s = s.indexOf(',') === c ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (d > -1 && s.indexOf('.') !== d) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
// Geldbeträge: „1.250“ und „100.000“ sind Tausender (bei Kursen wie 1.085 wäre der Punkt ein Komma)
export const amount = (v) => {
  const s = String(v ?? '').replace(/[\s'’]/g, '');
  return num(/^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s);
};
export function slug(s) {
  const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  return (
    String(s)
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => map[c])
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'edge'
  );
}

export const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const IS_STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
// In der claude.ai-Vorschau läuft die App eingebettet: dort gibt es kein Mikrofon, keinen Service Worker und keinen Kalender-Export.
export const IS_PREVIEW = (() => {
  try {
    return window.self !== window.top || !!window.claude || new URLSearchParams(location.search).has('preview');
  } catch {
    return true;
  }
})();
export const reduceMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('calm');

export function autosize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

/* ---------- Haptik ----------
   iOS kennt navigator.vibrate nicht. Ab iOS 18 löst das Umschalten eines
   <input switch> aber ein kurzes Taptic-Feedback aus – das nutzen wir. */
let hapticsOn = true;
export const setHaptics = (v) => {
  hapticsOn = v;
};
export function haptic(kind = 'tap') {
  if (!hapticsOn) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'error' ? [14, 70, 14] : kind === 'success' ? [10, 60, 18] : 8);
      return;
    }
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    /* ohne Haptik weiter */
  }
}

/* ---------- Toasts ---------- */
export function toast(msg, opts = {}) {
  const { icon = '', action, onAction, ms = 2800 } = opts;
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon ? `<span class="toast-ic">${icon}</span>` : ''}<span>${esc(msg)}</span>${
    action ? `<button type="button" class="toast-btn">${esc(action)}</button>` : ''
  }`;
  let gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    el.classList.add('out');
    setTimeout(() => el.remove(), 360);
  };
  if (action) {
    el.querySelector('.toast-btn').addEventListener('click', () => {
      close();
      onAction?.();
    });
  }
  host.appendChild(el);
  while (host.children.length > 2) host.firstElementChild.remove();
  setTimeout(close, ms);
  return close;
}

/* ---------- Scrollsperre für Sheets (iOS ignoriert overflow:hidden am body) ---------- */
let locks = 0;
let lockY = 0;
export function lockScroll() {
  if (locks++) return;
  lockY = window.scrollY;
  document.body.style.setProperty('--lock-y', `-${lockY}px`);
  document.body.classList.add('locked');
}
export function unlockScroll() {
  if (!locks) return;
  if (--locks) return;
  document.body.classList.remove('locked');
  window.scrollTo(0, lockY);
}

/* ---------- Zahlen hochzählen ---------- */
export function countUp(root) {
  if (reduceMotion()) return;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count);
    if (!Number.isFinite(to) || to === 0) return;
    const dec = Number(el.dataset.dec || 0);
    const fmt = (v) => fmtNum(dec ? v : Math.round(v), dec);
    const t0 = performance.now();
    const dur = 1000;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------- Binärdaten ---------- */
export function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
export function dataURLToBlob(url) {
  const i = url.indexOf(',');
  const head = url.slice(0, i);
  const mime = (head.match(/data:([^;,]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(url.slice(i + 1));
  const arr = new Uint8Array(bin.length);
  for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
  return new Blob([arr], { type: mime });
}
