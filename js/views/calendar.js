// Edge · Kalender: Gewinn und Verlust pro Handelstag, Wochensummen, Tagesdetails
import { S, activeAccount, tradesOn } from '../store.js';
import { fmtMoney, tone, accountState, kpis } from '../edge.js';
import { tradeRow } from './trades.js';
import { icon } from '../ui.js';
import { $, today, fromISO, addDays, addMonths, firstOfMonth, MONTHS, WD_LONG, fmtNum, fmtDayMonth, relDay, haptic } from '../util.js';
import { act } from '../app.js';

let month = firstOfMonth(today());
let sel = today();

export function enter(opts = {}) {
  if (opts.date) {
    sel = opts.date;
    month = firstOfMonth(opts.date);
  }
}

// Kompakte Beträge für die Kästchen: 320, 1,2k
function short(v) {
  const a = Math.abs(v);
  const s = a >= 10000 ? `${fmtNum(a / 1000, 0)}k` : a >= 1000 ? `${fmtNum(a / 1000, 1)}k` : fmtNum(a, 0);
  return `${v < 0 ? '−' : '+'}${s}`;
}

export function render() {
  const acc = activeAccount();
  return `
  <header class="vhead cal-head">
    <div class="vhead-text"><div class="eyebrow">Kalender</div><h1 class="vtitle" id="cal-title">${titleHTML()}</h1></div>
    <div class="head-actions">
      <button type="button" class="icon-btn" data-act="cal-shift" data-d="-1" aria-label="Voriger Monat">${icon('chevL')}</button>
      <button type="button" class="icon-btn" data-act="cal-shift" data-d="1" aria-label="Nächster Monat">${icon('chevR')}</button>
    </div>
  </header>
  ${acc ? `<section class="card cal-card" id="cal-card">${gridHTML(acc)}</section><div id="day-panel" class="day-panel">${dayPanel(acc)}</div>` : '<p class="empty">Lege zuerst dein Konto an.</p>'}`;
}

function titleHTML() {
  const d = fromISO(month);
  return `${MONTHS[d.getMonth()]} <em>${d.getFullYear()}</em>`;
}

function gridHTML(acc) {
  const t = today();
  const first = fromISO(month);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(month, -offset);
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((offset + dim) / 7);
  const st = accountState(acc);
  const lim = st.dailyLimit;
  // Farbstärke relativ zum größten Tag im Monat (oder zum Tageslimit)
  let maxAbs = 1;
  for (let i = 0; i < weeks * 7; i++) {
    const v = Math.abs(dayNet(acc, addDays(start, i)) || 0);
    if (v > maxAbs) maxAbs = v;
  }
  if (lim) maxAbs = Math.max(maxAbs, lim * 0.5);
  let html = `<div class="pcal-wd">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span>${w}</span>`).join('')}<span>Woche</span></div><div class="pcal">`;
  let monthNet = 0;
  let monthDays = 0;
  let green = 0;
  for (let w = 0; w < weeks; w++) {
    let wk = 0;
    let wkHas = false;
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, w * 7 + i);
      const other = d.slice(0, 7) !== month.slice(0, 7);
      const v = dayNet(acc, d);
      const n = tradesOn(d, acc.id).length;
      if (v != null) {
        wk += v;
        wkHas = true;
        if (!other) {
          monthNet += v;
          monthDays++;
          if (v > 0) green++;
        }
      }
      const a = v == null ? 0 : Math.min(1, Math.abs(v) / maxAbs);
      const breach = lim && v != null && v <= -lim;
      html += `<button type="button" class="pd ${other ? 'other' : ''} ${d === t ? 'today' : ''} ${d === sel ? 'sel' : ''} ${v != null ? tone(v) : ''} ${breach ? 'breach' : ''}" style="--a:${(0.12 + a * 0.5).toFixed(2)}" data-act="cal-day" data-date="${d}" aria-label="${fmtDayMonth(d)}${v != null ? `, ${fmtMoney(v, acc.currency, { sign: true })}` : ''}">
        <span class="pd-n">${fromISO(d).getDate()}</span>${v != null ? `<span class="pd-v">${short(v)}</span><span class="pd-c">${n}</span>` : ''}</button>`;
    }
    html += `<div class="pw ${wkHas ? tone(wk) : ''}">${wkHas ? short(wk) : ''}</div>`;
  }
  html += '</div>';
  html += `<div class="cal-sum"><span>${MONTHS[fromISO(month).getMonth()]}</span><b class="${tone(monthNet)}">${fmtMoney(monthNet, acc.currency, { sign: true })}</b><span>${monthDays ? `${green} von ${monthDays} Tagen im Plus` : 'noch keine Trades'}</span></div>`;
  return html;
}
function dayNet(acc, d) {
  const ts = tradesOn(d, acc.id);
  return ts.length ? ts.reduce((s, t) => s + t.pnl, 0) : null;
}

function dayPanel(acc) {
  const ts = tradesOn(sel, acc.id).slice().reverse();
  const day = S.days.get(sel);
  const k = kpis(ts);
  const rel = relDay(sel);
  const d = fromISO(sel);
  const title = `${rel || WD_LONG[d.getDay()]}, <em>${fmtDayMonth(sel)}</em>`;
  const hasPlan = day && (day.plan || day.levels || day.news || Object.values(day.bias || {}).some(Boolean) || S.pics.has(`plan:${sel}`));
  const hasReview = day && (day.mood || day.follow || day.good || day.better);
  const notes = [hasPlan ? 'Marktplan' : null, hasReview ? 'Rückblick' : null].filter(Boolean);
  return `<div class="dp-head"><h2 class="dp-title">${title}</h2><div class="dp-actions">${
    sel !== today() || month !== firstOfMonth(today()) ? '<button type="button" class="today-pill" data-act="cal-today">Heute</button>' : ''
  }</div></div>
  ${
    ts.length
      ? `<section class="card"><div class="tday-h"><span>${k.n} ${k.n === 1 ? 'Trade' : 'Trades'} · ${fmtNum((k.winRate || 0) * 100, 0)}&nbsp;% Treffer</span><b class="${tone(k.net)}">${fmtMoney(k.net, acc.currency, { sign: true })}</b></div>${ts.map((t) => tradeRow(t)).join('')}</section>`
      : '<p class="empty">An diesem Tag kein Trade.</p>'
  }
  <button type="button" class="card tip" data-act="go" data-to="journal" data-date="${sel}"><div class="tip-ic">${icon('journal')}</div><div><h3>${notes.length ? notes.join(' & ') : 'Tagebuch'}</h3><p>${notes.length ? 'Ansehen oder ergänzen' : 'Marktplan und Rückblick für diesen Tag'}</p></div><span class="x">${icon('chevR')}</span></button>`;
}

function paint() {
  const acc = activeAccount();
  if (!acc) return;
  $('#cal-title').innerHTML = titleHTML();
  $('#cal-card').innerHTML = gridHTML(acc);
  $('#day-panel').innerHTML = dayPanel(acc);
}
act('cal-shift', (el) => {
  month = addMonths(month, Number(el.dataset.d));
  haptic();
  paint();
});
act('cal-day', (el) => {
  sel = el.dataset.date;
  if (sel.slice(0, 7) !== month.slice(0, 7)) month = firstOfMonth(sel);
  haptic();
  paint();
});
act('cal-today', () => {
  sel = today();
  month = firstOfMonth(sel);
  haptic();
  paint();
});
