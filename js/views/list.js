// Trades: offene oben, darunter abgeschlossene nach Monat
import { state } from '../store.js';
import { rOf, rulesOk, missing, summarize, outcome, OUTCOME_LABEL } from '../model.js';
import { esc, fmtEur, fmtR, fmtDate, fmtPct, icon, sideTag, ruleMark, tone, topbar, MONTHS } from '../ui.js';
import { openClose } from './close.js';

const byDateDesc = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);

export function closedRow(t) {
  const r = rOf(t);
  const o = outcome(t);
  return `<a class="row" href="#/trade/${t.id}">
    <div class="row-main">
      <div class="row-title"><b>${esc(t.symbol)}</b>${sideTag(t.side)}</div>
      <div class="row-sub">${fmtDate(t.date)} · ${OUTCOME_LABEL[o]}${t.sense ? ` · Sinn ${t.sense}/5` : ''}</div>
    </div>
    ${ruleMark(rulesOk(t))}
    <div class="row-val">
      <div class="num ${tone(r ?? t.pnl)}">${r != null ? fmtR(r) : fmtEur(t.pnl)}</div>
      ${r != null ? `<div class="num muted small">${fmtEur(t.pnl)}</div>` : ''}
    </div>
  </a>`;
}

function openCard(t) {
  const miss = missing(t.checks);
  return `<div class="open-card">
    <a class="open-main" href="#/trade/${t.id}">
      <div class="row-title"><b>${esc(t.symbol)}</b>${sideTag(t.side)}</div>
      <div class="row-sub">${fmtDate(t.date)}${t.sense ? ` · Sinn ${t.sense}/5` : ''}</div>
      <div class="open-rules ${miss.length ? 'bad' : 'ok'}">
        ${miss.length ? `Fehlt: ${miss.map((g) => esc(g.label)).join(', ')}` : `${icon('check')} Regeln erfüllt`}
      </div>
    </a>
    <button class="btn primary sm" data-close="${t.id}">Abschließen</button>
  </div>`;
}

export function listView(root) {
  const trades = [...state.trades].sort(byDateDesc);
  const open = trades.filter((t) => t.status === 'open');
  const closed = trades.filter((t) => t.status === 'closed');

  const months = new Map();
  for (const t of closed) {
    const k = t.date.slice(0, 7);
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(t);
  }

  const banner = !(state.settings.account > 0)
    ? `<a class="banner" href="#/settings">
        <div><b>Kontogröße eintragen</b><span>Damit Vanta dein Ergebnis in R ausrechnet (1 % Risiko).</span></div>${icon('chevron')}
      </a>`
    : '';

  const empty = !trades.length
    ? `<div class="empty">
        <div class="empty-mark">V</div>
        <h2>Noch keine Trades</h2>
        <p>Vor dem Trade: Bias und Entry abhaken.<br>Danach: Ergebnis eintragen.</p>
        <a class="btn primary" href="#/new">${icon('plus')} Ersten Trade anlegen</a>
      </div>`
    : '';

  const openHtml = open.length
    ? `<section class="block">
        <div class="block-head"><h2>Offen</h2><span class="count">${open.length}</span></div>
        <div class="open-list">${open.map(openCard).join('')}</div>
      </section>`
    : '';

  const monthsHtml = [...months]
    .map(([k, list]) => {
      const s = summarize(list);
      const [y, m] = k.split('-').map(Number);
      return `<section class="block">
        <div class="block-head">
          <h2>${MONTHS[m - 1]} ${y}</h2>
          <span class="head-stats">
            <span class="num ${tone(s.sumR)}">${s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur)}</span>
            <span class="muted">· ${list.length} · ${fmtPct(s.wr)}</span>
          </span>
        </div>
        <div class="rows">${list.map(closedRow).join('')}</div>
      </section>`;
    })
    .join('');

  root.innerHTML = `${topbar({ title: 'Trades', right: `<a class="tb-btn" href="#/new" aria-label="Neuer Trade">${icon('plus')}</a>` })}
    <main class="page">${banner}${empty}${openHtml}${monthsHtml}</main>`;

  root.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => openClose(b.dataset.close, () => listView(root));
  });
}
