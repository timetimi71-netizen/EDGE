// Share-Karten: Trade oder Woche als Bild (1080 × 1350)
import { rOf, rulesOk, outcome, OUTCOME_LABEL, GROUPS, summarize, parseDate, byClose } from './model.js';
import { fmtR, fmtEur, fmtPct, sheet, toast, icon, MONTHS } from './ui.js';

const W = 1080;
const H = 1350;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const UP = '#2ee6c0';
const DOWN = '#ff6b78';

function base() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(W, 0, 0, W, 0, W * 1.5);
  g.addColorStop(0, '#2a2f3d');
  g.addColorStop(0.55, '#131722');
  g.addColorStop(1, '#090b10');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  // feines Raster wie im Chart
  x.strokeStyle = 'rgba(255,255,255,0.035)';
  x.lineWidth = 1;
  for (let i = 90; i < W; i += 90) line(x, i, 0, i, H);
  for (let i = 90; i < H; i += 90) line(x, 0, i, W, i);
  // Marke
  x.save();
  x.translate(80, 80);
  x.fillStyle = '#fff';
  rr(x, 0, 0, 64, 64, 16);
  x.fill();
  x.strokeStyle = '#131722';
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(18, 20);
  x.lineTo(32, 46);
  x.lineTo(46, 20);
  x.stroke();
  x.restore();
  text(x, 'VANTA', 164, 124, 600, 30, '#fff', { spacing: 8 });
  return { c, x };
}

function line(x, a, b, c, d) {
  x.beginPath();
  x.moveTo(a, b);
  x.lineTo(c, d);
  x.stroke();
}

function rr(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function text(x, s, px, py, weight, size, color, { align = 'left', spacing = 0 } = {}) {
  x.font = `${weight} ${size}px ${FONT}`;
  x.fillStyle = color;
  x.textAlign = align;
  if ('letterSpacing' in x) x.letterSpacing = `${spacing}px`;
  x.fillText(s, px, py);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  return x.measureText(s).width + (spacing ? spacing * s.length : 0);
}

function pill(x, s, px, py, { bg = 'rgba(255,255,255,0.1)', fg = '#fff', size = 30 } = {}) {
  x.font = `700 ${size}px ${FONT}`;
  const w = x.measureText(s).width + size * 1.2;
  const h = size * 1.75;
  x.fillStyle = bg;
  rr(x, px, py, w, h, h / 2);
  x.fill();
  x.fillStyle = fg;
  x.textAlign = 'left';
  x.fillText(s, px + size * 0.6, py + h * 0.68);
  return w;
}

function fit(x, s, weight, max, maxW) {
  let size = max;
  x.font = `${weight} ${size}px ${FONT}`;
  while (x.measureText(s).width > maxW && size > 40) {
    size -= 4;
    x.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

function dateLong(iso) {
  const d = parseDate(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function tradeCard(t) {
  const { c, x } = base();
  text(x, dateLong(t.date), W - 80, 124, 500, 30, 'rgba(255,255,255,0.55)', { align: 'right' });

  const sideBg = t.side === 'long' ? 'rgba(46,230,192,0.16)' : 'rgba(255,107,120,0.16)';
  const sideFg = t.side === 'long' ? UP : DOWN;
  const size = fit(x, t.symbol, 800, 150, W - 160);
  text(x, t.symbol, 80, 360, 800, size, '#fff', { spacing: -2 });
  pill(x, t.side === 'long' ? 'LONG' : 'SHORT', 80, 400, { bg: sideBg, fg: sideFg });

  const r = rOf(t);
  const closed = t.status === 'closed';
  const main = !closed ? 'OFFEN' : r != null ? fmtR(r) : fmtEur(t.pnl);
  const col = !closed ? '#fff' : t.pnl > 0 ? UP : t.pnl < 0 ? DOWN : '#fff';
  const ms = fit(x, main, 800, 220, W - 160);
  text(x, main, 80, 670, 800, ms, col, { spacing: -4 });
  if (closed) {
    const sub = [r != null ? fmtEur(t.pnl) : null, OUTCOME_LABEL[outcome(t)]].filter(Boolean).join('  ·  ');
    text(x, sub, 84, 790, 600, 40, 'rgba(255,255,255,0.6)');
  }

  // Regeln und Sinn
  const ok = rulesOk(t);
  let px = 80;
  px += pill(x, ok ? '✓  Regeln eingehalten' : '✕  Regeln gebrochen', px, 870, { bg: ok ? '#fff' : DOWN, fg: ok ? '#131722' : '#fff', size: 32 }) + 16;
  if (t.sense) pill(x, `Sinn ${t.sense}/5`, px, 870, { size: 32 });

  // Haken
  const labels = [];
  for (const g of GROUPS) {
    if (g.type === 'toggle') {
      if (t.checks?.[g.key]) labels.push(g.short || g.label);
    } else {
      for (const [v, l] of g.options) if ((t.checks?.[g.key] || []).includes(v)) labels.push(`${g.prefix} ${l}`);
    }
  }
  let cx = 80;
  let cy = 1000;
  x.font = `600 28px ${FONT}`;
  for (const l of labels) {
    const w = x.measureText(l).width + 40;
    if (cx + w > W - 80) {
      cx = 80;
      cy += 66;
    }
    if (cy > 1180) break;
    x.strokeStyle = 'rgba(255,255,255,0.22)';
    x.lineWidth = 2;
    rr(x, cx, cy, w, 50, 12);
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.textAlign = 'left';
    x.fillText(l, cx + 20, cy + 34);
    cx += w + 12;
  }

  text(x, 'Trading-Journal', 80, H - 80, 500, 28, 'rgba(255,255,255,0.35)');
  return c;
}

export function weekCard(list, range, accName = '') {
  const { c, x } = base();
  const s = summarize(list);
  const label = `${range.start.getDate()}.${range.start.getMonth() !== range.end.getMonth() ? `${range.start.getMonth() + 1}.` : ''} – ${range.end.getDate()}. ${MONTHS[range.end.getMonth()]}`;
  text(x, 'WOCHE', W - 80, 124, 600, 28, 'rgba(255,255,255,0.55)', { align: 'right', spacing: 4 });
  text(x, label, 80, 330, 800, fit(x, label, 800, 96, W - 160), '#fff', { spacing: -2 });
  if (accName) text(x, accName, 84, 390, 500, 34, 'rgba(255,255,255,0.5)');

  const main = s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur);
  text(x, main, 80, 620, 800, fit(x, main, 800, 210, W - 160), s.sumEur > 0 ? UP : s.sumEur < 0 ? DOWN : '#fff', { spacing: -4 });
  if (s.nR) text(x, fmtEur(s.sumEur), 84, 690, 600, 40, 'rgba(255,255,255,0.6)');

  // Kennzahlen
  const kpis = [
    ['Trades', String(s.n)],
    ['Treffer', fmtPct(s.wr)],
    ['Regeln', fmtPct(s.rulesPct)],
  ];
  kpis.forEach(([l, v], i) => {
    const px = 80 + i * 310;
    text(x, l.toUpperCase(), px, 790, 600, 26, 'rgba(255,255,255,0.45)', { spacing: 3 });
    text(x, v, px, 860, 750, 64, '#fff');
  });

  // Tagesbalken Mo–So
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(range.start);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ds = summarize(list.filter((t) => t.date === iso));
    days.push(ds.n ? (ds.nR ? ds.sumR : ds.sumEur) : null);
  }
  const maxAbs = Math.max(1e-9, ...days.map((v) => Math.abs(v || 0)));
  const mid = 1080;
  const bw = 96;
  const gap = (W - 160 - bw * 7) / 6;
  x.strokeStyle = 'rgba(255,255,255,0.18)';
  x.setLineDash([6, 8]);
  line(x, 80, mid, W - 80, mid);
  x.setLineDash([]);
  days.forEach((v, i) => {
    const px = 80 + i * (bw + gap);
    text(x, 'MDMDFSS'[i], px + bw / 2, 1260, 600, 28, 'rgba(255,255,255,0.45)', { align: 'center' });
    if (v == null) return;
    const h = Math.max(8, (Math.abs(v) / maxAbs) * 120);
    x.fillStyle = v >= 0 ? UP : DOWN;
    rr(x, px, v >= 0 ? mid - h : mid, bw, h, 10);
    x.fill();
  });
  return c;
}

// Vorschau im Sheet, Teilen braucht einen frischen Tipp (Safari)
export async function shareCanvas(canvas, name) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const w = sheet(`<div class="sheet-body">
      <h3>Teilen</h3>
      <img class="share-preview" src="${url}" alt="">
      <div class="sheet-actions"><button class="btn primary block" data-share>${icon('up')} Bild teilen oder sichern</button></div>
    </div>`, { onClose: () => setTimeout(() => URL.revokeObjectURL(url), 500) });
  w.querySelector('[data-share]').onclick = async () => {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        w.close();
      } catch (e) {
        if (e.name !== 'AbortError') toast('Teilen nicht möglich');
      }
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    toast('Bild gespeichert');
  };
}

export const bestWorst = (list) => {
  const sorted = [...list].sort((a, b) => (rOf(b) ?? b.pnl) - (rOf(a) ?? a.pnl));
  return { best: sorted[0], worst: sorted.length > 1 ? sorted[sorted.length - 1] : null, ordered: [...list].sort(byClose) };
};
