// Home: Konto, Woche, offene Trades, Disziplin, Erkenntnis, letzte Trades
import { state, activeAccount, accTrades } from '../store.js';
import { accountState, summarize, rulesOk, isoDate, parseDate, byClose } from '../model.js';
import { esc, icon, fmtEur, fmtMoney, fmtR, fmtPct, fmtSignedPct, tone, MONTHS } from '../ui.js';
import { sparkline } from '../chart.js';
import { insights } from '../insights.js';
import { openAccounts, editAccount } from '../accounts.js';
import { closedRow, openCard, bindOpenCards } from './list.js';

const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const ui = { insight: 0, counted: false };

function greeting(h) {
  if (h < 5) return 'Noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

function accountCard(acc, st) {
  const badge = {
    live: '<span class="acc-badge live"><i></i>Läuft</span>',
    passed: `<span class="acc-badge passed">${icon('check')} Ziel erreicht</span>`,
    breach: `<span class="acc-badge breach">${icon('x')} Limit verletzt</span>`,
  }[st.status];

  if (!acc.size) {
    return `<button class="acc-card" data-acc-edit>
      <div class="acc-top"><span class="acc-name">${esc(acc.name)}</span>${icon('chevron')}</div>
      <div class="acc-setup"><b>Startkapital eintragen</b><span>Dann siehst du hier Kontostand, Ziel und deinen Puffer bis zum Max-Verlust.</span></div>
    </button>`;
  }

  const bars = [];
  if (st.target) {
    const p = Math.max(0, Math.min(1, st.progress));
    bars.push(`<div class="acc-bar">
      <div class="acc-bar-h"><span>Profitziel ${fmtEur(st.target, false)}</span><b>${fmtPct(Math.max(0, st.progress))}</b></div>
      <div class="bar"><i style="--w:${(p * 100).toFixed(1)}%"></i></div>
      <div class="acc-bar-s">${st.pnl >= st.target ? 'Geschafft' : `noch ${fmtEur(st.target - st.pnl, false)}`}</div>
    </div>`);
  }
  if (st.maxLoss) {
    const left = Math.max(0, Math.min(1, st.buffer / st.maxLoss));
    const lv = left < 0.25 ? 'crit' : left < 0.5 ? 'warn' : '';
    bars.push(`<div class="acc-bar ${lv}">
      <div class="acc-bar-h"><span>Puffer</span><b>${st.buffer > 0 ? fmtEur(st.buffer, false) : 'Aufgebraucht'}</b></div>
      <div class="bar buffer"><i style="--w:${(left * 100).toFixed(1)}%"></i></div>
      <div class="acc-bar-s">bis ${fmtEur(st.floor, false)}${st.buffer > 0 && acc.riskPct ? ` · ${Math.floor(st.buffer / ((acc.size * acc.riskPct) / 100))} R Luft` : ''}</div>
    </div>`);
  }

  return `<button class="acc-card" data-acc>
    <div class="acc-top"><span class="acc-name">${esc(acc.name)}</span>${badge}<span class="acc-chev">${icon('chevron')}</span></div>
    <div class="acc-bal num" data-count="${st.bal}">${fmtMoney(st.bal)}</div>
    <div class="acc-delta num ${tone(st.pnl)}">${fmtEur(st.pnl)} <span>· ${fmtSignedPct(st.pct)}</span></div>
    <div class="acc-spark">${sparkline(st.curve)}</div>
    ${bars.length ? `<div class="acc-bars">${bars.join('')}</div>` : ''}
  </button>`;
}

function weekStrip(closed) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const today = isoDate();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = isoDate(d);
    const list = closed.filter((t) => t.date === iso);
    const s = list.length ? summarize(list) : null;
    const v = s ? (s.nR ? s.sumR : s.sumEur) : null;
    days.push(`<div class="wk-day ${iso === today ? 'today' : ''} ${iso > today ? 'future' : ''} ${s ? `has ${tone(v) || 'flat'}` : ''}">
      <span class="wk-l">${'MDMDFSS'[i]}</span>
      <span class="wk-d">${d.getDate()}</span>
      <span class="wk-v num">${s ? (s.nR ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')}` : Math.round(v)) : '·'}</span>
    </div>`);
  }
  return days.join('');
}

function ring(p) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" class="ring-bg"/>${p ? `<circle cx="18" cy="18" r="${r}" class="ring-fg" style="stroke-dasharray:${(c * p).toFixed(2)} ${c.toFixed(2)}"/>` : ''}</svg>`;
}

function discipline(closed) {
  if (!closed.length) return '';
  const recent = [...closed].sort(byClose).reverse();
  let streak = 0;
  for (const t of recent) {
    if (!rulesOk(t)) break;
    streak++;
  }
  const last = recent.slice(0, 12).reverse();
  const best = (() => {
    let b = 0;
    let c = 0;
    for (const t of [...closed].sort(byClose)) {
      c = rulesOk(t) ? c + 1 : 0;
      b = Math.max(b, c);
    }
    return b;
  })();
  const msg =
    streak === 0
      ? 'Letzter Trade außerhalb der Regeln. Nächster Trade, neue Serie.'
      : streak >= best && streak > 2
        ? 'Deine beste Serie bisher. Weiter so.'
        : `Rekord: ${best} in Folge.`;
  return `<section class="card streak">
    <div class="streak-top">
      <div class="streak-num num">${streak}</div>
      <div class="streak-txt"><b>${streak === 1 ? 'Trade' : 'Trades'} in Folge nach Regeln</b><span>${msg}</span></div>
    </div>
    <div class="streak-dots">${last.map((t) => `<a href="#/trade/${t.id}" class="sd ${rulesOk(t) ? 'ok' : 'bad'}" aria-label="${esc(t.symbol)}"></a>`).join('')}${Array.from({ length: Math.max(0, 12 - last.length) }, () => '<span class="sd none"></span>').join('')}</div>
  </section>`;
}

function insightCard(list) {
  if (!list.length) return '';
  const i = ui.insight % list.length;
  const x = list[i];
  return `<section class="card insight ${x.tone}">
    <div class="ins-k">${icon('spark')} ${x.kicker}<span class="ins-n">${i + 1}/${list.length}</span></div>
    <h3>${x.title}</h3>
    <p>${x.text}</p>
    <div class="ins-actions">
      ${list.length > 1 ? `<button class="btn ghost sm" data-next-insight>Nächste ${icon('chevron')}</button>` : '<span></span>'}
      <a class="link-sm" href="#/stats">Zur Statistik</a>
    </div>
  </section>`;
}

function firstSteps(acc, trades) {
  const steps = [
    ['Konto einrichten', acc.size > 0, 'data-acc-edit'],
    ['Ersten Trade vorher abhaken', trades.length > 0, 'data-go="new"'],
    ['Trade abschließen', trades.some((t) => t.status === 'closed'), ''],
  ];
  if (steps.every((s) => s[1])) return '';
  return `<section class="card steps">
    <div class="steps-h"><b>Los geht's</b><span class="muted small">${steps.filter((s) => s[1]).length} von 3</span></div>
    ${steps.map(([l, done, attr]) => `<button class="step ${done ? 'done' : ''}" ${done ? 'disabled' : attr}><span class="box">${icon('check')}</span><span>${l}</span>${done ? '' : icon('chevron')}</button>`).join('')}
  </section>`;
}

export function homeView(root) {
  const acc = activeAccount();
  const trades = accTrades();
  const st = accountState(acc, trades);
  const closed = st.closed;
  const now = new Date();
  const name = (state.settings.name || '').trim();

  const weekFrom = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoDate(d);
  })();
  const monthFrom = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const wk = summarize(closed.filter((t) => t.date >= weekFrom));
  const mo = summarize(closed.filter((t) => t.date >= monthFrom));
  const last20 = summarize([...closed].sort(byClose).slice(-20));
  const val = (s) => (s.n ? (s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur)) : '–');

  const open = st.open.sort((a, b) => b.date.localeCompare(a.date));
  const recent = [...closed].sort(byClose).reverse().slice(0, 4);
  const ins = insights(closed);

  root.innerHTML = `<header class="home-head">
      <div>
        <div class="eyebrow">${greeting(now.getHours())}${name ? `, ${esc(name)}` : ''}</div>
        <h1>${WD_LONG[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}</h1>
      </div>
      <a class="tb-btn" href="#/settings" aria-label="Einstellungen">${icon('settings')}</a>
    </header>
    <main class="page home">
      ${accountCard(acc, st)}

      <section class="kpis">
        <div class="kpi"><span class="kpi-l">Diese Woche</span><span class="kpi-v num ${tone(wk.sumEur)}">${val(wk)}</span><span class="kpi-s">${wk.n} ${wk.n === 1 ? 'Trade' : 'Trades'}</span></div>
        <div class="kpi"><span class="kpi-l">${MONTHS[now.getMonth()]}</span><span class="kpi-v num ${tone(mo.sumEur)}">${val(mo)}</span><span class="kpi-s">${mo.n ? `${fmtPct(mo.wr)} Treffer` : '0 Trades'}</span></div>
        <div class="kpi ring-kpi">${ring(last20.rulesPct)}<span class="ring-v num">${last20.n ? `${Math.round(last20.rulesPct * 100)}<small>%</small>` : '–'}</span><span class="kpi-s">Disziplin</span></div>
      </section>

      <section class="card week">${weekStrip(closed)}</section>

      ${firstSteps(acc, trades)}

      ${open.length ? `<div class="sec-title"><h2>Offen</h2><span class="count">${open.length}</span></div><div class="open-list">${open.map(openCard).join('')}</div>` : ''}

      ${discipline(closed)}

      ${insightCard(ins)}

      ${recent.length ? `<div class="sec-title"><h2>Zuletzt</h2><a class="link-sm" href="#/trades">Alle</a></div><div class="rows">${recent.map(closedRow).join('')}</div>` : ''}

      ${!open.length && trades.length ? `<a class="cta" href="#/new"><span>${icon('plus')}</span><div><b>Neuer Trade</b><small>Bias und Entry vorher abhaken</small></div>${icon('chevron')}</a>` : ''}
    </main>`;

  root.querySelector('[data-acc]')?.addEventListener('click', () => openAccounts(() => homeView(root)));
  root.querySelectorAll('[data-acc-edit]').forEach((b) => b.addEventListener('click', () => editAccount(acc.id, () => homeView(root))));
  root.querySelector('[data-go="new"]')?.addEventListener('click', () => (location.hash = '#/new'));
  const bindInsight = () => {
    root.querySelector('[data-next-insight]')?.addEventListener('click', () => {
      ui.insight++;
      const el = root.querySelector('.insight');
      el.outerHTML = insightCard(ins);
      root.querySelector('.insight').classList.add('swap');
      bindInsight();
    });
  };
  bindInsight();
  bindOpenCards(root, () => homeView(root));

  // Kontostand beim ersten Öffnen hochzählen
  const bal = root.querySelector('[data-count]');
  if (bal && !ui.counted) {
    ui.counted = true;
    const to = Number(bal.dataset.count);
    const from = acc.size || 0;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      bal.textContent = fmtMoney(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
