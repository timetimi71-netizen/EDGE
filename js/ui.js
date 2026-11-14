// Kleine UI-Helfer: Formatierung, Icons, Sheets, Toasts, Bilder.
import { parseDate } from './model.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const nf = (d) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const n0 = nf(0);
const n1 = nf(1);
const n2 = nf(2);

export function fmtEur(v, sign = true) {
  if (v == null || Number.isNaN(v)) return '–';
  const s = sign && v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  return `${s}${a >= 1000 ? n0.format(a) : n2.format(a).replace(/,00$/, '')} €`;
}

export function fmtR(v, sign = true) {
  if (v == null || Number.isNaN(v)) return '–';
  const s = sign && v > 0 ? '+' : v < 0 ? '−' : '';
  return `${s}${n2.format(Math.abs(v))} R`;
}

export function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return '–';
  return `${v < 0 ? '−' : ''}${n2.format(Math.abs(v))} €`;
}

export function fmtSignedPct(v, d = 2) {
  if (v == null || Number.isNaN(v)) return '–';
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(d).format(Math.abs(v) * 100)} %`;
}

export const fmtPct = (v) => (v == null ? '–' : `${n0.format(v * 100)} %`);
export const fmtNum = (v, d = 1) => (v == null ? '–' : (d === 1 ? n1 : nf(d)).format(v));

export const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

export function parseNum(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function fmtDate(iso, withYear = false) {
  const d = parseDate(iso);
  const s = `${WD[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.`;
  return withYear ? `${s}${d.getFullYear()}` : s;
}

// Icons: 24er Raster, Strich
const P = {
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  stats: '<path d="M3 20h18"/><path d="M5 16l5-6 4 3 6-8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  up: '<path d="M7 17L17 7M9 7h8v8"/>',
  down: '<path d="M7 7l10 10M17 9v8H9"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;

export function sideTag(side) {
  return `<span class="side ${side}">${side === 'long' ? 'Long' : 'Short'}</span>`;
}

export function ruleMark(ok) {
  return `<span class="rule ${ok ? 'ok' : 'bad'}" title="${ok ? 'Regeln eingehalten' : 'Regeln gebrochen'}">${icon(ok ? 'check' : 'x')}</span>`;
}

let toastEl = null;
export function toast(msg, { action, onAction, onDone, ms } = {}) {
  toastEl?.dismiss();
  const el = document.createElement('div');
  el.className = `toast ${action ? 'has-action' : ''}`;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    el.classList.remove('in');
    setTimeout(() => el.remove(), 300);
    onDone?.();
    if (toastEl === el) toastEl = null;
  };
  el.dismiss = dismiss;
  toastEl = el;
  const timer = setTimeout(dismiss, ms ?? (action ? 5000 : 1800));
  el.querySelector('button')?.addEventListener('click', () => {
    onAction?.();
    dismiss();
  });
}

// Bottom-Sheet. Gibt eine Funktion zum Schließen zurück.
export function sheet(html, { onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div><button class="sheet-x" aria-label="Schließen">${icon('x')}</button>${html}</div>`;
  document.body.append(wrap);
  document.body.classList.add('locked');
  requestAnimationFrame(() => wrap.classList.add('in'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('in');
    document.body.classList.remove('locked');
    setTimeout(() => wrap.remove(), 250);
    onClose?.();
  };
  wrap.querySelector('.sheet-bg').addEventListener('click', close);
  wrap.querySelector('.sheet-x').addEventListener('click', close);
  // Nach unten ziehen schließt
  const sh = wrap.querySelector('.sheet');
  let y0 = null;
  let dy = 0;
  sh.addEventListener('touchstart', (e) => {
    y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null;
    dy = 0;
  }, { passive: true });
  sh.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) {
      sh.style.transition = 'none';
      sh.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return;
    sh.style.transition = '';
    sh.style.transform = '';
    if (dy > 90) close();
    y0 = null;
  });
  wrap.close = close;
  return wrap;
}

export function confirmSheet({ title, text = '', ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const w = sheet(
      `<div class="sheet-body">
        <h3>${esc(title)}</h3>
        ${text ? `<p class="muted">${esc(text)}</p>` : ''}
        <div class="sheet-actions">
          <button class="btn ${danger ? 'danger' : 'primary'} block" data-ok>${esc(ok)}</button>
          <button class="btn ghost block" data-cancel>Abbrechen</button>
        </div>
      </div>`,
      { onClose: () => resolve(result) },
    );
    w.querySelector('[data-ok]').onclick = () => { result = true; w.close(); };
    w.querySelector('[data-cancel]').onclick = () => w.close();
  });
}

export function viewImage(url) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<img src="${url}" alt=""><button class="lightbox-x" aria-label="Schließen">${icon('x')}</button>`;
  el.onclick = () => el.remove();
  document.body.append(el);
}

// Screenshot verkleinern, damit die Datenbank nicht platzt
export async function compressImage(file, max = 1800, quality = 0.82) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  }
}

export function topbar({ title, back, right = '', sub = '' }) {
  return `<header class="topbar ${back ? 'sub' : ''}">
    ${back ? `<a class="tb-btn" href="${back}" aria-label="Zurück">${icon('back')}</a>` : ''}
    <h1>${esc(title)}${sub ? `<small>${sub}</small>` : ''}</h1>
    <div class="tb-right">${right}</div>
  </header>`;
}
