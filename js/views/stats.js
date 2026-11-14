// Statistik: Kennzahlen, Equity, Regeln, Sinn, einzelne Haken, Symbol, Richtung, Wochentag
import { accTrades, activeAccount } from '../store.js';
import { summarize, rOf, rulesOk, FEATURES, parseDate, isoDate, maxDrawdown } from '../model.js';
import { esc, fmtR, fmtEur, fmtPct, fmtNum, tone, topbar } from '../ui.js';
import { equityChart } from '../chart.js';

const ui = { period: 'all', unit: 'R' };

const PERIODS = [['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr'], ['all', 'Alles']];

function since(period) {
  const d = new Date();
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (period === 'month') d.setDate(1);
  else if (period === 'year') d.setMonth(0, 1);
  else return '';
  return isoDate(d);
}

function tile(label, value, sub = '', cls = '') {
  return `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value num ${cls}">${value}</span>${sub ? `<span class="tile-sub">${sub}</span>` : ''}</div>`;
}

// Tabelle: Gruppe | Trades | Treffer | Ø R | Σ R
function table(rows, { sum = true } = {}) {
  const body = rows
    .map(({ label, list, sub }) => {
      const s = summarize(list);
      return `<tr>
        <td class="t-label">${label}${sub ? `<small>${sub}</small>` : ''}</td>
        <td class="num">${s.n}</td>
        <td class="num">${fmtPct(s.wr)}</td>
        <td class="num ${tone(s.avgR)}">${s.avgR == null ? '–' : fmtR(s.avgR).replace(' R', '')}</td>
        ${sum ? `<td class="num ${tone(s.sumR)}">${s.nR ? fmtR(s.sumR).replace(' R', '') : '–'}</td>` : ''}
      </tr>`;
    })
    .join('');
  return `<table class="tbl"><thead><tr><th></th><th>Trades</th><th>Treffer</th><th>Ø R</th>${sum ? '<th>Σ R</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
}

function matrixCell(list, title) {
  const s = summarize(list);
  return `<div class="mx-cell ${s.n ? tone(s.avgR) : 'none'}">
    <span class="mx-title">${title}</span>
    <span class="mx-val num">${s.avgR == null ? '–' : fmtR(s.avgR)}</span>
    <span class="mx-sub">${s.n} Trades · ${fmtPct(s.wr)}</span>
  </div>`;
}

export function statsView(root) {
  const from = since(ui.period);
  const list = accTrades()
    .filter((t) => t.status === 'closed' && (!from || t.date >= from))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.closedAt || 0) - (b.closedAt || 0));
  const s = summarize(list);

  const head = `${topbar({ title: 'Statistik', sub: esc(activeAccount().name) })}
    <main class="page">
    <div class="seg four period" data-period>${PERIODS.map(([k, l]) => `<button data-v="${k}" class="${ui.period === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;

  if (!list.length) {
    root.innerHTML = `${head}<div class="empty small"><h2>Keine abgeschlossenen Trades</h2><p>Im gewählten Zeitraum gibt es noch nichts auszuwerten.</p></div></main>`;
    bind(root);
    return;
  }

  // Drawdown in R und €
  let cr = 0;
  let ce = 0;
  const ddR = s.nR ? maxDrawdown(list.map((t) => (cr += rOf(t) ?? 0))) : 0;
  const ddE = maxDrawdown(list.map((t) => (ce += t.pnl || 0)));

  // Equity
  let acc = 0;
  const eq = list.map((t) => (acc += ui.unit === 'R' ? rOf(t) ?? 0 : t.pnl));

  const ruled = list.filter(rulesOk);
  const broken = list.filter((t) => !rulesOk(t));
  const rated = list.filter((t) => t.sense);
  const hi = (t) => t.sense >= 4;

  const featureRows = FEATURES.map((f) => {
    const w = list.filter((t) => f.test(t.checks));
    const wo = list.filter((t) => !f.test(t.checks));
    const so = summarize(wo);
    return { label: esc(f.label), list: w, sub: `ohne: ${so.n} · ${fmtPct(so.wr)} · ${so.avgR == null ? '–' : fmtR(so.avgR)}`, section: f.section };
  });

  const symbols = [...new Set(list.map((t) => t.symbol))]
    .map((sym) => ({ label: esc(sym), list: list.filter((t) => t.symbol === sym) }))
    .sort((a, b) => b.list.length - a.list.length);

  const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const days = WD.map((label, i) => ({ label, list: list.filter((t) => (parseDate(t.date).getDay() + 6) % 7 === i) })).filter((d) => d.list.length);

  root.innerHTML = `${head}
    <section class="tiles">
      ${tile('Ergebnis', s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur), s.nR ? fmtEur(s.sumEur) : '', tone(s.sumEur))}
      ${tile('Trefferquote', fmtPct(s.wr), `${s.wins} W · ${s.losses} L · ${s.be} BE`)}
      ${tile('Ø R pro Trade', s.avgR == null ? '–' : fmtR(s.avgR), `${s.n} Trades`, tone(s.avgR))}
      ${tile('Regeln eingehalten', fmtPct(s.rulesPct), `${s.rules} von ${s.n}`)}
      ${tile('Profit-Faktor', s.pf == null ? '–' : s.pf === Infinity ? '∞' : fmtNum(s.pf, 2), 'Gewinne ÷ Verluste')}
      ${tile('Max. Drawdown', ddR ? fmtR(-ddR) : '–', ddE ? fmtEur(-ddE) : 'vom Hoch', ddR ? 'down' : '')}
    </section>

    <div class="sec-title"><h2>Equity</h2>
      <div class="seg two mini" data-unit><button data-v="R" class="${ui.unit === 'R' ? 'on' : ''}">R</button><button data-v="EUR" class="${ui.unit === 'EUR' ? 'on' : ''}">€</button></div>
    </div>
    <section class="card">${equityChart(eq, ui.unit)}</section>

    <div class="sec-title"><h2>Regeln eingehalten vs. gebrochen</h2></div>
    <section class="card flush">${table([
      { label: 'Eingehalten', list: ruled },
      { label: 'Gebrochen', list: broken },
    ])}</section>

    <div class="sec-title"><h2>Regeln × Sinn</h2></div>
    <section class="card">
      ${rated.length ? `<div class="matrix">
        <span></span><span class="mx-axis">Sinn 4–5</span><span class="mx-axis">Sinn 1–3</span>
        <span class="mx-axis side">Regeln ✓</span>${matrixCell(rated.filter((t) => rulesOk(t) && hi(t)), 'Beides passt')}${matrixCell(rated.filter((t) => rulesOk(t) && !hi(t)), 'Nur Regeln')}
        <span class="mx-axis side">Regeln ✗</span>${matrixCell(rated.filter((t) => !rulesOk(t) && hi(t)), 'Nur Gefühl')}${matrixCell(rated.filter((t) => !rulesOk(t) && !hi(t)), 'Nichts passt')}
      </div>
      <p class="hint">Zeigt, ob du besser fährst, wenn du den Regeln folgst oder deinem Gefühl.</p>`
      : '<p class="hint">Bewerte bei deinen Trades „Macht der Trade Sinn?“, dann erscheint hier der Vergleich.</p>'}
    </section>

    ${rated.length ? `<div class="sec-title"><h2>Nach „Macht Sinn“</h2></div>
    <section class="card flush">${table([5, 4, 3, 2, 1].map((n) => ({ label: `${n} / 5`, list: rated.filter((t) => t.sense === n) })).filter((r) => r.list.length))}</section>` : ''}

    <div class="sec-title"><h2>Haken im Vergleich</h2></div>
    <p class="hint top">Ergebnis der Trades <b>mit</b> diesem Haken, darunter <b>ohne</b>.</p>
    ${['Bias', 'Entry']
      .map(
        (sec) => `<section class="card flush"><div class="tbl-cap">${sec}</div>${table(featureRows.filter((r) => r.section === sec), { sum: false })}</section>`,
      )
      .join('')}

    <div class="sec-title"><h2>Long / Short</h2></div>
    <section class="card flush">${table([
      { label: 'Long', list: list.filter((t) => t.side === 'long') },
      { label: 'Short', list: list.filter((t) => t.side === 'short') },
    ])}</section>

    <div class="sec-title"><h2>Symbole</h2></div>
    <section class="card flush">${table(symbols)}</section>

    <div class="sec-title"><h2>Wochentag</h2></div>
    <section class="card flush">${table(days)}</section>
    </main>`;
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-period] button').forEach((b) => {
    b.onclick = () => {
      ui.period = b.dataset.v;
      statsView(root);
    };
  });
  root.querySelectorAll('[data-unit] button').forEach((b) => {
    b.onclick = () => {
      ui.unit = b.dataset.v;
      statsView(root);
    };
  });
}
