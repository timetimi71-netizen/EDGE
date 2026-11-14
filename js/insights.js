// Erkenntnisse aus den eigenen Trades: Was bringt R, was kostet R?
import { summarize, rulesOk, FEATURES, parseDate } from './model.js';
import { fmtR, fmtPct, esc } from './ui.js';

const MIN = 3; // Mindestanzahl Trades pro Vergleichsgruppe
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const line = (s) => `Ø ${fmtR(s.avgR)} · ${fmtPct(s.wr)} Treffer · ${s.n} Trades`;

function compare(a, b) {
  const sa = summarize(a);
  const sb = summarize(b);
  if (sa.n < MIN || sb.n < MIN || sa.avgR == null || sb.avgR == null) return null;
  return { sa, sb, diff: sa.avgR - sb.avgR };
}

export function insights(closed) {
  if (closed.length < 6) return [];
  const out = [];

  // Regeln
  const rules = compare(closed.filter(rulesOk), closed.filter((t) => !rulesOk(t)));
  if (rules) {
    const good = rules.diff >= 0;
    out.push({
      tone: good ? 'good' : 'bad',
      kicker: 'Regeln',
      title: good ? `Regeln bringen dir ${fmtR(rules.diff)} pro Trade` : 'Regelbrüche laufen bisher besser',
      text: good
        ? `Eingehalten: ${line(rules.sa)}.<br>Gebrochen: ${line(rules.sb)}.`
        : `Gebrochen: ${line(rules.sb)}.<br>Eingehalten: ${line(rules.sa)}. Schau dir an, ob deine Pflicht-Haken zu streng sind.`,
      score: Math.abs(rules.diff) + 0.5,
    });
  }

  // Gefühl
  const rated = closed.filter((t) => t.sense);
  const sense = compare(rated.filter((t) => t.sense >= 4), rated.filter((t) => t.sense <= 3));
  if (sense) {
    const good = sense.diff >= 0;
    out.push({
      tone: good ? 'good' : 'bad',
      kicker: 'Bauchgefühl',
      title: good ? 'Dein Gefühl liegt richtig' : 'Dein Gefühl täuscht dich',
      text: `Sinn 4–5: ${line(sense.sa)}.<br>Sinn 1–3: ${line(sense.sb)}.`,
      score: Math.abs(sense.diff) + 0.3,
    });
  }

  // Bester und schwächster Haken
  const feats = FEATURES.map((f) => ({ f, c: compare(closed.filter((t) => f.test(t.checks)), closed.filter((t) => !f.test(t.checks))) })).filter((x) => x.c);
  if (feats.length) {
    feats.sort((a, b) => b.c.diff - a.c.diff);
    const best = feats[0];
    if (best.c.diff > 0.15) {
      out.push({
        tone: 'good',
        kicker: 'Stärkster Haken',
        title: `${esc(best.f.label)} bringt ${fmtR(best.c.diff)} mehr`,
        text: `Mit: ${line(best.c.sa)}.<br>Ohne: ${line(best.c.sb)}.`,
        score: best.c.diff,
      });
    }
    const worst = feats[feats.length - 1];
    if (worst !== best && worst.c.diff < -0.15) {
      out.push({
        tone: 'bad',
        kicker: 'Schwächster Haken',
        title: `${esc(worst.f.label)} kostet dich ${fmtR(Math.abs(worst.c.diff), false)}`,
        text: `Mit: ${line(worst.c.sa)}.<br>Ohne: ${line(worst.c.sb)}.`,
        score: Math.abs(worst.c.diff),
      });
    }
  }

  // Symbole
  const bySym = groupBy(closed, (t) => t.symbol);
  if (bySym.length > 1) {
    const best = bySym[0];
    const worst = bySym[bySym.length - 1];
    if (best.s.sumR > 0) {
      out.push({ tone: 'good', kicker: 'Bestes Symbol', title: `${esc(best.key)} läuft am besten`, text: `${fmtR(best.s.sumR)} gesamt · ${line(best.s)}.`, score: 0.4 });
    }
    if (worst.s.sumR < 0) {
      out.push({ tone: 'bad', kicker: 'Sorgenkind', title: `${esc(worst.key)} frisst R`, text: `${fmtR(worst.s.sumR)} gesamt · ${line(worst.s)}.`, score: 0.6 });
    }
  }

  // Wochentag
  const byDay = groupBy(closed, (t) => WD[parseDate(t.date).getDay()], 'avgR');
  if (byDay.length > 1) {
    const best = byDay[0];
    const worst = byDay[byDay.length - 1];
    if (best.s.avgR > 0) out.push({ tone: 'good', kicker: 'Wochentag', title: `${best.key} ist dein Tag`, text: `${line(best.s)}.`, score: 0.25 });
    if (worst.s.avgR < 0) out.push({ tone: 'bad', kicker: 'Wochentag', title: `${worst.key}s lieber vorsichtig`, text: `${line(worst.s)}.`, score: 0.35 });
  }

  // Richtung
  const ls = compare(closed.filter((t) => t.side === 'long'), closed.filter((t) => t.side === 'short'));
  if (ls && Math.abs(ls.diff) > 0.2) {
    const longBetter = ls.diff > 0;
    out.push({
      tone: 'neutral',
      kicker: 'Richtung',
      title: `${longBetter ? 'Longs' : 'Shorts'} liegen dir mehr`,
      text: `Long: ${line(ls.sa)}.<br>Short: ${line(ls.sb)}.`,
      score: Math.abs(ls.diff) * 0.6,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

function groupBy(list, keyFn, by = 'sumR') {
  const m = new Map();
  for (const t of list) {
    const k = keyFn(t);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return [...m]
    .map(([key, l]) => ({ key, s: summarize(l) }))
    .filter((x) => x.s.n >= MIN && x.s.avgR != null)
    .sort((a, b) => b.s[by] - a.s[by]);
}
