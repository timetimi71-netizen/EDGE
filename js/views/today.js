// Edge · Heute: Challenge-Fortschritt, Regel-Ampel, eigene Grenzen, schnelle Aktionen, Marktplan, Trades von heute
import { S, activeAccount, accountTrades } from '../store.js';
import { accountState, guard, personal, fmtMoney, fmtPct, tone, phaseName, insights, symInfo } from '../edge.js';
import { tradeRow } from './trades.js';
import { openCardHTML } from './check.js';
import { ago } from './mt5.js';
import { icon, logoSVG } from '../ui.js';
import { esc, today, fromISO, WD_LONG, MONTHS, fmtNum, IS_IOS, IS_STANDALONE, IS_PREVIEW } from '../util.js';
import { act } from '../app.js';
import { saveSettings } from '../store.js';

function greeting(h) {
  if (h < 5) return 'Spät noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

export function render() {
  const now = new Date();
  const d = fromISO(today());
  const name = (S.settings.name || '').trim();
  const acc = activeAccount();
  return `
  <header class="vhead">
    <div class="vhead-text">
      <div class="eyebrow">${greeting(now.getHours())}${name ? `, ${esc(name)}` : ''}</div>
      <h1 class="vtitle">${WD_LONG[d.getDay()]},<br><em>${d.getDate()}. ${MONTHS[d.getMonth()]}</em></h1>
    </div>
    <div class="head-actions"><button type="button" class="icon-btn" data-act="settings" aria-label="Einstellungen">${icon('sliders')}</button></div>
  </header>
  ${previewNote()}
  ${acc ? dashboard(acc) : setupHero()}
  ${tips()}`;
}

function previewNote() {
  if (!IS_PREVIEW) return '';
  return `<section class="card tip preview-note"><div class="tip-ic">${icon('info')}</div><div>
    <h3>Vorschau mit Beispieldaten</h3><p>So sieht Edge nach ein paar Wochen Challenge aus. Screenshot-Import und Installation gehen erst in der installierten App.</p></div><span></span></section>`;
}

function setupHero() {
  return `<section class="card hero">
    <div class="eyebrow">${icon('wallet')} Los geht's</div>
    <h2 class="hero-title">Leg deine <em>Challenge</em> an</h2>
    <p>Kontogröße, Profitziel und die Verlustgrenzen deiner Prop-Firm. Dann zeigt dir Edge jeden Tag, wie viel Spielraum du noch hast.</p>
    <button type="button" class="btn btn-primary btn-block" data-act="acc-new">Konto anlegen ${icon('arrowR')}</button>
  </section>`;
}

function dashboard(acc) {
  const st = accountState(acc);
  const g = guard(st);
  const p = personal(st);
  const ccy = acc.currency;
  const m = (v, o) => fmtMoney(v, ccy, o);
  const todays = st.trades.filter((t) => t.day === st.today).reverse();
  const plan = S.days.get(today());
  const pct = st.progress != null ? Math.max(0, Math.min(1, st.progress)) : null;
  const status = st.breach
    ? `<span class="badge-st bad">${icon('alert')} ${st.breach.kind === 'daily' ? 'Tageslimit verletzt' : 'Gesamtlimit verletzt'}</span>`
    : st.passed
      ? `<span class="badge-st good">${icon('trophy')} Ziel erreicht</span>`
      : `<span class="badge-st live"><i></i>${acc.phase === 'eigen' || acc.name.includes(phaseName(acc.phase)) ? 'Läuft' : esc(phaseName(acc.phase))}</span>`;
  const bar = (left, limit, lv) => {
    const used = limit ? Math.max(0, Math.min(1, 1 - left / limit)) : 0;
    return `<div class="gbar ${lv}"><i style="--w:${(used * 100).toFixed(1)}%"></i></div>`;
  };
  // Top-Erkenntnis der letzten 30 Tage
  const recent = accountTrades(acc.id).filter((t) => t.closeAt > Date.now() - 30 * 864e5);
  const ins = insights(recent, ccy).find((x) => x.tone === 'bad') || null;
  return `
  <button type="button" class="card acc-card" data-act="acc-switch">
    <div class="acc-top"><span class="acc-name">${esc(acc.name)}</span>${status}</div>
    <div class="acc-bal"><b>${m(st.bal, { dec: 2 })}</b><span class="${tone(st.profit)}">${m(st.profit, { sign: true })} · ${fmtPct(st.profitPct, 2, true)}</span></div>
    ${
      pct != null
        ? `<div class="acc-goal"><div class="acc-goal-h"><span>Profitziel ${m(st.target)}</span><span>${fmtNum(Math.max(0, st.progress) * 100, 0)} %</span></div>
        <div class="gbar goal"><i style="--w:${(pct * 100).toFixed(1)}%"></i></div></div>`
        : ''
    }
    ${mt5Line(acc)}
    ${st.minDays ? `<div class="acc-days">${icon('calendar')} ${st.tradingDays >= st.minDays ? `Mindest-Handelstage erfüllt · ${st.tradingDays} gehandelt` : `${st.tradingDays} von ${st.minDays} Mindest-Handelstagen`}</div>` : ''}
  </button>
  ${
    st.dailyLimit || st.maxAmt
      ? `<section class="card guard">
    <div class="card-h"><h2 class="card-t">${icon('shield')} Regeln</h2><span class="faint small">nur geschlossene Trades</span></div>
    ${
      st.dailyLimit
        ? `<div class="g-row ${g.daily}"><div class="g-h"><span>Tagesverlust</span><b>${st.dailyLeft > 0 ? `noch ${m(st.dailyLeft)}` : 'Limit erreicht'}</b></div>${bar(st.dailyLeft, st.dailyLimit, g.daily)}<div class="g-sub">Heute ${st.todayPnl ? m(st.todayPnl, { sign: true }) : '±0'} · erlaubt sind −${m(st.dailyLimit)}</div></div>`
        : ''
    }
    ${
      st.maxAmt
        ? `<div class="g-row ${g.max}"><div class="g-h"><span>Gesamtverlust</span><b>${st.maxLeft > 0 ? `noch ${m(st.maxLeft)}` : 'Limit erreicht'}</b></div>${bar(st.maxLeft, st.maxAmt, g.max)}<div class="g-sub">Grenze bei ${m(st.floor, { dec: 0 })}${acc.maxLossType === 'trailing' ? ' (zieht nach)' : ''}</div></div>`
        : ''
    }
  </section>`
      : ''
  }
  ${limitsCard(p, st)}
  <div class="qadd">
    <button type="button" class="qbtn main" data-act="t-check">${icon('shield')}<span>Check</span></button>
    <button type="button" class="qbtn" data-act="t-new">${icon('plus')}<span>Trade</span></button>
    <button type="button" class="qbtn" data-act="t-import">${icon('camera')}<span>MT5</span></button>
    <button type="button" class="qbtn" data-act="go" data-to="journal">${icon('journal')}<span>Plan</span></button>
  </div>
  ${openCardHTML(acc)}
  ${planCard(plan)}
  <section class="card">
    <div class="card-h"><h2 class="card-t">${icon('candles')} Heute</h2><span class="${tone(st.todayPnl)} small" style="font-weight:700">${todays.length ? m(st.todayPnl, { sign: true }) : ''}</span></div>
    ${todays.length ? `<div class="tlist">${todays.map((t) => tradeRow(t)).join('')}</div>` : '<p class="empty">Noch kein Trade heute. Geduld ist auch eine Position.</p>'}
    ${!todays.length && st.trades.length ? `<button type="button" class="link" data-act="go" data-to="trades">Alle Trades ${icon('chevR')}</button>` : ''}
  </section>
  ${
    ins
      ? `<button type="button" class="card insight-mini" data-act="go" data-to="stats"><div class="eyebrow">${icon('sparkle')} Wo geht Geld verloren?</div><b>${esc(ins.title)}</b><p>${ins.text}</p><span class="link">Zur Analyse ${icon('chevR')}</span></button>`
      : ''
  }`;
}

// Was MT5 selbst sagt: zeigt sofort, wenn Edge und das echte Konto auseinanderlaufen
function mt5Line(acc) {
  const cfg = S.settings.mt5;
  if (!cfg?.key || (cfg.accountId && cfg.accountId !== acc.id)) return '';
  const last = cfg.last;
  if (last?.state === 'ok' && last.equity != null) {
    return `<div class="acc-mt5">${icon('repeat')} MT5 · Equity ${fmtMoney(last.equity, acc.currency, { dec: 2 })} · ${ago(last.at)}</div>`;
  }
  if (last && !['ok', 'waiting', 'offline'].includes(last.state)) return `<div class="acc-mt5 bad">${icon('alert')} MT5-Abruf klappt gerade nicht</div>`;
  return '';
}

function limitsCard(p, st) {
  // Pause nach einem Verlust: wie lange noch?
  const cool = S.settings.limits?.cooldown ?? 30;
  const last = st.trades[st.trades.length - 1];
  const left = cool && last && last.pnl < 0 ? cool - Math.floor((Date.now() - last.closeAt) / 60e3) : 0;
  if (!p.maxTrades && !p.stopAfter && left <= 0) return '';
  const stop = p.overLosses || (p.overTrades && p.count >= p.maxTrades);
  return `<section class="card limits ${stop ? 'stop' : ''}">
    ${!stop && left > 0 ? `<div class="cool-msg">${icon('clock')}<span>Pause nach dem Verlust: noch <b>${left} min</b></span></div>` : ''}
    ${stop ? `<div class="stop-msg">${icon('pause')}<div><b>Für heute Schluss</b><span>${p.overLosses ? `${p.lossStreak} ${p.lossStreak === 1 ? 'Verlust' : 'Verluste in Folge'}. ` : ''}${p.overTrades ? `${p.count} von ${p.maxTrades} Trades gemacht. ` : ''}So steht es in deinen Regeln.</span></div></div>` : ''}
    <div class="lim-row">
      ${p.maxTrades ? `<div class="lim"><span>Trades heute</span><b>${p.count} / ${p.maxTrades}</b><div class="dots">${Array.from({ length: p.maxTrades }, (_, i) => `<i class="${i < p.count ? 'on' : ''}"></i>`).join('')}</div></div>` : ''}
      ${p.stopAfter ? `<div class="lim"><span>Verluste in Folge</span><b>${p.lossStreak} / ${p.stopAfter}</b><div class="dots loss">${Array.from({ length: p.stopAfter }, (_, i) => `<i class="${i < p.lossStreak ? 'on' : ''}"></i>`).join('')}</div></div>` : ''}
    </div>
  </section>`;
}

function planCard(plan) {
  const bias = Object.entries(plan?.bias || {}).filter(([, v]) => v);
  if (!plan || (!bias.length && !plan.levels && !plan.plan)) {
    return `<button type="button" class="card tip plan-cta" data-act="go" data-to="journal"><div class="tip-ic">${icon('journal')}</div><div><h3>Marktplan für heute</h3><p>Richtung, wichtige Level und News, bevor du die erste Order setzt.</p></div><span class="x">${icon('chevR')}</span></button>`;
  }
  return `<button type="button" class="card plan-mini" data-act="go" data-to="journal">
    <div class="card-h"><h2 class="card-t">${icon('journal')} Dein Plan</h2>${icon('chevR')}</div>
    ${bias.length ? `<div class="bias-chips">${bias.map(([s, v]) => `<span class="bias ${v}">${icon(v === 'bull' ? 'up' : v === 'bear' ? 'down' : 'minus')}${esc(symInfo(s).sym)}</span>`).join('')}</div>` : ''}
    ${plan.plan ? `<p class="plan-text">${esc(plan.plan.slice(0, 160))}${plan.plan.length > 160 ? '…' : ''}</p>` : plan.levels ? `<p class="plan-text">${esc(plan.levels.slice(0, 160))}</p>` : ''}
  </button>`;
}

function tips() {
  if (IS_PREVIEW) return '';
  if (IS_IOS && !IS_STANDALONE && !S.settings.installHintDismissed) {
    return `<section class="card tip"><div class="tip-ic">${icon('share')}</div><div><h3>Als App installieren</h3><p>Tippe in Safari auf ${icon('share', 'inline-ic')} <b>Teilen</b> und dann auf <b>„Zum Home-Bildschirm“</b>. Danach startet Edge wie eine echte App.</p></div><button type="button" class="x" data-act="tip-install" aria-label="Ausblenden">${icon('close')}</button></section>`;
  }
  return '';
}
act('tip-install', (el) => {
  saveSettings({ installHintDismissed: true });
  el.closest('.tip')?.remove();
});
export const logo = () => logoSVG('');
