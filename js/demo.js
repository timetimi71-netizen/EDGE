// Beispieldaten zum Ausprobieren der Statistik
import { emptyChecks, isoDate, uid } from './model.js';

const SYMBOLS = ['EURUSD', 'GBPUSD', 'XAUUSD', 'NAS100', 'USDJPY'];
const LESSONS = [
  'Erst den Shift abwarten, dann rein.',
  'Kein Trade ohne HTF-Bias.',
  'Stop bleibt, wo er ist.',
  'Nach einem Verlust eine Nacht drüber schlafen.',
  'Weekly-Liquidität ist der bessere Magnet.',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const some = (opts, p = 0.45) => {
  const out = opts.filter(() => Math.random() < p);
  return out.length || Math.random() < 0.25 ? out : [pick(opts)];
};

export function demoTrades(risk = 100) {
  const list = [];
  const today = new Date();
  for (let i = 0; i < 48; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.floor(Math.random() * 100) - 1);
    if (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 2);
    const c = emptyChecks();
    c.htfDir = Math.random() < 0.85;
    c.structure = some(['bos', 'choch'], 0.5);
    c.confirm = some(['fib', 'fvg', 'ifvg', 'breaker'], 0.35);
    c.liq = some(['daily', 'htf', 'weekly'], 0.4);
    c.sweep = Math.random() < 0.6;
    c.shift = Math.random() < 0.85;
    c.model = some(['ote', 'breaker', 'fvg'], 0.4);
    c.rejection = Math.random() < 0.8;
    const clean = c.htfDir && c.structure.length && c.confirm.length && c.liq.length && c.shift && c.model.length && c.rejection;
    const sense = Math.min(5, Math.max(1, Math.round((clean ? 3.6 : 2.6) + (Math.random() - 0.5) * 3)));
    const edge = (clean ? 0.52 : 0.3) + (c.sweep ? 0.06 : 0) + (sense >= 4 ? 0.04 : 0);
    const win = Math.random() < edge;
    const be = !win && Math.random() < 0.12;
    const r = be ? 0 : win ? 1.2 + Math.random() * 2 : -(0.8 + Math.random() * 0.2) - (Math.random() < 0.15 ? 0.4 : 0);
    const mistakes = [];
    if (!win && !be && Math.random() < (clean ? 0.3 : 0.65)) mistakes.push(pick(['fomo', 'early-in', 'sl-moved', 'revenge', 'plan']));
    if (win && Math.random() < 0.2) mistakes.push('early-out');
    const lesson = mistakes.length && Math.random() < 0.5 ? pick(LESSONS) : '';
    list.push({
      id: uid() + i,
      mistakes,
      lesson,
      createdAt: d.getTime(),
      closedAt: d.getTime() + 3600e3,
      date: isoDate(d),
      symbol: pick(SYMBOLS),
      side: Math.random() < 0.55 ? 'long' : 'short',
      checks: c,
      sense,
      shots: [],
      note: '',
      status: 'closed',
      pnl: Math.round(r * risk * 100) / 100,
      riskEur: risk,
      rulesOverride: null,
      demo: true,
    });
  }
  // Zwei offene Trades
  for (const sym of ['EURUSD', 'XAUUSD']) {
    const c = emptyChecks();
    Object.assign(c, { htfDir: true, structure: ['bos'], confirm: ['fvg'], liq: ['daily'], sweep: true, shift: true, model: ['ote'], rejection: sym === 'EURUSD' });
    list.push({ id: uid() + sym, createdAt: Date.now(), date: isoDate(), symbol: sym, side: 'long', checks: c, sense: 4, shots: [], note: '', status: 'open', demo: true });
  }
  return list;
}

export const DEMO_REVIEWS = [
  { good: 'Geduldig auf den Shift gewartet, keine Trades gegen den HTF-Bias.', improve: 'Freitags nicht mehr nachlegen.', focus: 'Nur A+ Setups: Sweep, Shift, Rejection.', focusRate: 'part' },
  { good: 'Zwei saubere Trades auf Weekly-Liquidität.', improve: 'SL nicht mehr nachziehen, bevor 1R erreicht ist.', focus: 'Stop bleibt, wo er ist.', focusRate: null },
];
