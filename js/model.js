// Strategie-Checkliste, Regeln und Kennzahlen.

// required: Pflicht für „Regeln eingehalten“. Bei Mehrfachauswahl reicht ein Haken.
export const BIAS = [
  { key: 'htfDir', label: 'HTF in meine Richtung', type: 'toggle', required: true, short: 'HTF-Richtung' },
  {
    key: 'structure', label: 'HTF-Struktur', type: 'multi', required: true, prefix: 'HTF',
    options: [['bos', 'BOS'], ['choch', 'CHoCH']],
  },
  {
    key: 'confirm', label: 'HTF-Bestätigung', type: 'multi', required: true, prefix: 'HTF',
    options: [['fib', 'Fibonacci'], ['fvg', 'FVG'], ['ifvg', 'IFVG'], ['breaker', 'Breaker']],
  },
];

export const ENTRY = [
  {
    key: 'liq', label: 'Liquidität genommen', type: 'multi', required: true, prefix: 'Liq',
    options: [['daily', 'Daily H/L'], ['htf', 'HTF H/L'], ['weekly', 'Weekly H/L']],
  },
  { key: 'sweep', label: 'Sweep', type: 'toggle', required: false },
  { key: 'shift', label: 'Shift', type: 'toggle', required: true },
  {
    key: 'model', label: 'Einstieg über', type: 'multi', required: true, prefix: 'Entry',
    options: [['ote', 'OTE'], ['breaker', 'Breaker'], ['fvg', 'FVG']],
  },
  { key: 'rejection', label: 'Rejection', type: 'toggle', required: true, hint: 'z. B. Engulfing' },
];

export const GROUPS = [...BIAS, ...ENTRY];

export const SENSE_LABELS = ['', 'Gar nicht', 'Eher nicht', 'Neutral', 'Ja', 'Voll'];

export function emptyChecks() {
  return { htfDir: false, structure: [], confirm: [], liq: [], sweep: false, shift: false, model: [], rejection: false };
}

export function groupOk(g, checks) {
  const v = checks?.[g.key];
  return g.type === 'toggle' ? !!v : (v || []).length > 0;
}

export function missing(checks) {
  return GROUPS.filter((g) => g.required && !groupOk(g, checks));
}

export const rulesAuto = (t) => missing(t.checks).length === 0;
export const rulesOk = (t) => (typeof t.rulesOverride === 'boolean' ? t.rulesOverride : rulesAuto(t));

// Einzelne Haken für die Auswertung „mit / ohne“
export const FEATURES = [];
for (const [section, list] of [['Bias', BIAS], ['Entry', ENTRY]]) {
  for (const g of list) {
    if (g.type === 'toggle') {
      FEATURES.push({ id: g.key, section, label: g.short || g.label, test: (c) => !!c?.[g.key] });
    } else {
      for (const [v, l] of g.options) {
        FEATURES.push({ id: `${g.key}.${v}`, section, label: `${g.prefix} ${l}`, test: (c) => (c?.[g.key] || []).includes(v) });
      }
    }
  }
}

export function rOf(t) {
  if (t.status !== 'closed' || !(t.riskEur > 0)) return null;
  return t.pnl / t.riskEur;
}

// Break-even: innerhalb von ±0,1 R
export function outcome(t) {
  const r = rOf(t);
  if (r != null) return r > 0.1 ? 'win' : r < -0.1 ? 'loss' : 'be';
  return t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'be';
}

export const OUTCOME_LABEL = { win: 'Win', loss: 'Loss', be: 'BE' };

export function summarize(list) {
  const s = { n: list.length, wins: 0, losses: 0, be: 0, sumR: 0, nR: 0, sumEur: 0, rules: 0, gross: 0, grossLoss: 0 };
  for (const t of list) {
    const o = outcome(t);
    if (o === 'win') s.wins++;
    else if (o === 'loss') s.losses++;
    else s.be++;
    const r = rOf(t);
    if (r != null) { s.sumR += r; s.nR++; }
    s.sumEur += t.pnl || 0;
    if (t.pnl > 0) s.gross += t.pnl;
    else s.grossLoss -= t.pnl || 0;
    if (rulesOk(t)) s.rules++;
  }
  s.wr = s.wins + s.losses ? s.wins / (s.wins + s.losses) : null;
  s.avgR = s.nR ? s.sumR / s.nR : null;
  s.rulesPct = s.n ? s.rules / s.n : null;
  s.pf = s.grossLoss > 0 ? s.gross / s.grossLoss : s.gross > 0 ? Infinity : null;
  return s;
}

export const byClose = (a, b) => a.date.localeCompare(b.date) || (a.closedAt || 0) - (b.closedAt || 0);

// Größter Rückgang vom Hoch, Werte als kumulierte Kurve
export function maxDrawdown(curve) {
  let peak = 0;
  let dd = 0;
  for (const v of curve) {
    peak = Math.max(peak, v);
    dd = Math.max(dd, peak - v);
  }
  return dd;
}

// Kontostand, Ziel und Puffer bis zum Max-Verlust
export function accountState(acc, trades) {
  const closed = trades.filter((t) => t.status === 'closed').sort(byClose);
  const size = acc.size > 0 ? acc.size : 0;
  let run = 0;
  const curve = closed.map((t) => (run += t.pnl || 0));
  const pnl = run;
  const st = { size, pnl, bal: size + pnl, pct: size ? pnl / size : null, curve, closed, open: trades.filter((t) => t.status === 'open') };
  if (size && acc.targetPct > 0) {
    st.target = (size * acc.targetPct) / 100;
    st.progress = pnl / st.target;
  }
  if (size && acc.maxLossPct > 0) {
    st.maxLoss = (size * acc.maxLossPct) / 100;
    st.floor = size - st.maxLoss;
    st.buffer = st.bal - st.floor;
  }
  st.status = st.buffer != null && st.buffer <= 0 ? 'breach' : st.target && pnl >= st.target ? 'passed' : 'live';
  return st;
}

// Lokales Datum als YYYY-MM-DD
export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Typische Fehler, nach dem Trade optional anzutippen
export const MISTAKES = [
  ['fomo', 'FOMO'],
  ['early-in', 'Zu früh rein'],
  ['early-out', 'Zu früh raus'],
  ['sl-moved', 'SL verschoben'],
  ['size', 'Zu viel Risiko'],
  ['revenge', 'Revenge'],
  ['plan', 'Gegen den Plan'],
];
export const MISTAKE_LABEL = Object.fromEntries(MISTAKES);

// Montag der Woche als Schlüssel
export function weekKey(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return isoDate(m);
}

export function weekRange(key) {
  const start = parseDate(key);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end, from: key, to: isoDate(end) };
}

// Längste Serien von Wins und Losses (BE unterbricht nicht)
export function streaks(list) {
  let w = 0;
  let l = 0;
  let bw = 0;
  let bl = 0;
  for (const t of [...list].sort(byClose)) {
    const o = outcome(t);
    if (o === 'win') { w++; l = 0; }
    else if (o === 'loss') { l++; w = 0; }
    bw = Math.max(bw, w);
    bl = Math.max(bl, l);
  }
  return { win: bw, loss: bl };
}

// Kombinationen aus HTF-Bestätigung und Einstieg
export function setupCombos(list, min = 3) {
  const conf = GROUPS.find((g) => g.key === 'confirm');
  const model = GROUPS.find((g) => g.key === 'model');
  const map = new Map();
  for (const t of list) {
    for (const c of t.checks?.confirm || []) {
      for (const m of t.checks?.model || []) {
        const k = `${c}|${m}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(t);
      }
    }
  }
  const lab = (g, v) => g.options.find((o) => o[0] === v)?.[1] || v;
  return [...map]
    .map(([k, l]) => {
      const [c, m] = k.split('|');
      return { conf: `HTF ${lab(conf, c)}`, model: lab(model, m), s: summarize(l), list: l };
    })
    .filter((x) => x.s.n >= min && x.s.avgR != null)
    .sort((a, b) => b.s.avgR - a.s.avgR);
}
