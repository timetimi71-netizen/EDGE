// Edge · Rechnen: Symbole, Risiko und R, Sessions, Challenge-Regeln, Kennzahlen, Auswertungen und Erkenntnisse
import { S, accountTrades, activeAccount } from './store.js';
import { iso, fmtNum, WD, WD_LONG } from './util.js';

const H = 3600e3;

/* ---------- Geld ---------- */
const CUR_SIGN = { USD: '$', EUR: '€', CHF: 'CHF', GBP: '£' };
export const curSign = (c) => CUR_SIGN[c] || c || '$';
export function fmtMoney(v, cur = activeAccount()?.currency || 'USD', { sign = false, dec = null } = {}) {
  const a = Math.abs(v);
  const d = dec ?? (a >= 100 || a < 0.005 ? 0 : 2);
  const s = `${fmtNum(a, d)}\u00a0${curSign(cur)}`;
  if (v < 0) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
}
export const fmtPct = (v, d = 1, sign = false) => `${v < 0 ? '−' : sign && v > 0 ? '+' : ''}${fmtNum(Math.abs(v), d)}\u00a0%`;
export const fmtR = (r) => (r == null ? '–' : Math.abs(r) < 0.05 ? '±0\u00a0R' : `${r < 0 ? '−' : '+'}${fmtNum(Math.abs(r), Math.abs(r) >= 10 ? 0 : 1)}\u00a0R`);
export const tone = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : 'flat');

/* ---------- Symbole ----------
   Broker hängen gern etwas an (EURUSD.r, US100.cash, XAUUSD+). Für die Rechnung zählt der Kern. */
const FX = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'HUF', 'CZK', 'TRY', 'ZAR', 'MXN', 'SGD', 'HKD', 'CNH'];
const INDEX_QUOTE = { GER40: 'EUR', DE40: 'EUR', DAX: 'EUR', GER30: 'EUR', DE30: 'EUR', EU50: 'EUR', FRA40: 'EUR', UK100: 'GBP', JP225: 'JPY', JPN225: 'JPY', AUS200: 'AUD' };
// Broker-Endungen weg: US100.cash, EURUSD.r, EURUSD_i, EURUSDm, XAUUSD+, EUR/USD
export function cleanSymbol(sym) {
  let s = String(sym || '')
    .trim()
    .replace(/^[#!]+/, '')
    .replace(/\//g, '');
  s = s.replace(/^([A-Za-z0-9]{3,})[._\-+#!].*$/, '$1').replace(/^([A-Z0-9]{3,})[a-z]{1,3}$/, '$1');
  s = s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(CASH|PRO|ECN)$/, '');
  // Sechs Buchstaben Währungspaar oder Metall plus angehängte Kennung (EURUSDM, XAUUSDPRO)
  if (/^[A-Z]{7,9}$/.test(s) && ((FX.includes(s.slice(0, 3)) && FX.includes(s.slice(3, 6))) || /^X(AU|AG|PT|PD)/.test(s))) s = s.slice(0, 6);
  return s;
}
export function symInfo(sym) {
  const s = cleanSymbol(sym);
  const st = S.settings;
  if (/^X(AU|AG|PT|PD)[A-Z]{3}/.test(s)) {
    const core = s.slice(0, 6);
    return { sym: core, kind: 'metal', base: core.slice(0, 3), quote: core.slice(3, 6), contract: st.contracts[core] ?? (core.startsWith('XAU') ? 100 : 5000), pip: core.startsWith('XAU') ? 0.1 : 0.01, unit: 'Pips' };
  }
  const a = s.slice(0, 3);
  const b = s.slice(3, 6);
  if (s.length >= 6 && FX.includes(a) && FX.includes(b)) {
    const core = a + b;
    return { sym: core, kind: 'fx', base: a, quote: b, contract: st.contracts[core] ?? 100000, pip: b === 'JPY' ? 0.01 : 0.0001, unit: 'Pips' };
  }
  const crypto = /^(BTC|ETH|SOL|XRP|LTC)/.test(s);
  return {
    sym: s,
    kind: crypto ? 'crypto' : 'index',
    base: s,
    quote: INDEX_QUOTE[s] || 'USD',
    contract: st.contracts[s] ?? 1,
    pip: 1,
    unit: 'Punkte',
  };
}
// Wert von 1 Einheit Währung in USD (ungefähre Kurse aus den Einstellungen)
const usd = (c) => (c === 'USD' ? 1 : S.settings.rates[c] ?? null);
// Betrag in Notierungswährung -> Kontowährung. Ist die Basis die Kontowährung (USDJPY auf USD-Konto), zählt der echte Kurs.
export function toAccount(amount, info, price, accCur = 'USD') {
  if (info.quote === accCur) return amount;
  if (info.kind === 'fx' && info.base === accCur && price > 0) return amount / price;
  const q = usd(info.quote);
  const t = usd(accCur);
  if (q == null || t == null) return null;
  return (amount * q) / t;
}
export const pipsOf = (info, diff) => Math.abs(diff) / info.pip;

/* ---------- Risiko, R, Session, Dauer ---------- */
export function riskOf(t, acc = S.accounts.get(t.accountId)) {
  if (t.risk > 0) return t.risk;
  if (!(t.entry > 0) || !(t.sl > 0) || !(t.lots > 0)) return null;
  const info = symInfo(t.symbol);
  const v = toAccount(Math.abs(t.entry - t.sl) * t.lots * info.contract, info, t.entry, acc?.currency || 'USD');
  return v > 0 ? v : null;
}
export function rOf(t) {
  const r = riskOf(t);
  return r ? t.pnl / r : null;
}
// Planned reward:risk aus Einstieg, SL und TP
export function rrOf(t) {
  if (!(t.entry > 0) || !(t.sl > 0) || !(t.tp > 0)) return null;
  const risk = Math.abs(t.entry - t.sl);
  return risk ? Math.abs(t.tp - t.entry) / risk : null;
}
export const SESSIONS = [
  ['asien', 'Asien'],
  ['london', 'London'],
  ['overlap', 'London + NY'],
  ['newyork', 'New York'],
];
export const sessionName = (id) => (SESSIONS.find((s) => s[0] === id) || [id, '–'])[1];
// nach UTC-Stunde der Eröffnung (ungefähr, ohne Sommerzeit-Feinheiten)
export function sessionOf(ms) {
  const h = new Date(ms).getUTCHours();
  if (h >= 7 && h < 12) return 'london';
  if (h >= 12 && h < 16) return 'overlap';
  if (h >= 16 && h < 21) return 'newyork';
  return 'asien';
}
export const holdMin = (t) => (t.openAt && t.closeAt ? Math.max(0, (t.closeAt - t.openAt) / 60e3) : null);
export function fmtHold(min) {
  if (min == null) return '–';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${fmtNum(min / 60, min < 600 ? 1 : 0)} h`;
  return `${fmtNum(min / 1440, 1)} Tage`;
}
// Handelstag: hängt am Tageswechsel der Firma (z. B. Mitternacht oder 23 Uhr)
export function tradingDay(ms, resetHour = 0) {
  const r = Number(resetHour) || 0;
  if (!r) return iso(new Date(ms));
  return r > 12 ? iso(new Date(ms + (24 - r) * H)) : iso(new Date(ms - r * H));
}

/* ---------- Konto / Challenge ---------- */
export const PHASES = [
  ['p1', 'Phase 1'],
  ['p2', 'Phase 2'],
  ['funded', 'Funded'],
  ['eigen', 'Eigenes Konto'],
];
export const phaseName = (id) => (PHASES.find((p) => p[0] === id) || [id, id])[1];
// Typische Vorlagen, Werte immer anpassbar
export const PRESETS = {
  p1: { target: 10, dailyLoss: 5, maxLoss: 10, minDays: 4 },
  p2: { target: 5, dailyLoss: 5, maxLoss: 10, minDays: 4 },
  funded: { target: 0, dailyLoss: 5, maxLoss: 10, minDays: 0 },
  eigen: { target: 0, dailyLoss: 0, maxLoss: 0, minDays: 0 },
};

export function accountState(acc, now = Date.now()) {
  const trades = accountTrades(acc.id).filter((t) => t.closeAt <= now);
  const size = acc.size;
  const dailyLimit = (size * (acc.dailyLoss || 0)) / 100;
  const maxAmt = (size * (acc.maxLoss || 0)) / 100;
  const target = (size * (acc.target || 0)) / 100;
  let bal = size;
  let peak = size;
  let floor = size - maxAmt;
  let breach = null;
  const dayPnl = new Map();
  const curve = [{ t: acc.startAt || trades[0]?.openAt || now, bal: size }];
  for (const t of trades) {
    bal += t.pnl;
    dayPnl.set(t.day, (dayPnl.get(t.day) || 0) + t.pnl);
    curve.push({ t: t.closeAt, bal, id: t.id });
    if (maxAmt && bal < floor - 1e-9 && !breach) breach = { kind: 'max', day: t.day, at: t.closeAt };
    if (dailyLimit && dayPnl.get(t.day) <= -dailyLimit + 1e-9 && !breach) breach = { kind: 'daily', day: t.day, at: t.closeAt };
    if (bal > peak) peak = bal;
    if (acc.maxLossType === 'trailing' && maxAmt) floor = Math.min(size, Math.max(floor, peak - maxAmt));
  }
  const today = tradingDay(now, acc.resetHour);
  const todayPnl = dayPnl.get(today) || 0;
  const profit = bal - size;
  const days = [...dayPnl.keys()].length;
  const passed = !breach && target > 0 && profit >= target && days >= (acc.minDays || 0);
  return {
    acc,
    trades,
    size,
    bal,
    profit,
    profitPct: (profit / size) * 100,
    target,
    progress: target > 0 ? profit / target : null,
    dailyLimit,
    todayPnl,
    dailyLeft: dailyLimit ? dailyLimit + todayPnl : null,
    maxAmt,
    floor,
    maxLeft: maxAmt ? bal - floor : null,
    peak,
    tradingDays: days,
    minDays: acc.minDays || 0,
    breach,
    passed,
    today,
    dayPnl,
    curve,
  };
}
// Ampel: Wie nah bist du an einer Regel?
export function guard(st) {
  const lv = (left, limit) => (left == null ? null : left <= 0 ? 'bad' : left / limit < 0.35 ? 'warn' : 'ok');
  return { daily: lv(st.dailyLeft, st.dailyLimit), max: lv(st.maxLeft, st.maxAmt) };
}
// Eigene Grenzen für heute (max. Trades, Stopp nach Verlusten in Folge)
export function personal(st) {
  const lim = S.settings.limits || {};
  const today = st.trades.filter((t) => t.day === st.today);
  let streak = 0;
  for (let i = today.length - 1; i >= 0 && today[i].pnl < 0; i--) streak++;
  return {
    count: today.length,
    maxTrades: lim.maxTrades || null,
    lossStreak: streak,
    stopAfter: lim.stopAfterLosses || null,
    overTrades: !!lim.maxTrades && today.length >= lim.maxTrades,
    overLosses: !!lim.stopAfterLosses && streak >= lim.stopAfterLosses,
  };
}

/* ---------- Lot-Rechner ---------- */
export function lotCalc({ balance, riskPct, symbol, entry, sl, accCur = 'USD' }) {
  const info = symInfo(symbol);
  const riskAmount = (balance * riskPct) / 100;
  const dist = Math.abs(entry - sl);
  if (!(dist > 0) || !(riskAmount > 0)) return { info, riskAmount, lots: null };
  const perLot = toAccount(dist * info.contract, info, entry, accCur);
  if (!(perLot > 0)) return { info, riskAmount, lots: null, noRate: true };
  const raw = riskAmount / perLot;
  // abrunden, aber Rundungsrauschen (4,9999999) nicht als 4,99 zählen
  const lots = Math.floor(raw * 100 + 1e-6) / 100;
  return { info, riskAmount, perLot, raw, lots, realRisk: lots * perLot, pips: pipsOf(info, dist), valuePerPip: toAccount(info.pip * info.contract, info, entry, accCur) };
}

/* ---------- Kennzahlen ---------- */
export function kpis(trades) {
  const n = trades.length;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const gw = wins.reduce((s, t) => s + t.pnl, 0);
  const gl = losses.reduce((s, t) => s + t.pnl, 0);
  const net = gw + gl;
  const rs = trades.map(rOf).filter((r) => r != null);
  let eq = 0;
  let peak = 0;
  let dd = 0;
  let ws = 0;
  let ls = 0;
  let bestWs = 0;
  let worstLs = 0;
  for (const t of [...trades].sort((a, b) => a.closeAt - b.closeAt)) {
    eq += t.pnl;
    peak = Math.max(peak, eq);
    dd = Math.min(dd, eq - peak);
    if (t.pnl > 0) {
      ws++;
      ls = 0;
    } else if (t.pnl < 0) {
      ls++;
      ws = 0;
    }
    bestWs = Math.max(bestWs, ws);
    worstLs = Math.max(worstLs, ls);
  }
  const holdW = avg(wins.map(holdMin));
  const holdL = avg(losses.map(holdMin));
  const avgWin = wins.length ? gw / wins.length : 0;
  const avgLoss = losses.length ? gl / losses.length : 0;
  const payoff = avgLoss ? avgWin / Math.abs(avgLoss) : null;
  return {
    n,
    wins: wins.length,
    losses: losses.length,
    net,
    gw,
    gl,
    winRate: n ? wins.length / n : null,
    pf: gl ? gw / Math.abs(gl) : gw > 0 ? Infinity : null,
    avgWin,
    avgLoss,
    payoff,
    // Ab dieser Trefferquote verdienst du bei deinem Gewinn-Verlust-Verhältnis Geld
    breakEvenWR: payoff ? 1 / (1 + payoff) : null,
    expectancy: n ? net / n : null,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    totalR: rs.reduce((a, b) => a + b, 0),
    rCount: rs.length,
    best: trades.reduce((b, t) => (!b || t.pnl > b.pnl ? t : b), null),
    worst: trades.reduce((b, t) => (!b || t.pnl < b.pnl ? t : b), null),
    maxDD: dd,
    winStreak: bestWs,
    lossStreak: worstLs,
    holdW,
    holdL,
  };
}
function avg(list) {
  const v = list.filter((x) => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/* ---------- Aufteilungen ---------- */
const riskPctOf = (t) => {
  const r = riskOf(t);
  const acc = S.accounts.get(t.accountId);
  return r && acc ? (r / acc.size) * 100 : null;
};
const HOLD = [
  [15, 'unter 15 min'],
  [60, '15–60 min'],
  [240, '1–4 h'],
  [1440, '4–24 h'],
  [Infinity, 'über 1 Tag'],
];
export const DIMS = [
  { id: 'symbol', name: 'Symbol', icon: 'candles', key: (t) => symInfo(t.symbol).sym },
  { id: 'setup', name: 'Setup', icon: 'layers', key: (t) => t.setup || null },
  { id: 'session', name: 'Session', icon: 'globe', key: (t) => (t.openAt ? sessionName(sessionOf(t.openAt)) : null) },
  { id: 'weekday', name: 'Wochentag', icon: 'calendar', key: (t) => WD_LONG[new Date(t.openAt || t.closeAt).getDay()], order: (k) => (WD_LONG.indexOf(k) + 6) % 7 },
  {
    id: 'hour',
    name: 'Uhrzeit',
    icon: 'clock',
    key: (t) => {
      if (!t.openAt) return null;
      const h = Math.floor(new Date(t.openAt).getHours() / 2) * 2;
      return `${String(h).padStart(2, '0')}–${String(h + 2).padStart(2, '0')} Uhr`;
    },
    order: (k) => parseInt(k, 10),
  },
  { id: 'side', name: 'Richtung', icon: 'swap', key: (t) => (t.side === 'short' ? 'Short' : 'Long') },
  {
    id: 'hold',
    name: 'Haltedauer',
    icon: 'history',
    key: (t) => {
      const m = holdMin(t);
      return m == null ? null : HOLD.find(([lim]) => m < lim)[1];
    },
    order: (k) => HOLD.findIndex((h) => h[1] === k),
  },
  { id: 'feel', name: 'Gefühl vorher', icon: 'brain', key: (t) => (t.feelBefore ? ['Gestresst', 'Unruhig', 'Neutral', 'Ruhig', 'Im Flow'][t.feelBefore - 1] : null), order: (k) => ['Gestresst', 'Unruhig', 'Neutral', 'Ruhig', 'Im Flow'].indexOf(k) },
  { id: 'rules', name: 'Regeln', icon: 'shield', key: (t) => (t.rulesOk == null ? null : t.rulesOk ? 'Eingehalten' : 'Gebrochen') },
  { id: 'mistakes', name: 'Fehler', icon: 'alert', multi: (t) => (t.mistakes?.length ? t.mistakes : t.rulesOk != null || t.feelAfter ? ['Keine Fehler'] : []) },
  {
    id: 'risk',
    name: 'Risiko',
    icon: 'target',
    key: (t) => {
      const p = riskPctOf(t);
      return p == null ? null : p <= 0.5 ? 'bis 0,5 %' : p <= 1.05 ? '0,5–1 %' : p <= 2 ? '1–2 %' : 'über 2 %';
    },
    order: (k) => ['bis 0,5 %', '0,5–1 %', '1–2 %', 'über 2 %'].indexOf(k),
  },
  { id: 'tf', name: 'Zeiteinheit', icon: 'clock', key: (t) => t.tf || null, order: (k) => ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].indexOf(k) },
  { id: 'check', name: 'Ampel', icon: 'shield', key: (t) => (t.check ? CHECK[t.check] : null), order: (k) => ['Grün', 'Gelb', 'Unvollständig', 'Rot'].indexOf(k) },
];
export function groupBy(trades, dim) {
  const m = new Map();
  for (const t of trades) {
    const keys = dim.multi ? dim.multi(t) : [dim.key(t)];
    for (const k of keys) {
      if (k == null) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
  }
  const out = [...m.entries()].map(([k, list]) => {
    const net = list.reduce((s, t) => s + t.pnl, 0);
    const w = list.filter((t) => t.pnl > 0).length;
    const rs = list.map(rOf).filter((r) => r != null);
    return { key: k, n: list.length, net, avg: net / list.length, wr: w / list.length, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null };
  });
  if (dim.order) out.sort((a, b) => dim.order(a.key) - dim.order(b.key));
  else out.sort((a, b) => b.net - a.net);
  return out;
}

/* ---------- Erkenntnisse: Wo geht das Geld verloren? ---------- */
export function insights(trades, cur) {
  const out = [];
  if (trades.length < 5) return out;
  const money = (v) => fmtMoney(v, cur, { sign: true });
  const total = trades.reduce((s, t) => s + t.pnl, 0);
  const k = kpis(trades);

  // 1. Größter Verlustbringer und bester Bereich je Aufteilung
  for (const dim of DIMS.filter((d) => !['mistakes', 'rules', 'check'].includes(d.id))) {
    const g = groupBy(trades, dim).filter((x) => x.n >= 3);
    if (g.length < 2) continue;
    const worst = g.reduce((a, b) => (b.net < a.net ? b : a));
    if (worst.net < 0) {
      out.push({
        tone: 'bad',
        impact: -worst.net,
        dim: dim.id,
        title: `${dim.name}: ${worst.key}`,
        text: `${worst.n} Trades, Trefferquote ${fmtNum(worst.wr * 100, 0)}&nbsp;%, zusammen <b>${money(worst.net)}</b>. Ohne diese Trades stündest du bei <b>${money(total - worst.net)}</b>.`,
      });
    }
    const top = g.reduce((a, b) => (b.net > a.net ? b : a));
    if (top.net > 0 && top.key !== worst.key) {
      out.push({ tone: 'good', impact: top.net * 0.8, dim: dim.id, title: `${dim.name}: ${top.key}`, text: `Hier läuft es: ${top.n} Trades, Trefferquote ${fmtNum(top.wr * 100, 0)}&nbsp;%, zusammen <b>${money(top.net)}</b>.` });
    }
  }

  // 2. Regeln eingehalten vs. gebrochen
  const ok = trades.filter((t) => t.rulesOk === true);
  const broken = trades.filter((t) => t.rulesOk === false);
  if (ok.length >= 3 && broken.length >= 3) {
    const a = ok.reduce((s, t) => s + t.pnl, 0) / ok.length;
    const b = broken.reduce((s, t) => s + t.pnl, 0) / broken.length;
    if (b < a) {
      out.push({
        tone: 'bad',
        impact: (a - b) * broken.length,
        dim: 'rules',
        title: 'Regeln brechen kostet',
        text: `Hältst du dich an deine Regeln, bringt ein Trade im Schnitt <b>${money(a)}</b>, brichst du sie, <b>${money(b)}</b>. Das waren ${broken.length} Trades.`,
      });
    }
  }

  // 2b. Trotz Ampel getradet
  const red = trades.filter((t) => t.check === 'red');
  const green = trades.filter((t) => t.check === 'green');
  if (red.length >= 3) {
    const nr = red.reduce((s, t) => s + t.pnl, 0);
    const wrR = red.filter((t) => t.pnl > 0).length / red.length;
    if (nr < 0) {
      out.push({
        tone: 'bad',
        impact: -nr,
        dim: 'check',
        title: 'Trotz roter Ampel getradet',
        text: `${red.length} Trades bei Rot, zusammen <b>${money(nr)}</b> und ${fmtNum(wrR * 100, 0)}&nbsp;% Treffer${green.length >= 3 ? `. Bei Grün triffst du ${fmtNum((green.filter((t) => t.pnl > 0).length / green.length) * 100, 0)}&nbsp;%` : ''}.`,
      });
    }
  }

  // 3. Fehler mit dem höchsten Preis
  const cost = new Map();
  for (const t of trades) for (const m of t.mistakes || []) cost.set(m, (cost.get(m) || { n: 0, net: 0 }));
  for (const t of trades) for (const m of t.mistakes || []) {
    const c = cost.get(m);
    c.n++;
    c.net += t.pnl;
  }
  const worstMistake = [...cost.entries()].filter(([, c]) => c.n >= 2 && c.net < 0).sort((a, b) => a[1].net - b[1].net)[0];
  if (worstMistake) {
    out.push({ tone: 'bad', impact: -worstMistake[1].net, dim: 'mistakes', title: `Teuerster Fehler: ${worstMistake[0]}`, text: `${worstMistake[1].n}-mal passiert, zusammen <b>${money(worstMistake[1].net)}</b>.` });
  }

  // 4. Revenge: Trades kurz nach einem Verlust
  const sorted = [...trades].filter((t) => t.openAt).sort((a, b) => a.openAt - b.openAt);
  const after = [];
  const rest = [];
  for (const t of sorted) {
    const prev = sorted.filter((p) => p.closeAt <= t.openAt && p.accountId === t.accountId).pop();
    if (prev && prev.pnl < 0 && t.openAt - prev.closeAt <= 30 * 60e3) after.push(t);
    else rest.push(t);
  }
  if (after.length >= 3 && rest.length >= 3) {
    const wa = after.filter((t) => t.pnl > 0).length / after.length;
    const wr = rest.filter((t) => t.pnl > 0).length / rest.length;
    const na = after.reduce((s, t) => s + t.pnl, 0);
    if (na < 0 && wa < wr) {
      out.push({
        tone: 'bad',
        impact: -na,
        dim: 'revenge',
        title: 'Direkt nach einem Verlust',
        text: `Trades innerhalb von 30 Minuten nach einem Verlust treffen nur zu ${fmtNum(wa * 100, 0)}&nbsp;% (sonst ${fmtNum(wr * 100, 0)}&nbsp;%) und kosten dich <b>${money(na)}</b>. Nach einem Verlust lieber Pause machen.`,
      });
    }
  }

  // 5. Zu viele Trades am Tag
  const lim = S.settings.limits?.maxTrades || 3;
  const perDay = new Map();
  for (const t of [...trades].sort((a, b) => a.closeAt - b.closeAt)) {
    if (!perDay.has(t.day)) perDay.set(t.day, []);
    perDay.get(t.day).push(t);
  }
  const extra = [...perDay.values()].flatMap((l) => l.slice(lim));
  if (extra.length >= 3) {
    const ne = extra.reduce((s, t) => s + t.pnl, 0);
    if (ne < 0) out.push({ tone: 'bad', impact: -ne, dim: 'overtrading', title: `Mehr als ${lim} Trades am Tag`, text: `Alle Trades nach deinem ${lim}. am selben Tag haben zusammen <b>${money(ne)}</b> gebracht (${extra.length} Trades). Deine besten Chancen hast du meist früh am Tag.` });
  }

  // 6. Verlierer zu lange halten
  if (k.holdW != null && k.holdL != null && k.wins >= 3 && k.losses >= 3 && k.holdL > k.holdW * 1.5) {
    out.push({
      tone: 'info',
      impact: Math.abs(k.avgLoss) * k.losses * 0.25,
      dim: 'hold',
      title: 'Verlierer hältst du länger',
      text: `Gewinner hältst du im Schnitt ${fmtHold(k.holdW)}, Verlierer ${fmtHold(k.holdL)}. Oft heißt das: Gewinne zu früh mitnehmen, Verluste laufen lassen.`,
    });
  }

  // 7. Gewinn-Verlust-Verhältnis vs. Trefferquote
  if (k.payoff != null && k.winRate != null && k.breakEvenWR != null && k.net < 0) {
    out.push({
      tone: 'info',
      impact: Math.abs(k.net) * 0.5,
      dim: 'payoff',
      title: 'Die Mathe dahinter',
      text: `Ein Gewinner bringt im Schnitt ${money(k.avgWin)}, ein Verlierer kostet ${money(k.avgLoss)} (Verhältnis ${fmtNum(k.payoff, 2)} : 1). Damit brauchst du mindestens <b>${fmtNum(k.breakEvenWR * 100, 0)}&nbsp;% Treffer</b>, du hast ${fmtNum(k.winRate * 100, 0)}&nbsp;%.`,
    });
  }

  // Nur das Wichtigste, Doppeltes pro Aufteilung vermeiden: bis zu fünf Schwachstellen und drei Stärken
  const seen = new Set();
  const top = out
    .sort((a, b) => b.impact - a.impact)
    .filter((x) => {
      const key = `${x.dim}:${x.tone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return [...top.filter((x) => x.tone !== 'good').slice(0, 5), ...top.filter((x) => x.tone === 'good').slice(0, 3)];
}
export const wdShort = (ms) => WD[new Date(ms).getDay()];

/* ---------- Vor dem Trade: die Ampel ----------
   Rot: eine Grenze oder Regel ist verletzt. Offen: es fehlt noch etwas. Gelb: erlaubt, aber mit Warnzeichen. Grün: alles passt. */
export const CHECK = { green: 'Grün', yellow: 'Gelb', red: 'Rot', open: 'Unvollständig' };
const pctIn = (text, fallback) => {
  const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(text || '');
  return m ? +m[1].replace(',', '.') : fallback;
};
const rrIn = (text) => {
  const m = /1\s*:\s*(\d+(?:[.,]\d+)?)/.exec(text || '');
  if (m) return +m[1].replace(',', '.');
  if (/drei(fach|mal)/i.test(text)) return 3;
  return 2;
};
// Standard-Regeln, die Edge aus den Zahlen selbst beantworten kann: true, false oder null (noch nicht entscheidbar)
export function autoRule(rule, x) {
  if (rule.id === 'sl') return x.sl ? true : null;
  if (rule.id === 'risk') return x.riskPct != null ? x.riskPct <= pctIn(rule.text, 1) + 0.005 : null;
  if (rule.id === 'rr') return x.rr != null ? x.rr >= rrIn(rule.text) - 0.005 : null;
  return null;
}

// Wie liefen frühere Trades, die zu diesem passen? (Symbol, Setup, Session, Uhrzeit, Wochentag, Richtung)
function historyHints(x, now, cur) {
  const pool = [...S.trades.values()].filter((t) => t.closeAt > now - 365 * 864e5 && t.closeAt <= now);
  if (pool.length < 10) return [];
  const wrAll = pool.filter((t) => t.pnl > 0).length / pool.length;
  const plan = { ...x, openAt: now, closeAt: now };
  const dims = [
    ['symbol', (k) => k],
    ['setup', (k) => `Das Setup ${k}`],
    ['session', (k) => (k === 'Asien' ? 'Die Asien-Session' : `Die Session ${k}`)],
    ['hour', (k) => `Die Zeit ${k}`],
    ['weekday', (k) => `Der ${k}`],
    ['side', (k) => `${k}-Trades`, true],
  ];
  const out = [];
  for (const [id, label, plural] of dims) {
    const dim = DIMS.find((d) => d.id === id);
    const key = dim.key(plan);
    if (key == null) continue;
    const list = pool.filter((t) => dim.key(t) === key);
    if (list.length < 5) continue;
    const net = list.reduce((a, t) => a + t.pnl, 0);
    const wr = list.filter((t) => t.pnl > 0).length / list.length;
    const money = fmtMoney(net, cur, { sign: true });
    if (net < 0 && wr < wrAll - 0.05) out.push({ lv: 'yellow', impact: -net, text: `${label(key)} ${plural ? 'liefen' : 'lief'} bei dir bisher schlecht: ${list.length} Trades, ${fmtNum(wr * 100, 0)}\u00a0% Treffer, zusammen ${money}.` });
    else if (net > 0 && wr > wrAll + 0.08) out.push({ lv: 'good', impact: net, text: `${label(key)} ${plural ? 'laufen' : 'läuft'} bei dir: ${list.length} Trades, ${fmtNum(wr * 100, 0)}\u00a0% Treffer, zusammen ${money}.` });
  }
  out.sort((a, b) => b.impact - a.impact);
  return [...out.filter((o) => o.lv === 'yellow').slice(0, 2), ...out.filter((o) => o.lv === 'good').slice(0, 1)];
}

/* x: { symbol, side, entry, sl, tp, riskPct, balance, setup, feel }, answers: Regel-id -> true/false (von Hand) */
export function tradeCheck({ acc, x, answers = {}, now = Date.now(), open = [], plan = null }) {
  const cur = acc.currency;
  const m = (v) => fmtMoney(v, cur);
  const st = accountState(acc, now);
  const p = personal(st);
  const lim = S.settings.limits || {};
  const info = symInfo(x.symbol || 'EURUSD');
  const reasons = [];
  const add = (lv, text, ic) => reasons.push({ lv, text, ic });
  const side = x.side === 'short' ? 'short' : 'long';
  // Stop-Loss und Ziel auf der richtigen Seite?
  const slWrong = x.entry && x.sl && (side === 'long' ? x.sl >= x.entry : x.sl <= x.entry);
  const tpWrong = x.entry && x.tp && (side === 'long' ? x.tp <= x.entry : x.tp >= x.entry);
  const res = x.entry && x.sl && !slWrong ? lotCalc({ balance: x.balance, riskPct: x.riskPct, symbol: x.symbol, entry: x.entry, sl: x.sl, accCur: cur }) : null;
  const lots = res?.lots || null;
  const risk = lots ? res.realRisk : null;
  const riskPct = risk && x.balance ? (risk / x.balance) * 100 : null;
  const rr = x.entry && x.sl && x.tp && !slWrong && !tpWrong ? Math.abs(x.tp - x.entry) / Math.abs(x.entry - x.sl) : null;
  const openHere = open.filter((o) => o.accountId === acc.id);
  const openToday = openHere.filter((o) => tradingDay(o.openAt, acc.resetHour) === st.today);
  const openRisk = openHere.reduce((a, o) => a + (o.risk || 0), 0);

  // Harte Grenzen
  if (st.breach) add('red', `Ein Limit deiner Challenge ist schon verletzt (${st.breach.kind === 'daily' ? 'Tagesverlust' : 'Gesamtverlust'}).`, 'alert');
  if (p.overLosses) add('red', `${p.lossStreak} Verluste in Folge. Deine Regel: für heute Schluss.`, 'pause');
  const count = p.count + openToday.length;
  if (p.maxTrades && count >= p.maxTrades) add('red', `Schon ${count} von ${p.maxTrades} Trades heute${openToday.length ? ', offene mitgezählt' : ''}. Deine Regel: für heute Schluss.`, 'pause');
  const last = st.trades[st.trades.length - 1];
  const cool = lim.cooldown ?? 30;
  if (cool && last && last.pnl < 0 && now - last.closeAt < cool * 60e3) {
    const ago = Math.max(0, Math.floor((now - last.closeAt) / 60e3));
    add('red', ago < 1 ? `Dein letzter Trade war gerade eben ein Verlust. Noch ${cool} min Pause.` : `Dein letzter Trade war ein Verlust, vor ${ago} min. Noch ${cool - ago} min Pause.`, 'clock');
  }
  if (slWrong) add('red', `Der Stop-Loss liegt auf der falschen Seite für ${side === 'long' ? 'Long' : 'Short'}.`, 'alert');
  if (tpWrong) add('yellow', `Das Ziel liegt auf der falschen Seite für ${side === 'long' ? 'Long' : 'Short'}.`, 'alert');
  if (res && !lots) add('red', 'Unter 0,01 Lot: Der Stop ist für dieses Risiko zu weit weg.', 'alert');
  if (risk && st.dailyLimit) {
    const budget = st.dailyLeft - openRisk;
    if (risk > budget + 0.005) add('red', budget > 0 ? `Bei Stop-Loss wäre dein Tageslimit gerissen. Heute sind noch ${m(budget)} drin${openRisk ? ' (offene Trades eingerechnet)' : ''}.` : 'Dein Spielraum für heute ist aufgebraucht.', 'shield');
    else if (risk > budget * 0.5) add('yellow', `Ein Verlust nähme ${fmtNum((risk / budget) * 100, 0)}\u00a0% von dem, was du heute noch verlieren darfst.`, 'shield');
  }
  if (risk && st.maxAmt) {
    const budget = st.maxLeft - openRisk;
    if (risk > budget + 0.005) add('red', `Bei Stop-Loss wäre dein Gesamtlimit gerissen. Bis zur Grenze sind es noch ${m(Math.max(0, budget))}.`, 'shield');
  }

  // Deine Regeln
  const rules = S.settings.rules.map((r) => {
    const auto = autoRule(r, { sl: x.sl && !slWrong ? x.sl : null, riskPct, rr });
    const val = auto ?? answers[r.id] ?? null;
    return { id: r.id, text: r.text, auto: auto != null, val };
  });
  const broken = rules.filter((r) => r.val === false);
  broken.forEach((r) => add('red', `Regel gebrochen: ${r.text}`, 'close'));
  const missing = rules.filter((r) => r.val == null);

  // Warnzeichen
  const std = S.settings.risk || 1;
  if (riskPct != null && riskPct > std + 0.05 && !broken.some((r) => r.id === 'risk')) add('yellow', `Mehr Risiko als dein Standard (${fmtNum(riskPct, 2)}\u00a0% statt ${fmtNum(std, std % 1 ? 2 : 0)}\u00a0%).`, 'target');
  if (rr != null && rr < 1 && !rules.some((r) => r.id === 'rr')) add('yellow', `Das Ziel ist näher als der Stop (Chance-Risiko 1\u00a0:\u00a0${fmtNum(rr, 1)}).`, 'target');
  if (x.feel && x.feel <= 2) {
    const all = [...S.trades.values()].filter((t) => t.feelBefore);
    const low = all.filter((t) => t.feelBefore <= 2);
    const rest = all.filter((t) => t.feelBefore > 2);
    const wr = (l) => l.filter((t) => t.pnl > 0).length / l.length;
    add('yellow', low.length >= 4 && rest.length >= 4 ? `Du bist gerade ${x.feel === 1 ? 'gestresst' : 'unruhig'}. In diesem Zustand triffst du ${fmtNum(wr(low) * 100, 0)}\u00a0%, sonst ${fmtNum(wr(rest) * 100, 0)}\u00a0%.` : `Du bist gerade ${x.feel === 1 ? 'gestresst' : 'unruhig'}. So entstehen die meisten Fehltrades.`, 'brain');
  }
  const bias = plan?.bias?.[info.sym];
  const hasPlan = plan && (plan.plan || plan.levels || Object.values(plan.bias || {}).some(Boolean));
  if (bias === 'bull' || bias === 'bear') {
    const want = bias === 'bull' ? 'long' : 'short';
    if (want !== side) add('yellow', `Gegen deinen Plan: ${info.sym} hast du heute ${want === 'long' ? 'Long' : 'Short'} eingeplant.`, 'journal');
    else add('good', `Passt zu deinem Marktplan (${info.sym} ${want === 'long' ? 'Long' : 'Short'}).`, 'journal');
  } else if (!hasPlan) add('yellow', 'Für heute steht noch kein Marktplan im Journal.', 'journal');
  if (plan?.news) add('info', `News laut deinem Plan: ${plan.news.slice(0, 90)}${plan.news.length > 90 ? '…' : ''}`, 'bell');
  if (p.maxTrades && count === p.maxTrades - 1 && !reasons.some((r) => r.lv === 'red')) add('info', 'Das wäre dein letzter Trade für heute.', 'info');
  if (openHere.length) add('info', `${openHere.length === 1 ? 'Ein Trade läuft' : `${openHere.length} Trades laufen`} noch, Risiko ${m(openRisk)}. Das ist oben eingerechnet.`, 'clock');
  historyHints({ symbol: info.sym, side, setup: x.setup || null, feelBefore: x.feel || null }, now, cur).forEach((h) => add(h.lv, h.text, h.lv === 'good' ? 'up' : 'down'));

  const needs = [];
  if (!x.entry) needs.push('Einstieg');
  if (!x.sl) needs.push('Stop-Loss');
  const level = reasons.some((r) => r.lv === 'red') ? 'red' : needs.length || missing.length ? 'open' : reasons.some((r) => r.lv === 'yellow') ? 'yellow' : 'green';
  return { level, reasons, rules, missing: missing.length, needs, lots, risk, riskPct, rr, res, info, count, openRisk, st };
}
