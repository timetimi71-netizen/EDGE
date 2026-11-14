// Equity-Kurve als SVG
import { fmtR, fmtEur } from './ui.js';

export function equityChart(values, unit = 'R') {
  if (values.length < 2) return '<div class="chart-empty">Ab 2 abgeschlossenen Trades siehst du hier deine Kurve.</div>';
  const pts = [0, ...values];
  const W = 340;
  const H = 150;
  const pad = 6;
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const span = max - min || 1;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => pad + (1 - (v - min) / span) * (H - 2 * pad);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  const cls = last >= 0 ? 'up' : 'down';
  const fmt = unit === 'R' ? fmtR : fmtEur;
  return `<div class="chart">
    <div class="chart-scale"><span>${fmt(max)}</span><span>${fmt(min)}</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="${cls}">
      <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="zero"/>
      <path d="${line}L${W},${y(0)}L0,${y(0)}Z" class="area"/>
      <path d="${line}" class="line"/>
    </svg>
  </div>`;
}
