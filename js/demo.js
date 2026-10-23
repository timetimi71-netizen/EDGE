// Edge · Beispieldaten: eine laufende 100k-Challenge mit typischen Mustern (alle mit demo: true markiert)
import { S, putMany, saveSettings, reindex, saveOpen } from './store.js';
import { today, fromISO, addDays } from './util.js';
import { symInfo, tradingDay, insights } from './edge.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Symbol, Kurs, typischer SL-Abstand, Grundchance auf Gewinn
const SYMS = [
  ['EURUSD', 1.0842, 0.0016, 0.44],
  ['XAUUSD', 2648, 6, 0.52],
  ['NAS100', 20480, 45, 0.34],
  ['USDJPY', 151.6, 0.22, 0.42],
  ['GBPJPY', 196.4, 0.35, 0.32],
];
const SETUPS = [
  ['Pullback', 0.1],
  ['Liquidity Sweep', 0.08],
  ['Breakout', -0.04],
  ['Reversal', -0.12],
  ['Trendfolge', 0.03],
];
// Eröffnungsstunde in UTC mit Einfluss auf die Chance (Asien schwach, London und Überschneidung gut)
const HOURS = [
  [3, -0.16],
  [5, -0.12],
  [8, 0.06],
  [9, 0.05],
  [10, 0.02],
  [13, 0.07],
  [14, 0.05],
  [15, 0],
  [17, -0.05],
];

// Kurzcheck eines Kontos: Ergebnis, Profit-Faktor und ob ein Limit gerissen wurde
function story(acc, trades) {
  let bal = acc.size;
  let gw = 0;
  let gl = 0;
  let breach = 0;
  const day = new Map();
  for (const t of trades.filter((x) => x.accountId === acc.id).sort((a, b) => a.closeAt - b.closeAt)) {
    bal += t.pnl;
    day.set(t.day, (day.get(t.day) || 0) + t.pnl);
    if (t.pnl > 0) gw += t.pnl;
    else gl -= t.pnl;
    if (!breach && (bal < acc.size * (1 - acc.maxLoss / 100) || day.get(t.day) <= (-acc.size * acc.dailyLoss) / 100)) breach = t.closeAt;
  }
  return { profitPct: ((bal - acc.size) / acc.size) * 100, pf: gl ? gw / gl : 9, breach };
}

// Die Zufallsdaten hängen vom heutigen Datum ab. Darum mehrere Varianten würfeln und die nehmen, deren Geschichte
// am besten passt: laufende Challenge leicht im Plus, nichts gerissen, klare Schwachstellen; altes Konto am Risiko gescheitert.
export async function loadDemo() {
  let data = null;
  let best = Infinity;
  for (let seed = 20261023; seed < 20261023 + 150 && best > 0; seed++) {
    const d = build(seed);
    const a = story(d.acc, d.trades);
    const o = story(d.old, d.trades);
    const oldN = d.trades.filter((t) => t.accountId === d.old.id && t.closeAt <= o.breach).length;
    const weak = insights(d.trades.filter((t) => t.accountId === d.acc.id), 'USD').filter((x) => x.tone === 'bad').length;
    const score =
      (a.breach ? 100 : 0) +
      (o.breach ? 0 : 50) +
      Math.max(0, 2.5 - a.profitPct, a.profitPct - 7.5) * 5 +
      (a.pf > 1.7 ? 10 : 0) +
      Math.max(0, 3 - weak) * 8 +
      Math.max(0, 10 - oldN);
    if (score < best) {
      best = score;
      data = d;
    }
  }
  const { acc, old, days, open } = data;
  // Nach dem gerissenen Limit wäre das alte Konto zu gewesen
  const end = story(old, data.trades).breach || Infinity;
  const trades = data.trades.filter((t) => t.accountId !== old.id || t.closeAt <= end);
  S.accounts.set(acc.id, acc);
  S.accounts.set(old.id, old);
  trades.forEach((t) => S.trades.set(t.id, t));
  days.forEach((d) => {
    if (!S.days.has(d.date)) S.days.set(d.date, d);
  });
  reindex();
  await putMany('accounts', [acc, old]);
  await putMany('trades', trades);
  await putMany('days', days.filter((d) => S.days.get(d.date) === d));
  for (const o of open) if (!S.open.some((x) => x.id === o.id)) await saveOpen(o);
  await saveSettings({ demoLoaded: true, activeAccount: S.settings.activeAccount && S.accounts.has(S.settings.activeAccount) && !S.accounts.get(S.settings.activeAccount).demo ? S.settings.activeAccount : acc.id });
}

function build(seed) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const now = Date.now();
  const t0 = today();
  const acc = {
    id: 'demo-acc',
    name: 'FTMO 100k Phase 1',
    firm: 'FTMO',
    size: 100000,
    currency: 'USD',
    phase: 'p1',
    target: 10,
    dailyLoss: 5,
    maxLoss: 10,
    maxLossType: 'static',
    minDays: 4,
    resetHour: 0,
    status: 'aktiv',
    startAt: fromISO(addDays(t0, -44)).getTime(),
    createdAt: now - 44 * 864e5,
    demo: true,
  };
  const old = { ...acc, id: 'demo-acc-old', name: 'FTMO 50k Phase 1', size: 50000, status: 'verloren', startAt: now - 110 * 864e5, createdAt: now - 110 * 864e5 };
  const trades = [];
  const make = (a, day, base, [hour, hb]) => {
    const [sym, price, slDist, p0] = pick(SYMS);
    const [setup, sb] = pick(SETUPS);
    const info = symInfo(sym);
    const d = fromISO(day);
    // nacheinander: frühestens fünf Minuten nach dem letzten Trade
    const open = Math.max(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hour, Math.floor(r() * 50), 0), (base.lastClose || 0) + (5 + Math.floor(r() * 40)) * 60e3);
    const feel = r() < 0.18 ? 1 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
    const bigRisk = r() < 0.1;
    // Im alten Konto war das Risiko zu hoch, darum ist es geplatzt
    const riskAmt = (a.size * (a.status === 'verloren' ? 1.5 + r() * 1.5 : bigRisk ? 2 : 0.5 + r() * 0.5)) / 100;
    const side = r() < 0.55 ? 'long' : 'short';
    const sl = slDist * (0.8 + r() * 0.5);
    const perLot = sl * info.contract * (info.quote === 'JPY' ? 1 / price : 1);
    const lots = Math.max(0.01, Math.floor((riskAmt / perLot) * 100) / 100);
    const realRisk = lots * perLot;
    const revenge = base.lastLoss && open - base.lastLoss < 30 * 60e3;
    let chance = p0 + sb + hb + (feel <= 2 ? -0.12 : 0) + (revenge ? -0.2 : 0) + (bigRisk ? -0.08 : 0);
    const rulesBroken = revenge || bigRisk || feel <= 2 || r() < 0.08;
    if (rulesBroken) chance -= 0.06;
    const win = r() < chance;
    const be = !win && r() < 0.07;
    let R;
    if (win) R = 1.1 + r() * 1.5;
    else if (be) R = 0;
    else R = r() < 0.15 ? -1.4 : -1;
    const pnl = Math.round(realRisk * R * 100) / 100 - Math.round(lots * (info.kind === 'fx' ? 3.5 : 1) * 100) / 100;
    // Gewinner werden eher zu früh geschlossen, Verlierer laufen gelassen (meist kurz, ab und zu sehr lang)
    const tf = pick(['M5', 'M15', 'M15', 'H1']);
    const u = r();
    const hold = (win ? 4 + 70 * u * u : 8 + 170 * u * u) * (tf === 'H1' ? 2.2 : tf === 'M5' ? 0.6 : 1) * 60e3;
    const entry = Math.round(price * (1 + (r() - 0.5) * 0.02) / info.pip) * info.pip;
    const dir = side === 'long' ? 1 : -1;
    const slP = entry - dir * sl;
    const tpP = entry + dir * sl * 2;
    const exitP = entry + dir * sl * R;
    const mistakes = [];
    if (revenge) mistakes.push('Revenge');
    if (bigRisk) mistakes.push('Zu großes Risiko');
    if (!win && R < -1.2) mistakes.push('SL verschoben');
    if (win && R < 1.4 && r() < 0.5) mistakes.push('Zu früh raus');
    if (feel <= 2 && r() < 0.5) mistakes.push('FOMO');
    const rules = S.settings.rules;
    const checks = Object.fromEntries(rules.map((ru) => [ru.id, !rulesBroken || r() < 0.4]));
    if (rulesBroken) checks[pick(rules).id] = false;
    const closeAt = open + hold;
    // Den Check gibt es in den letzten drei Wochen: Rot bei Revenge und zu viel Risiko, Gelb bei gebrochenen Regeln
    const recent = a.status !== 'verloren' && closeAt > now - 21 * 864e5;
    const check = recent ? (revenge || bigRisk ? 'red' : rulesBroken ? 'yellow' : r() < 0.85 ? 'green' : 'yellow') : null;
    const t = {
      id: `demo-t-${trades.length}`,
      accountId: a.id,
      symbol: sym,
      side,
      lots,
      entry: +entry.toFixed(info.kind === 'fx' ? 5 : 2),
      sl: +slP.toFixed(info.kind === 'fx' ? 5 : 2),
      tp: +tpP.toFixed(info.kind === 'fx' ? 5 : 2),
      exit: +exitP.toFixed(info.kind === 'fx' ? 5 : 2),
      pnl,
      openAt: open,
      closeAt,
      day: tradingDay(closeAt, a.resetHour),
      setup,
      tf,
      mistakes,
      checks,
      rulesOk: rules.every((ru) => checks[ru.id]),
      feelBefore: feel,
      feelAfter: win ? 3 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3),
      note: win ? pick(['Sauberer Einstieg nach Bestätigung.', 'Geduldig gewartet, Plan aufgegangen.', '']) : pick(['Zu früh rein, keine Bestätigung abgewartet.', 'Gegen den höheren Trend.', 'News unterschätzt.', '']),
      check,
      source: 'hand',
      demo: true,
      createdAt: closeAt,
      updatedAt: closeAt,
    };
    if (closeAt > now) return null;
    base.lastLoss = pnl < 0 ? closeAt : null;
    base.lastClose = closeAt;
    trades.push(t);
    return t;
  };
  const hoursFor = (n, list = HOURS) => Array.from({ length: n }, () => pick(list)).sort((a, b) => a[0] - b[0]);
  // heute nur Stunden, die schon vorbei sind, damit es einen Trade von heute gibt
  const past = HOURS.filter(([h]) => Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), h + 2) < now);
  // altes, nicht bestandenes Konto: zu viel Risiko
  for (let i = 108; i > 82; i--) {
    const day = addDays(t0, -i);
    const wd = fromISO(day).getDay();
    if (wd === 0 || wd === 6) continue;
    const base = {};
    const n = 1 + Math.floor(r() * 3);
    hoursFor(n).forEach((h) => make(old, day, base, h));
  }
  // aktuelle Challenge: 6 Wochen
  for (let i = 42; i >= 0; i--) {
    const day = addDays(t0, -i);
    const wd = fromISO(day).getDay();
    if (wd === 0 || wd === 6) continue;
    if (r() < 0.15 && i) continue;
    const base = {};
    const n = i === 0 ? 1 : 1 + Math.floor(r() * (r() < 0.25 ? 5 : 3));
    if (i === 0 && !past.length) continue;
    hoursFor(n, i === 0 ? past : HOURS).forEach((h) => make(acc, day, base, h));
  }
  // Journal: Plan und Rückblick an einigen Tagen
  const days = [];
  for (let i = 14; i >= 0; i--) {
    const day = addDays(t0, -i);
    const wd = fromISO(day).getDay();
    if (wd === 0 || wd === 6 || r() < 0.3) continue;
    const ts = trades.filter((t) => t.day === day && t.accountId === acc.id);
    const net = ts.reduce((s, t) => s + t.pnl, 0);
    days.push({
      date: day,
      bias: { EURUSD: pick(['bull', 'bear', null]), XAUUSD: pick(['bull', 'bull', 'bear']), NAS100: pick(['bull', null, 'bear']) },
      levels: pick(['EURUSD 1,0880 Widerstand, 1,0810 Unterstützung', 'Gold: 2.660 oben, 2.630 unten. Vortageshoch beachten.', 'NAS 20.550 Ausbruchsmarke, darunter 20.380']),
      news: pick(['14:30 US-Inflation, 15 Minuten vorher nichts', 'Keine großen News', '20:00 Fed-Protokoll']),
      plan: pick(['Nur Pullbacks im London-Trend, maximal 2 Trades.', 'Erst nach der New-York-Eröffnung, kein Asien-Trading.', 'Gold long nur über 2.640 mit Bestätigung auf M15.']),
      mood: ts.length ? (net > 0 ? 4 + Math.round(r()) : 2 + Math.round(r())) : 3,
      follow: net > 0 ? 'ja' : pick(['teils', 'nein']),
      good: net > 0 ? pick(['Geduldig gewartet', 'SL nicht angefasst', 'Nach dem Ziel aufgehört']) : '',
      better: net <= 0 ? pick(['Nach einem Verlust Pause machen', 'Kein Trading in der Asien-Session', 'Risiko nicht erhöhen, um Verluste aufzuholen']) : '',
      demo: true,
      updatedAt: now,
    });
  }
  // Ein Trade läuft gerade: geprüft, Ampel grün
  const live = {
    id: 'demo-open-1',
    accountId: acc.id,
    symbol: 'XAUUSD',
    side: 'long',
    lots: 0.5,
    entry: 2652.4,
    sl: 2646.4,
    tp: 2664.4,
    risk: 300,
    setup: 'Pullback',
    feelBefore: 4,
    checks: Object.fromEntries(S.settings.rules.map((ru) => [ru.id, true])),
    rulesOk: true,
    check: 'green',
    openAt: now - 28 * 60e3,
    demo: true,
  };
  return { acc, old, trades, days, open: [live] };
}
