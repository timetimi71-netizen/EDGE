// Effekte: Konfetti, Hochzählen, Haptik, Neigen, gestaffeltes Einblenden
import { fmtR, fmtEur, fmtMoney, fmtPct } from './ui.js';

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Haptik: Android per vibrate, iOS 18+ über einen versteckten Schalter
let hapticLabel;
export function haptic(ms = 8) {
  if (calm()) return;
  if (navigator.vibrate) {
    navigator.vibrate(ms);
    return;
  }
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.className = 'haptic';
    hapticLabel.innerHTML = '<input type="checkbox" switch>';
    hapticLabel.setAttribute('aria-hidden', 'true');
    document.body.append(hapticLabel);
  }
  hapticLabel.click();
}

// Zahlen hochzählen: data-cu="Wert" data-cu-f="R|EUR|money|pct|int"
const FMT = {
  R: (v) => fmtR(v),
  EUR: (v) => fmtEur(v),
  money: (v) => fmtMoney(v),
  pct: (v) => fmtPct(v),
  int: (v) => String(Math.round(v)),
};

export function countUps(root, { from = null, ms = 900 } = {}) {
  const els = [...root.querySelectorAll('[data-cu]')];
  if (!els.length || calm()) return;
  const t0 = performance.now();
  const items = els.map((el) => ({
    el,
    to: Number(el.dataset.cu),
    from: el.dataset.cuFrom != null ? Number(el.dataset.cuFrom) : from ?? 0,
    f: FMT[el.dataset.cuF] || FMT.int,
    html: el.innerHTML,
  }));
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 4);
    for (const it of items) {
      if (!it.el.isConnected) continue;
      if (k >= 1) it.el.innerHTML = it.html;
      else it.el.textContent = it.f(it.from + (it.to - it.from) * e);
    }
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Gestaffeltes Einblenden
export function stagger(root, sel = '.row, .open-card, .tile, .combo, .mk-row, .kpi, .acc-item, .lesson-row, .cal-cell.has, .wk-day') {
  if (calm()) return;
  root.querySelectorAll(sel).forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 14));
    el.classList.add('stg');
  });
}

// Karte folgt dem Finger in 3D
export function tilt(el, max = 7) {
  if (!el || calm()) return;
  let raf = 0;
  const move = (x, y) => {
    const r = el.getBoundingClientRect();
    const px = (x - r.left) / r.width - 0.5;
    const py = (y - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(0)}%`);
      el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(0)}%`);
      el.classList.add('tilting');
    });
  };
  const reset = () => {
    cancelAnimationFrame(raf);
    el.classList.remove('tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  el.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  el.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY));
  el.addEventListener('pointerleave', reset);
  el.addEventListener('pointerup', reset);
  el.addEventListener('pointercancel', reset);
}

// Konfetti in Vanta-Farben
const COLORS = ['#131722', '#089981', '#2ee6c0', '#ffffff', '#9598a1', '#131722'];
export function confetti({ count = 110, x = 0.5, y = 0.35, spread = 1, power = 1 } = {}) {
  if (calm()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  c.width = W * dpr;
  c.height = H * dpr;
  document.body.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9 * spread;
    const v = (7 + Math.random() * 9) * power;
    return {
      x: W * x,
      y: H * y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      col: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.25,
      wob: Math.random() * 10,
    };
  });
  const t0 = performance.now();
  const frame = (t) => {
    const age = t - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx + Math.sin((age + p.wob * 100) / 180) * 0.6;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1500) / 700);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.col;
      if (p.col === '#ffffff') {
        ctx.strokeStyle = '#d5d8df';
        ctx.lineWidth = 1;
      }
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
        if (p.col === '#ffffff') ctx.stroke();
      } else {
        const sy = Math.abs(Math.cos(p.r * 2));
        ctx.fillRect(-p.w / 2, (-p.h / 2) * sy, p.w, p.h * sy);
        if (p.col === '#ffffff') ctx.strokeRect(-p.w / 2, (-p.h / 2) * sy, p.w, p.h * sy);
      }
      ctx.restore();
    }
    if (age < 2300) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

// Großer Moment: Overlay mit Titel und Text, schließt selbst
export function moment({ title, text = '', kicker = '', tone = 'good', ms = 2300 }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = `moment ${tone}`;
    el.innerHTML = `<div class="moment-in">
      ${kicker ? `<div class="moment-k">${kicker}</div>` : ''}
      <div class="moment-t">${title}</div>
      ${text ? `<div class="moment-x">${text}</div>` : ''}
    </div>`;
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('in'));
    if (tone === 'good') setTimeout(() => confetti({ count: 140, y: 0.45, power: 1.15 }), 180);
    const done = () => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => {
        el.remove();
        resolve();
      }, 380);
    };
    const timer = setTimeout(done, calm() ? 900 : ms);
    el.onclick = () => {
      clearTimeout(timer);
      done();
    };
  });
}
