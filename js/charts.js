// Edge · Diagramme als SVG (Balken, Kontoverlauf)
import { esc, fmtNum } from './util.js';

const W = 340;

/* Balken: items = [{ label, value|null, cls, hl }] */
export function barChart({ items, max, target = null, height = 160, targetLabel = '' }) {
  const H = height;
  const padT = 20;
  const padB = 24;
  const padX = 4;
  const n = items.length;
  const slot = (W - padX * 2) / n;
  const bw = Math.min(20, slot * 0.6);
  const inner = H - padT - padB;
  const y = (v) => padT + inner * (1 - Math.min(v, max) / max);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balkendiagramm">`;
  s += `<line class="base" x1="${padX}" x2="${W - padX}" y1="${y(0)}" y2="${y(0)}"/>`;
  items.forEach((it, i) => {
    const cx = padX + slot * i + slot / 2;
    if (it.value != null && it.value > 0) {
      const h = Math.max(4, inner * (Math.min(it.value, max) / max));
      s += `<rect class="bar-r ${it.cls || ''}" style="--i:${i}" x="${(cx - bw / 2).toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(6, bw / 2).toFixed(1)}"><title>${esc(it.title || '')}</title></rect>`;
    } else {
      s += `<rect class="bar-empty" x="${(cx - bw / 2).toFixed(1)}" y="${(y(0) - 3).toFixed(1)}" width="${bw.toFixed(1)}" height="3" rx="1.5"/>`;
    }
    if (it.label) s += `<text x="${cx.toFixed(1)}" y="${H - 7}" text-anchor="middle" class="${it.hl ? 'hl' : ''}">${esc(it.label)}</text>`;
  });
  if (target != null) {
    const ty = y(target).toFixed(1);
    s += `<line class="target" x1="${padX}" x2="${W - padX}" y1="${ty}" y2="${ty}"/>`;
    s += `<text class="target-t" x="${W - padX}" y="${(y(target) - 6).toFixed(1)}" text-anchor="end">${esc(targetLabel)}</text>`;
  }
  return `${s}</svg>`;
}

/* Monotone Kurve (Steffen): bleibt zwischen den Punkten, schießt nicht über 1–5 hinaus */
function monotonePath(p) {
  const n = p.length;
  if (!n) return '';
  if (n === 1) return `M${p[0][0]},${p[0][1]}`;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0];
    m[i] = (p[i + 1][1] - p[i][1]) / dx[i];
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    const pp = (m[i - 1] * dx[i] + m[i] * dx[i - 1]) / (dx[i - 1] + dx[i]);
    t[i] = (Math.sign(m[i - 1]) + Math.sign(m[i])) * Math.min(Math.abs(m[i - 1]), Math.abs(m[i]), 0.5 * Math.abs(pp)) || 0;
  }
  t[n - 1] = m[n - 2];
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(p[i][0] + h).toFixed(1)},${(p[i][1] + h * t[i]).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - h * t[i + 1]).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`;
  }
  return d;
}

let gid = 0;
/* Kontoverlauf: values = [{ t, v }] (kumulierter Gewinn), dazu optionale Linien (Ziel, Grenze) */
export function equityChart({ values, lines = [], height = 170, fmt = (v) => fmtNum(v, 0) }) {
  const H = height;
  const padL = 44;
  const padR = 8;
  const padT = 12;
  const padB = 20;
  const n = values.length;
  const vs = values.map((p) => p.v);
  let lo = Math.min(0, ...vs, ...lines.map((l) => l.v));
  let hi = Math.max(0, ...vs, ...lines.map((l) => l.v));
  if (hi - lo < 1) hi = lo + 1;
  const span = hi - lo;
  lo -= span * 0.06;
  hi += span * 0.06;
  const x = (i) => padL + (n <= 1 ? (W - padL - padR) / 2 : ((W - padL - padR) * i) / (n - 1));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const id = `eq${++gid}`;
  const pts = values.map((p, i) => [x(i), y(p.v)]);
  const last = vs[vs.length - 1] ?? 0;
  const cls = last >= 0 ? 'win' : 'loss';
  let s = `<svg class="chart eq ${cls}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kontoverlauf">`;
  s += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></linearGradient></defs>`;
  // Hilfslinien bei runden Werten (100, 200, 500, 1000 …), höchstens vier
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];
  const step = steps.find((x) => (hi - lo) / x <= 4) || steps[steps.length - 1];
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  for (const v of ticks) {
    const yy = y(v).toFixed(1);
    s += `<line class="${v === 0 ? 'base' : 'gridl'}" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  for (const l of lines) {
    if (l.v < lo || l.v > hi) continue;
    const yy = y(l.v).toFixed(1);
    s += `<line class="target ${l.cls || ''}" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text class="target-t ${l.cls || ''}" x="${W - padR}" y="${(y(l.v) - 5).toFixed(1)}" text-anchor="end">${esc(l.label)}</text>`;
  }
  if (pts.length > 1) {
    const d = monotonePath(pts);
    const base = y(Math.max(lo, Math.min(0, hi))).toFixed(1);
    s += `<path class="line-area" d="${d}L${pts[pts.length - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z" fill="url(#${id})"/>`;
    s += `<path class="line-path" d="${d}" pathLength="1"/>`;
    const [lx, ly] = pts[pts.length - 1];
    s += `<circle class="line-dot" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5"/>`;
  }
  return `${s}</svg>`;
}
