// Trades: offene oben, darunter abgeschlossene nach Monat
import { activeAccount, accTrades } from '../store.js';
import { rOf, rulesOk, missing, summarize, outcome, OUTCOME_LABEL } from '../model.js';
import { esc, fmtEur, fmtR, fmtDate, fmtPct, icon, sideTag, ruleMark, tone, topbar, MONTHS } from '../ui.js';
import { openClose } from './close.js';
import { editAccount } from '../accounts.js';

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

export function openCard(t) {
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

const filt = { q: '', f: 'all' };
const FILTERS = [
  ['all', 'Alle'],
  ['win', 'Win'],
  ['loss', 'Loss'],
  ['broken', 'Regeln ✕'],
  ['mistake', 'Mit Fehler'],
  ['shots', 'Screenshot'],
];

function matches(t) {
  const q = filt.q.trim().toUpperCase();
  if (q && !`${t.symbol} ${t.note || ''} ${t.lesson || ''}`.toUpperCase().includes(q)) return false;
  switch (filt.f) {
    case 'win': return t.status === 'closed' && outcome(t) === 'win';
    case 'loss': return t.status === 'closed' && outcome(t) === 'loss';
    case 'broken': return t.status === 'closed' && !rulesOk(t);
    case 'mistake': return !!t.mistakes?.length;
    case 'shots': return !!t.shots?.length;
    default: return true;
  }
}

function results(trades) {
  const list = trades.filter(matches);
  const open = list.filter((t) => t.status === 'open');
  const closed = list.filter((t) => t.status === 'closed');
  const filtered = filt.q.trim() || filt.f !== 'all';

  const months = new Map();
  for (const t of closed) {
    const k = t.date.slice(0, 7);
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(t);
  }

  const openHtml = open.length
    ? `<section class="block">
        <div class="block-head"><h2>Offen</h2><span class="count">${open.length}</span></div>
        <div class="open-list">${open.map(openCard).join('')}</div>
      </section>`
    : '';

  const summary = filtered && closed.length
    ? (() => {
        const s = summarize(closed);
        return `<div class="filter-sum"><span>${closed.length} Treffer</span><span class="num ${tone(s.sumEur)}">${s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur)}</span><span>${fmtPct(s.wr)} Win</span><span>Ø ${s.avgR == null ? '–' : fmtR(s.avgR)}</span></div>`;
      })()
    : '';

  const monthsHtml = [...months]
    .map(([k, l]) => {
      const s = summarize(l);
      const [y, m] = k.split('-').map(Number);
      return `<section class="block">
        <div class="block-head">
          <h2>${MONTHS[m - 1]} ${y}</h2>
          <span class="head-stats">
            <span class="num ${tone(s.sumR)}">${s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur)}</span>
            <span class="muted">· ${l.length} · ${fmtPct(s.wr)}</span>
          </span>
        </div>
        <div class="rows">${l.map(closedRow).join('')}</div>
      </section>`;
    })
    .join('');

  const none = filtered && !list.length ? '<div class="empty small"><h2>Nichts gefunden</h2><p>Kein Trade passt zu Suche und Filter.</p></div>' : '';
  return summary + openHtml + monthsHtml + none;
}

export function listView(root) {
  const trades = [...accTrades()].sort(byDateDesc);
  const acc = activeAccount();

  const banner = !(acc.size > 0)
    ? `<button class="banner" data-acc-edit>
        <div><b>Startkapital eintragen</b><span>Damit Vanta dein Ergebnis in R ausrechnet.</span></div>${icon('chevron')}
      </button>`
    : '';

  const empty = !trades.length
    ? `<div class="empty">
        <div class="empty-mark">V</div>
        <h2>Noch keine Trades</h2>
        <p>Vor dem Trade: Bias und Entry abhaken.<br>Danach: Ergebnis eintragen.</p>
        <a class="btn primary" href="#/new">${icon('plus')} Ersten Trade anlegen</a>
      </div>`
    : '';

  const tools = trades.length > 3
    ? `<div class="list-tools">
        <label class="search">${icon('search')}<input type="search" data-q value="${esc(filt.q)}" placeholder="Symbol, Notiz, Lektion" autocomplete="off" autocapitalize="characters"></label>
        <div class="chips filters">${FILTERS.map(([k, l]) => `<button class="chip sm ${filt.f === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      </div>`
    : '';

  root.innerHTML = `${topbar({ title: 'Trades', sub: esc(acc.name), right: `<a class="tb-btn" href="#/new" aria-label="Neuer Trade">${icon('plus')}</a>` })}
    <main class="page">${banner}${empty}${tools}<div data-results>${results(trades)}</div></main>`;

  const res = root.querySelector('[data-results]');
  const refresh = () => {
    res.innerHTML = results(trades);
    bindOpenCards(root, () => listView(root));
  };
  root.querySelector('[data-q]')?.addEventListener('input', (e) => {
    filt.q = e.target.value;
    refresh();
  });
  root.querySelectorAll('[data-f]').forEach((b) => {
    b.onclick = () => {
      filt.f = filt.f === b.dataset.f && b.dataset.f !== 'all' ? 'all' : b.dataset.f;
      root.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x.dataset.f === filt.f));
      refresh();
    };
  });

  bindOpenCards(root, () => listView(root));
  root.querySelector('[data-acc-edit]')?.addEventListener('click', () => editAccount(acc.id, () => listView(root)));
}

export function bindOpenCards(root, done) {
  root.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => openClose(b.dataset.close, done);
  });
}
