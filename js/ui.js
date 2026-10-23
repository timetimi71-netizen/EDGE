// Edge · Bausteine: Icons, Gefühls-Smileys, Logo, Sheets, Dialoge, Konfetti, PIN-Feld
import { esc, lockScroll, unlockScroll, haptic, reduceMotion } from './util.js';

/* ---------- Icons (Linien, 24er Raster) ---------- */
const P = {
  today: '<path d="M3.5 18.5h17"/><path d="M7.5 18.5a4.5 4.5 0 0 1 9 0"/><path d="M12 8v2.5"/><path d="m5.7 11.6 1.7 1.2"/><path d="m18.3 11.6-1.7 1.2"/><path d="M8 21.5h8"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.5" cy="6.5" r="1.1"/><circle cx="4.5" cy="12" r="1.1"/><circle cx="4.5" cy="17.5" r="1.1"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/>',
  stats: '<path d="M3.5 20.5h17"/><path d="m4.5 15.5 4.5-5 4 3.5 6.5-8"/><path d="M15.5 6h3.5v3.5"/>',
  journal: '<path d="M6.5 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-10z"/><path d="M6.5 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2"/><path d="M9.5 8.5h5.5M9.5 12h5.5M9.5 15.5h3"/>',
  candles: '<path d="M7 3.5v3M7 15.5v5M17 6v3M17 18v2.5"/><rect x="4.8" y="6.5" width="4.4" height="9" rx="1.2"/><rect x="14.8" y="9" width="4.4" height="9" rx="1.2"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  chevL: '<path d="m14.5 6-6 6 6 6"/>',
  chevR: '<path d="m9.5 6 6 6-6 6"/>',
  chevD: '<path d="m6 9.5 6 6 6-6"/>',
  arrowR: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 4.5-4.5 4 4 2.5-2.5 5 5"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="m6.5 7 .9 12a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12"/>',
  share: '<path d="M12 3.5v11"/><path d="m8 7 4-4 4 4"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4h4"/><path d="M12 7.5V12l3 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  flame: '<path d="M12 21.5c-4.1 0-6.8-2.7-6.8-6.4 0-3.4 2.3-5.3 3.8-7.8.5 1.8 1.4 2.8 2.5 3.2.3-3.4 1.8-5.9 4.2-7.5-.3 2.7 1 4.6 2.3 6.4 1 1.5 1.9 3.2 1.9 5.4 0 3.9-3.1 6.7-7.9 6.7z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 19.5h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M19.5 14.6A7.6 7.6 0 1 1 9.4 4.5a6.1 6.1 0 0 0 10.1 10.1z"/>',
  bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
  backspace: '<path d="M9 5.5h10.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9L3 12z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  star: '<path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.5l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.2a3 3 0 0 0-2.6-1.2c-1.5 0-2.7.8-2.7 2s1.2 1.7 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2a3.1 3.1 0 0 1-2.7-1.3"/><path d="M12 6.5V8M12 16v1.5"/>',
  trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3.3 4M16.5 6h3a3 3 0 0 1-3.3 4"/><path d="M12 13.5V17"/><path d="M8.5 20.5h7l-.8-3.5H9.3z"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7h7"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v2.8M8.5 18h.01M12 18h.01"/>',
  shield: '<path d="M12 3.2 5 6v5.5c0 4.4 3 7.9 7 9.3 4-1.4 7-4.9 7-9.3V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  alert: '<path d="M10.3 4.3 2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V8"/><rect x="4" y="8" width="16.5" height="11.5" rx="2.5"/><path d="M16 13.8h.01"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z"/>',
  brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3 3 0 0 0 7 17.5a2.8 2.8 0 0 0 5 1.6V5.6a2.6 2.6 0 0 0-3-1.1z"/><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3 3 3 0 0 1-2.5 4.7 2.8 2.8 0 0 1-5 1.6"/>',
  layers: '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16 8.5 4.5 8.5-4.5"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  swap: '<path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1.2"/><rect x="14" y="5" width="3.5" height="14" rx="1.2"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------- Gefühl (1 = schlecht … 5 = super) ---------- */
export const FEEL = ['Gestresst', 'Unruhig', 'Neutral', 'Ruhig', 'Im Flow'];
const INK = 'style="fill:var(--face-ink)"';
const STROKE = 'fill="none" style="stroke:var(--face-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const DOT_EYES = `<circle cx="17.5" cy="20" r="2.7" ${INK}/><circle cx="30.5" cy="20" r="2.7" ${INK}/>`;
export function faceInner(level) {
  const lv = Math.round(level || 0);
  if (!lv) {
    return '<circle cx="24" cy="24" r="20.5" fill="none" style="stroke:var(--line-2)" stroke-width="2" stroke-dasharray="3.2 4.2"/>';
  }
  let eyes = DOT_EYES;
  let mouth = '';
  let extra = '';
  switch (lv) {
    case 1:
      eyes = `<path d="M14.5 17l5.2 3-5.2 3M33.5 17l-5.2 3 5.2 3" ${STROKE} stroke-width="2.8"/>`;
      mouth = `<path d="M15.5 35.5c2.8-4.8 14.2-4.8 17 0" ${STROKE}/>`;
      break;
    case 2:
      mouth = `<path d="M16.5 33.5c3-3 12-3 15 0" ${STROKE}/>`;
      extra = `<path d="M13.8 14.8l5 1.6M34.2 14.8l-5 1.6" ${STROKE} stroke-width="2.4"/>`;
      break;
    case 3:
      mouth = `<path d="M17 31.5h14" ${STROKE}/>`;
      break;
    case 4:
      mouth = `<path d="M15.5 28.5c3.6 4.8 13.4 4.8 17 0" ${STROKE}/>`;
      break;
    default:
      eyes = `<path d="M13.8 21.4c1.2-3.2 5.2-3.2 6.4 0M27.8 21.4c1.2-3.2 5.2-3.2 6.4 0" ${STROKE}/>`;
      mouth =
        `<path d="M14.5 27.2h19c-.8 5.8-4.8 9-9.5 9s-8.7-3.2-9.5-9z" ${INK}/>` +
        '<path d="M19.4 33.7c1.3-1.6 3-2.4 4.6-2.4s3.3.8 4.6 2.4c-1.4 1.5-3 2.1-4.6 2.1s-3.2-.6-4.6-2.1z" style="fill:#ff7b93"/>';
      extra = '<ellipse cx="11.8" cy="27.6" rx="3.2" ry="2" style="fill:#ff6b8a;opacity:.4"/><ellipse cx="36.2" cy="27.6" rx="3.2" ry="2" style="fill:#ff6b8a;opacity:.4"/>';
  }
  return `<circle cx="24" cy="24" r="21" style="fill:var(--m${lv})"/><circle cx="24" cy="24" r="21" fill="url(#faceShine)"/>${extra}${eyes}${mouth}`;
}
export function face(level, cls = '') {
  return `<svg class="face ${cls}" viewBox="0 0 48 48" aria-hidden="true">${faceInner(level)}</svg>`;
}
export function facesHTML(name, v, { label = 'Gefühl', labels = FEEL } = {}) {
  return `<div class="faces ${v ? 'sel' : ''}" role="radiogroup" aria-label="${esc(label)}">${[1, 2, 3, 4, 5]
    .map(
      (l) =>
        `<button type="button" class="face-b lv${l} ${v === l ? 'on' : ''}" role="radio" aria-checked="${v === l}" aria-label="${labels[l - 1]}" data-face="${name}" data-v="${l}">${face(l)}</button>`,
    )
    .join('')}</div>`;
}

/* ---------- Logo: zwei Kerzen, eine steigt ---------- */
export function logoSVG(cls = 'logo') {
  return `<svg class="${cls}" viewBox="0 0 96 96" aria-hidden="true">
    <circle cx="48" cy="48" r="34" fill="url(#logoGlow)"/>
    <path d="M36 22v10M36 60v12M60 16v8M60 54v10" style="stroke:var(--logo-b)" stroke-width="4" stroke-linecap="round"/>
    <rect x="28" y="32" width="16" height="28" rx="4" style="fill:var(--loss)"/>
    <rect x="52" y="24" width="16" height="30" rx="4" style="fill:var(--win)"/>
    <path d="M22 74 40 62l10 6 24-18" fill="none" style="stroke:var(--logo-a)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------- Sheets (von unten) ---------- */
const sheets = [];
export function openSheet({ title = '', body = '', cls = '', onClose = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap ${cls}`;
  wrap.style.zIndex = String(100 + sheets.length * 2);
  wrap.innerHTML = `<div class="sheet-backdrop" data-sheet-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-drag"><div class="sheet-grab"></div>
        <header class="sheet-head"><h2 class="sheet-title">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-sheet-close aria-label="Schließen">${icon('close')}</button>
        </header>
      </div>
      <div class="sheet-body">${body}</div>
    </section>`;
  document.body.appendChild(wrap);
  lockScroll();
  const sheet = wrap.querySelector('.sheet');
  const api = {
    el: wrap,
    sheet,
    body: wrap.querySelector('.sheet-body'),
    closed: false,
    onClose,
    close: () => closeSheet(api),
    setTitle(t) {
      wrap.querySelector('.sheet-title').textContent = t;
    },
  };
  // Ein Sheet, das gerade zugeht, schluckt weitere Tipps (sonst trägt ein Doppeltipp doppelt ein)
  wrap.addEventListener(
    'click',
    (e) => {
      if (!api.closed) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) {
      e.preventDefault();
      api.close();
    }
  });
  enableDrag(api);
  sheets.push(api);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return api;
}
export function closeSheet(api = sheets[sheets.length - 1]) {
  if (!api || api.closed) return;
  api.closed = true;
  const i = sheets.indexOf(api);
  if (i >= 0) sheets.splice(i, 1);
  if (api.el.contains(document.activeElement)) document.activeElement.blur();
  api.el.classList.remove('open');
  api.el.classList.add('closing');
  api.sheet.style.transform = '';
  setTimeout(() => {
    api.el.remove();
    unlockScroll();
  }, 400);
  api.onClose?.();
}
export const topSheet = () => sheets[sheets.length - 1] || null;
export const closeAllSheets = () => [...sheets].reverse().forEach((s) => closeSheet(s));

function enableDrag(api) {
  const handle = api.sheet.querySelector('.sheet-drag');
  let y0 = null;
  let dy = 0;
  let t0 = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    y0 = e.clientY;
    dy = 0;
    t0 = performance.now();
    api.sheet.style.transition = 'none';
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    api.sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, performance.now() - t0);
    y0 = null;
    api.sheet.style.transition = '';
    if (dy > 110 || (v > 0.6 && dy > 30)) api.close();
    else api.sheet.style.transform = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* ---------- Dialog (statt confirm(), das im Web-App-Modus unschön ist) ---------- */
export function confirmDialog({ title, text = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'alert-wrap';
    el.innerHTML = `<div class="alert" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="alert-btns ${cancel ? '' : 'one'}">${cancel ? `<button type="button" data-v="0">${esc(cancel)}</button>` : ''}<button type="button" data-v="1" class="${danger ? 'danger' : ''}">${esc(ok)}</button></div>
    </div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b && e.target !== el) return;
      const v = b ? b.dataset.v === '1' : false;
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
      resolve(v);
    });
    document.body.appendChild(el);
    haptic();
  });
}

/* ---------- Konfetti ---------- */
export function confetti({ x = innerWidth / 2, y = innerHeight * 0.7, count = 150 } = {}) {
  if (reduceMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--m1', '--m2', '--m3', '--m4', '--m5', '--accent', '--accent-2'].map((v) => cs.getPropertyValue(v).trim());
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const sp = 8 + Math.random() * 10;
    return {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      r: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.35,
      c: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.3,
    };
  });
  const t0 = performance.now();
  const life = 2600;
  const frame = (now) => {
    const t = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.34;
      p.vx *= 0.986;
      p.vy *= 0.986;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - t / life);
      ctx.fillStyle = p.c;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 1.7)));
      }
      ctx.restore();
    }
    if (t < life) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

/* ---------- PIN-Tastenfeld ---------- */
const LETTERS = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
export function keypadHTML() {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((n) => `<button type="button" class="key" data-key="${n}">${n}<small>${LETTERS[n] || '&nbsp;'}</small></button>`)
    .join('');
  return `<div class="keypad">${keys}<span class="key-gap"></span><button type="button" class="key" data-key="0">0<small>&nbsp;</small></button><button type="button" class="key ghost" data-key="del" aria-label="Löschen">${icon('backspace')}</button></div>`;
}
export const pinDotsHTML = (n = 4) => `<div class="pin-dots">${'<i></i>'.repeat(n)}</div>`;
export function pinPad(root, { length = 4, onComplete }) {
  let val = '';
  let busy = false;
  const dots = root.querySelector('.pin-dots');
  const render = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < val.length));
  const press = (k) => {
    if (busy) return;
    haptic();
    if (k === 'del') val = val.slice(0, -1);
    else if (val.length < length) val += k;
    render();
    if (val.length === length) {
      busy = true;
      const v = val;
      setTimeout(() => onComplete(v, api), 140);
    }
  };
  root.addEventListener('click', (e) => {
    const k = e.target.closest('[data-key]');
    if (k) press(k.dataset.key);
  });
  const api = {
    press,
    reset() {
      val = '';
      busy = false;
      render();
    },
    shake() {
      dots.classList.remove('shake');
      void dots.offsetWidth;
      dots.classList.add('shake');
      haptic('error');
    },
  };
  return api;
}

/* ---------- Kleine Bausteine ---------- */
export function segHTML(action, options, value, cls = '') {
  const i = Math.max(0, options.findIndex((o) => o[0] === value));
  return `<div class="seg ${cls}" style="--n:${options.length};--i:${i}" role="tablist"><span class="seg-pill"></span>${options
    .map(
      ([v, label]) =>
        `<button type="button" role="tab" aria-selected="${v === value}" class="${v === value ? 'on' : ''}" data-act="${action}" data-v="${v}">${esc(label)}</button>`,
    )
    .join('')}</div>`;
}
export function setSeg(btn) {
  const seg = btn.closest('.seg');
  const all = [...seg.querySelectorAll('button')];
  all.forEach((b) => {
    b.classList.toggle('on', b === btn);
    b.setAttribute('aria-selected', b === btn);
  });
  seg.style.setProperty('--i', all.indexOf(btn));
}
export function switchHTML(id, checked, attrs = '') {
  return `<span class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${attrs}><span></span></span>`;
}


// Gemeinsame SVG-Verläufe (einmal im Dokument)
export const DEFS = `<svg class="defs" aria-hidden="true" focusable="false"><defs>
  <radialGradient id="faceShine" cx="34%" cy="26%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.18"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient>
</defs></svg>`;
