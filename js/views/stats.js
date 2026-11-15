// Statistik: Kennzahlen, Equity, Regeln, Sinn, einzelne Haken, Symbol, Richtung, Wochentag
import { accTrades, activeAccount } from '../store.js';
import { summarize, rOf, rulesOk, FEATURES, parseDate, isoDate, maxDrawdown, MISTAKES, setupCombos, streaks } from '../model.js';
import { esc, fmtR, fmtEur, fmtPct, fmtNum, tone, topbar } from '../ui.js';
import { equityChart } from '../chart.js';
import { countUps, stagger, haptic } from '../fx.js';

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

function tile(label, value, sub = '', cls = '', cu = '') {
  return `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value num ${cls}" ${cu}>${value}</span>${sub ? `<span class="tile-sub">${sub}</span>` : ''}</div>`;
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

  const sk = streaks(list);
  const rs = list.map(rOf).filter((r) => r != null);
  const wR = rs.filter((r) => r > 0.1);
  const lR = rs.filter((r) => r < -0.1);
  const avgWin = wR.length ? wR.reduce((a, b) => a + b, 0) / wR.length : null;
  const avgLoss = lR.length ? Math.abs(lR.reduce((a, b) => a + b, 0) / lR.length) : null;

  // R-Verteilung
  const BUCKETS = [['≤ −1', (r) => r <= -0.95], ['−1…0', (r) => r > -0.95 && r < -0.1], ['BE', (r) => Math.abs(r) <= 0.1], ['0…1', (r) => r > 0.1 && r < 1], ['1…2', (r) => r >= 1 && r < 2], ['2…3', (r) => r >= 2 && r < 3], ['3+', (r) => r >= 3]];
  const dist = BUCKETS.map(([l, f]) => ({ l, n: rs.filter(f).length, neg: l.startsWith('≤') || l.startsWith('−') }));
  const distMax = Math.max(1, ...dist.map((d) => d.n));

  // Setup-Finder
  const combos = setupCombos(list);

  // Fehler
  const mkRows = MISTAKES.map(([k, l]) => ({ label: l, list: list.filter((t) => t.mistakes?.includes(k)) })).filter((r) => r.list.length);
  const clean = list.filter((t) => !t.mistakes?.length);
  const mkCost = mkRows.map((r) => ({ ...r, sum: r.list.reduce((a, t) => a + (rOf(t) ?? 0), 0) })).sort((a, b) => a.sum - b.sum);

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
      ${tile('Ergebnis', s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur), s.nR ? fmtEur(s.sumEur) : '', tone(s.sumEur), `data-cu="${s.nR ? s.sumR : s.sumEur}" data-cu-f="${s.nR ? 'R' : 'EUR'}"`)}
      ${tile('Trefferquote', fmtPct(s.wr), `${s.wins} W · ${s.losses} L · ${s.be} BE`, '', s.wr == null ? '' : `data-cu="${s.wr}" data-cu-f="pct"`)}
      ${tile('Ø R pro Trade', s.avgR == null ? '–' : fmtR(s.avgR), `${s.n} Trades`, tone(s.avgR), s.avgR == null ? '' : `data-cu="${s.avgR}" data-cu-f="R"`)}
      ${tile('Regeln eingehalten', fmtPct(s.rulesPct), `${s.rules} von ${s.n}`, '', `data-cu="${s.rulesPct}" data-cu-f="pct"`)}
      ${tile('Profit-Faktor', s.pf == null ? '–' : s.pf === Infinity ? '∞' : fmtNum(s.pf, 2), 'Gewinne ÷ Verluste')}
      ${tile('Längste Serie', `${sk.win} W`, `${sk.loss} Losses in Folge`)}
      ${tile('Ø Gewinn / Verlust', avgWin == null ? '–' : `${fmtNum(avgWin, 1)} : ${fmtNum(avgLoss, 1)}`, 'in R, Win zu Loss')}
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

    <div class="sec-title"><h2>Setup-Finder</h2></div>
    <p class="hint top">Deine besten Kombinationen aus HTF-Bestätigung und Einstieg, ab 3 Trades.</p>
    <section class="card flush">${combos.length ? `<div class="combos">${combos
      .slice(0, 6)
      .map((c, i) => `<div class="combo ${i === 0 && c.s.avgR > 0 ? 'top' : ''}">
        <span class="combo-rank">${i + 1}</span>
        <div class="combo-main"><b>${esc(c.conf)} <i>+</i> ${esc(c.model)}</b><small>${c.s.n} Trades · ${fmtPct(c.s.wr)} Treffer</small></div>
        <span class="num combo-r ${tone(c.s.avgR)}">${fmtR(c.s.avgR)}</span>
      </div>`)
      .join('')}</div>` : '<p class="hint pad">Noch zu wenige Trades je Kombination.</p>'}</section>

    <div class="sec-title"><h2>R-Verteilung</h2></div>
    <section class="card">
      <div class="dist">${dist.map((d) => `<div class="dist-col"><span class="dist-n num">${d.n || ''}</span><div class="dist-bar"><i class="${d.l === 'BE' ? 'flat' : d.neg ? 'down' : 'up'}" style="--h:${((d.n / distMax) * 100).toFixed(0)}%"></i></div><span class="dist-l">${d.l}</span></div>`).join('')}</div>
    </section>

    ${mkRows.length ? `<div class="sec-title"><h2>Was dich Fehler kosten</h2></div>
    <section class="card flush">
      ${mkCost.map((m) => `<div class="mk-row"><span>${esc(m.label)}</span><span class="muted">${m.list.length}× · ${fmtPct(summarize(m.list).wr)}</span><b class="num ${tone(m.sum)}">${fmtR(m.sum)}</b></div>`).join('')}
      <div class="mk-row clean"><span>Ohne Fehler</span><span class="muted">${clean.length}× · ${fmtPct(summarize(clean).wr)}</span><b class="num ${tone(summarize(clean).avgR)}">Ø ${summarize(clean).avgR == null ? '–' : fmtR(summarize(clean).avgR)}</b></div>
    </section>` : ''}

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
      haptic();
      statsView(root);
      stagger(root);
      countUps(root, { ms: 600 });
    };
  });
  root.querySelectorAll('[data-unit] button').forEach((b) => {
    b.onclick = () => {
      ui.unit = b.dataset.v;
      statsView(root);
    };
  });
}
