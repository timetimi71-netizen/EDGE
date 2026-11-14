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

// Kleine Linie für die Konto-Karte
export function sparkline(curve) {
  const pts = [0, ...curve];
  if (pts.length < 2) return '<div class="spark"><svg viewBox="0 0 300 56" preserveAspectRatio="none"><line x1="0" x2="300" y1="40" y2="40" class="sp-base"/></svg></div>';
  const W = 300;
  const H = 56;
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const span = max - min || 1;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => 3 + (1 - (v - min) / span) * (H - 6);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return `<div class="spark"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="spg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="sp-base"/>
    <path d="${d}L${W},${H}L0,${H}Z" fill="url(#spg)"/>
    <path d="${d}" class="sp-line"/>
  </svg><span class="sp-dot" style="top:${((y(last) / H) * 100).toFixed(1)}%"></span></div>`;
}
