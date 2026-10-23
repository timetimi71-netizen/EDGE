// Edge · Analyse: Kennzahlen, Kontoverlauf, Erkenntnisse, Aufteilungen, R-Verteilung
import { S, activeAccount } from '../store.js';
import { kpis, insights, groupBy, DIMS, rOf, fmtMoney, fmtR, tone, symInfo, fmtHold, accountState } from '../edge.js';
import { equityChart, barChart } from '../charts.js';
import { icon, segHTML, setSeg } from '../ui.js';
import { $, esc, fmtNum, fmtShort, haptic, countUp } from '../util.js';
import { act } from '../app.js';

let range = '90';
let scope = 'acc';
let dim = 'symbol';

function pool() {
  const acc = activeAccount();
  const from = range === 'all' ? 0 : Date.now() - Number(range) * 864e5;
  return [...S.trades.values()].filter((t) => (scope === 'all' || t.accountId === acc?.id) && t.closeAt >= from).sort((a, b) => a.closeAt - b.closeAt);
}
const ccy = () => activeAccount()?.currency || 'USD';

export function render() {
  const multi = S.accounts.size > 1;
  return `
  <header class="vhead"><div class="vhead-text"><div class="eyebrow">Analyse</div><h1 class="vtitle">Wo geht dein <em>Geld</em> hin?</h1></div></header>
  ${segHTML('st-range', [
    ['30', '30 Tage'],
    ['90', '90 Tage'],
    ['all', 'Alles'],
  ], range)}
  ${multi ? segHTML('st-scope', [
    ['acc', 'Dieses Konto'],
    ['all', 'Alle Konten'],
  ], scope, 'sm') : ''}
  <div class="stack" id="st-body">${body()}</div>`;
}

function body() {
  const ts = pool();
  if (!ts.length) return '<section class="card empty-card">' + icon('stats', 'lg') + '<p>Hier erscheint deine Auswertung, sobald du Trades eingetragen hast. Je mehr, desto klarer wird, wo du Geld verdienst und wo du es verlierst.</p></section>';
  const k = kpis(ts);
  return [tilesHTML(k), equityHTML(ts, k), insightsHTML(ts), splitHTML(ts), rHTML(ts, k), extremesHTML(k)].join('');
}

function tilesHTML(k) {
  const c = ccy();
  const pf = k.pf === Infinity ? '∞' : k.pf != null ? fmtNum(k.pf, 2) : '–';
  const tile = (ic, label, v, sub, cls = '') => `<div class="stat ${cls}"><span class="k">${icon(ic)} ${label}</span><span class="v">${v}</span><span class="s">${sub}</span></div>`;
  return `<div class="tiles">
    ${tile('coin', 'Netto', `<span class="${tone(k.net)}">${fmtMoney(k.net, c, { sign: true })}</span>`, `${k.n} ${k.n === 1 ? 'Trade' : 'Trades'}`)}
    ${tile('target', 'Trefferquote', k.winRate != null ? `${fmtNum(k.winRate * 100, 0)}<small>%</small>` : '–', `${k.wins} Gewinner · ${k.losses} Verlierer`)}
    ${tile('layers', 'Profit-Faktor', pf, k.pf == null ? 'noch kein Verlust' : k.pf >= 1.5 ? 'stark' : k.pf >= 1 ? 'knapp im Plus' : 'unter 1: verliert Geld')}
    ${tile('bolt', 'Pro Trade', k.avgR != null ? `<span class="${tone(k.avgR)}">${fmtR(k.avgR)}</span>` : `<span class="${tone(k.expectancy)}">${fmtMoney(k.expectancy, c, { sign: true })}</span>`, k.avgR != null ? `im Schnitt, ${fmtMoney(k.expectancy, c, { sign: true })}` : 'im Schnitt')}
    ${tile('swap', 'Ø Gewinn / Verlust', `<span class="win">${fmtMoney(k.avgWin, c)}</span> <small>/</small> <span class="loss">${fmtMoney(Math.abs(k.avgLoss), c)}</span>`, k.payoff ? `Verhältnis ${fmtNum(k.payoff, 2)} : 1` : '–', 'wide-v')}
    ${tile('down', 'Max. Rückgang', `<span class="${k.maxDD < 0 ? 'loss' : ''}">${fmtMoney(k.maxDD, c)}</span>`, 'vom Höchststand')}
  </div>`;
}

function equityHTML(ts, k) {
  const c = ccy();
  let eq = 0;
  const values = [{ t: ts[0].openAt || ts[0].closeAt, v: 0 }, ...ts.map((t) => ({ t: t.closeAt, v: (eq += t.pnl) }))];
  const lines = [];
  const acc = activeAccount();
  if (scope === 'acc' && acc && range === 'all') {
    const st = accountState(acc);
    if (st.target) lines.push({ v: st.target, label: 'Ziel', cls: 'goal' });
    if (st.maxAmt) lines.push({ v: st.floor - st.size, label: 'Grenze', cls: 'limit' });
  }
  const short = (v) => {
    const a = Math.abs(v);
    return `${v < 0 ? '−' : ''}${a >= 1000 ? `${fmtNum(a / 1000, a >= 10000 || a % 1000 === 0 ? 0 : 1)}k` : fmtNum(a, 0)}`;
  };
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('stats')} Verlauf</h2><span class="${tone(k.net)} small" style="font-weight:700">${fmtMoney(k.net, c, { sign: true })}</span></div>
    ${equityChart({ values, lines, fmt: short })}
    <div class="chart-foot"><span>${esc(fmtShort(ts[0].day))}</span><span>${k.n} ${k.n === 1 ? 'Trade' : 'Trades'}</span><span>heute</span></div>
  </section>`;
}

function insightsHTML(ts) {
  const list = insights(ts, ccy());
  if (ts.length < 5) {
    return `<section class="card"><div class="card-h"><h2 class="card-t">${icon('sparkle')} Erkenntnisse</h2></div><p class="empty">Ab 5 Trades zeigt Edge dir hier, was dich Geld kostet und was gut läuft. Noch ${5 - ts.length === 1 ? 'einer' : 5 - ts.length}.</p></section>`;
  }
  if (!list.length) {
    return `<section class="card"><div class="card-h"><h2 class="card-t">${icon('sparkle')} Erkenntnisse</h2></div><p class="empty">Noch kein klares Muster. Trag bei jedem Trade Setup, Gefühl und Regeln ein, dann wird es deutlicher.</p></section>`;
  }
  const bad = list.filter((x) => x.tone !== 'good');
  const good = list.filter((x) => x.tone === 'good');
  const item = (x) => `<div class="ins ${x.tone}"><span class="ins-ic">${icon(x.tone === 'good' ? 'up' : x.tone === 'bad' ? 'down' : 'info')}</span><div><b>${esc(x.title)}</b><p>${x.text}</p></div></div>`;
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('sparkle')} Wo geht dein Geld verloren?</h2></div>
    ${bad.length ? bad.map(item).join('') : '<p class="empty">Keine klaren Verlustquellen. Weiter so.</p>'}
    ${good.length ? `<div class="sub-h">Was gut läuft</div>${good.map(item).join('')}` : ''}
    ${!ts.some((t) => t.setup || t.feelBefore || t.rulesOk != null) ? '<p class="note">Tipp: Mit Setup, Gefühl und Regeln bei jedem Trade findet Edge viel genauere Muster.</p>' : ''}
  </section>`;
}

function splitHTML(ts) {
  const d = DIMS.find((x) => x.id === dim) || DIMS[0];
  const rows = groupBy(ts, d);
  const c = ccy();
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return `<section class="card" id="st-split">
    <div class="card-h"><h2 class="card-t">${icon('layers')} Aufteilen nach</h2></div>
    <div class="chips scroll-chips">${DIMS.map((x) => `<button type="button" class="chip ${x.id === dim ? 'on' : ''}" data-act="st-dim" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    ${
      rows.length
        ? `<div class="splits">${rows
            .map(
              (r) => `<div class="split"><div class="sp-h"><span class="sp-k">${esc(r.key)}</span><b class="${tone(r.net)}">${fmtMoney(r.net, c, { sign: true })}</b></div>
          <div class="sp-bar ${tone(r.net)}"><i style="--w:${((Math.abs(r.net) / max) * 100).toFixed(1)}%"></i></div>
          <div class="sp-sub">${r.n} ${r.n === 1 ? 'Trade' : 'Trades'} · ${fmtNum(r.wr * 100, 0)}&nbsp;% Treffer${r.avgR != null ? ` · Ø ${fmtR(r.avgR)}` : ''}</div></div>`,
            )
            .join('')}</div>`
        : `<p class="empty">Noch keine Angaben zu „${esc(d.name)}“. Trag sie beim nächsten Trade ein.</p>`
    }
  </section>`;
}

function rHTML(ts, k) {
  if (k.rCount < 5) return '';
  // Auf ganze R gerundet: ein voller Stop (−1 R, mit Gebühren −1,03 R) landet so immer im selben Balken
  const B = [
    [-Infinity, -1.5, '≤ −2', 'st-bad'],
    [-1.5, -0.5, '−1', 'st-bad'],
    [-0.5, 0.5, '±0', 'st-ok'],
    [0.5, 1.5, '+1', 'st-good'],
    [1.5, 2.5, '+2', 'st-good'],
    [2.5, Infinity, '≥ +3', 'st-good'],
  ];
  const rs = ts.map(rOf).filter((r) => r != null);
  const items = B.map(([a, b, label, cls]) => {
    const n = rs.filter((r) => r >= a && r < b).length;
    return { value: n, label, cls, title: `${label} R: ${n}` };
  });
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('target')} R-Verteilung</h2><span class="faint small">gerundet · ${k.rCount} ${k.rCount === 1 ? 'Trade' : 'Trades'} mit SL</span></div>
    ${barChart({ items, max: Math.max(2, ...items.map((i) => i.value)), height: 140 })}
    <div class="debt"><span>Summe</span><b class="${tone(k.totalR)}">${fmtR(k.totalR)}</b></div>
  </section>`;
}

function extremesHTML(k) {
  const c = ccy();
  const row = (label, t) =>
    t ? `<button type="button" class="kv link-row" data-act="t-open" data-id="${esc(t.id)}"><span>${label}</span><b class="${tone(t.pnl)}">${esc(symInfo(t.symbol).sym)} ${fmtMoney(t.pnl, c, { sign: true })}</b></button>` : '';
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('trophy')} Serien &amp; Extreme</h2></div>
    <div class="kvs">
      ${row('Bester Trade', k.best)}
      ${row('Schlechtester Trade', k.worst)}
      <div class="kv"><span>Längste Gewinnserie</span><b>${k.winStreak}</b></div>
      <div class="kv"><span>Längste Verlustserie</span><b>${k.lossStreak}</b></div>
      ${k.holdW != null ? `<div class="kv"><span>Ø Haltedauer Gewinner / Verlierer</span><b>${fmtHold(k.holdW)} / ${fmtHold(k.holdL)}</b></div>` : ''}
    </div>
  </section>`;
}

function paintBody() {
  const b = $('#st-body');
  if (!b) return;
  b.innerHTML = body();
  [...b.children].forEach((c, i) => {
    c.classList.add('reveal');
    c.style.setProperty('--d', Math.min(i, 6));
  });
  countUp(b);
}
act('st-range', (el) => {
  range = el.dataset.v;
  setSeg(el);
  haptic();
  paintBody();
});
act('st-scope', (el) => {
  scope = el.dataset.v;
  setSeg(el);
  haptic();
  paintBody();
});
act('st-dim', (el) => {
  dim = el.dataset.v;
  haptic();
  $('#st-split').outerHTML = splitHTML(pool());
});
