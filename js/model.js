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
  const s = { n: list.length, wins: 0, losses: 0, be: 0, sumR: 0, nR: 0, sumEur: 0, rules: 0 };
  for (const t of list) {
    const o = outcome(t);
    if (o === 'win') s.wins++;
    else if (o === 'loss') s.losses++;
    else s.be++;
    const r = rOf(t);
    if (r != null) { s.sumR += r; s.nR++; }
    s.sumEur += t.pnl || 0;
    if (rulesOk(t)) s.rules++;
  }
  s.wr = s.wins + s.losses ? s.wins / (s.wins + s.losses) : null;
  s.avgR = s.nR ? s.sumR / s.nR : null;
  s.rulesPct = s.n ? s.rules / s.n : null;
  return s;
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
