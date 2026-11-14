// Kalender: Tages-Ergebnis pro Monat
import { state } from '../store.js';
import { summarize, isoDate } from '../model.js';
import { fmtR, fmtEur, fmtPct, tone, topbar, icon, sheet, MONTHS, fmtDate } from '../ui.js';
import { closedRow } from './list.js';

const ui = { y: null, m: null, unit: 'R' };

const short = (v, unit) => {
  if (v == null) return '';
  const a = Math.abs(v);
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  if (unit === 'R') return `${s}${a.toFixed(1).replace('.', ',')}R`;
  return `${s}${a >= 1000 ? `${(a / 1000).toFixed(1).replace('.', ',')}k` : Math.round(a)}€`;
};

export function calendarView(root) {
  const now = new Date();
  if (ui.y == null) [ui.y, ui.m] = [now.getFullYear(), now.getMonth()];
  const key = `${ui.y}-${String(ui.m + 1).padStart(2, '0')}`;
  const closed = state.trades.filter((t) => t.status === 'closed' && t.date.startsWith(key));
  const byDay = new Map();
  for (const t of closed) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }
  const ms = summarize(closed);
  const first = new Date(ui.y, ui.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(ui.y, ui.m + 1, 0).getDate();
  const today = isoDate();

  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="cal-cell blank"></span>';
  for (let d = 1; d <= daysIn; d++) {
    const iso = `${key}-${String(d).padStart(2, '0')}`;
    const list = byDay.get(iso);
    const s = list ? summarize(list) : null;
    const v = s ? (ui.unit === 'R' && s.nR ? s.sumR : s.sumEur) : null;
    const u = s && ui.unit === 'R' && s.nR ? 'R' : 'EUR';
    cells += `<button class="cal-cell ${s ? `has ${tone(v) || 'flat'}` : ''} ${iso === today ? 'today' : ''}" ${s ? `data-day="${iso}"` : 'disabled'}>
      <span class="cal-d">${d}</span>${s ? `<span class="cal-v num">${short(v, u)}</span><span class="cal-n">${list.length}</span>` : ''}
    </button>`;
  }

  root.innerHTML = `${topbar({ title: 'Kalender' })}
    <main class="page">
      <div class="cal-nav">
        <button class="tb-btn" data-prev aria-label="Vorheriger Monat">${icon('back')}</button>
        <h2>${MONTHS[ui.m]} ${ui.y}</h2>
        <button class="tb-btn flip" data-next aria-label="Nächster Monat">${icon('back')}</button>
      </div>
      <section class="card cal-sum">
        <div><span class="tile-label">Monat</span><span class="num big ${tone(ms.sumEur)}">${ms.nR ? fmtR(ms.sumR) : fmtEur(ms.sumEur)}</span></div>
        <div><span class="tile-label">Trades</span><span class="num big">${ms.n}</span></div>
        <div><span class="tile-label">Treffer</span><span class="num big">${fmtPct(ms.wr)}</span></div>
        <div class="seg two mini" data-unit><button data-v="R" class="${ui.unit === 'R' ? 'on' : ''}">R</button><button data-v="EUR" class="${ui.unit === 'EUR' ? 'on' : ''}">€</button></div>
      </section>
      <section class="card cal">
        <div class="cal-wd">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
      </section>
    </main>`;

  root.querySelector('[data-prev]').onclick = () => {
    if (--ui.m < 0) [ui.m, ui.y] = [11, ui.y - 1];
    calendarView(root);
  };
  root.querySelector('[data-next]').onclick = () => {
    if (++ui.m > 11) [ui.m, ui.y] = [0, ui.y + 1];
    calendarView(root);
  };
  root.querySelectorAll('[data-unit] button').forEach((b) => {
    b.onclick = () => {
      ui.unit = b.dataset.v;
      calendarView(root);
    };
  });
  root.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = () => {
      const list = byDay.get(b.dataset.day);
      const s = summarize(list);
      const w = sheet(`<div class="sheet-body">
        <h3>${fmtDate(b.dataset.day, true)}</h3>
        <p class="sheet-sub"><span class="num ${tone(s.sumEur)}">${s.nR ? fmtR(s.sumR) : ''} ${fmtEur(s.sumEur)}</span></p>
        <div class="rows">${list.map(closedRow).join('')}</div>
      </div>`);
      w.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => w.close()));
    };
  });
}
