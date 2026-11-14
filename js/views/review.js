// Wochenrückblick: Zahlen der Woche, Fehler, Fokus-Check, drei Fragen, neuer Fokus
import { accTrades, activeAccount, getReview, saveReview, state } from '../store.js';
import { summarize, weekKey, weekRange, MISTAKES, isoDate, rOf } from '../model.js';
import { esc, icon, fmtR, fmtEur, fmtPct, tone, toast, MONTHS, topbar } from '../ui.js';
import { closedRow } from './list.js';
import { weekCard, shareCanvas, bestWorst } from '../share.js';
import { go } from '../main.js';

export function weekLabel(key) {
  const { start, end } = weekRange(key);
  const sameMonth = start.getMonth() === end.getMonth();
  return `${start.getDate()}.${sameMonth ? '' : ` ${MONTHS[start.getMonth()].slice(0, 3)}.`} – ${end.getDate()}. ${MONTHS[end.getMonth()]}`;
}

export const shiftWeek = (key, n) => {
  const d = weekRange(key).start;
  d.setDate(d.getDate() + 7 * n);
  return isoDate(d);
};

export const weekTrades = (key) => {
  const { from, to } = weekRange(key);
  return accTrades().filter((t) => t.status === 'closed' && t.date >= from && t.date <= to);
};

const FOCUS_RATES = [['yes', 'Umgesetzt'], ['part', 'Teilweise'], ['no', 'Nicht']];

export function reviewView(root, key) {
  const cur = weekKey();
  key = key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? weekKey(new Date(key)) : cur;
  const list = weekTrades(key);
  const s = summarize(list);
  const prev = summarize(weekTrades(shiftWeek(key, -1)));
  const saved = getReview(key) || {};
  const prevFocus = getReview(shiftWeek(key, -1))?.focus;
  const draft = { good: saved.good || '', improve: saved.improve || '', focus: saved.focus || '', focusRate: saved.focusRate || null };
  const { best, worst } = bestWorst(list);
  const range = weekRange(key);

  // Tage
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(range.start);
    d.setDate(d.getDate() + i);
    const ds = summarize(list.filter((t) => t.date === isoDate(d)));
    days.push(ds.n ? (ds.nR ? ds.sumR : ds.sumEur) : null);
  }
  const maxAbs = Math.max(1e-9, ...days.map((v) => Math.abs(v || 0)));

  // Fehler der Woche
  const mk = MISTAKES.map(([k, l]) => {
    const ts = list.filter((t) => t.mistakes?.includes(k));
    return { l, n: ts.length, r: ts.reduce((a, t) => a + (rOf(t) ?? 0), 0) };
  }).filter((m) => m.n);

  const lessons = list.filter((t) => t.lesson);
  const diff = s.nR && prev.nR ? s.sumR - prev.sumR : null;

  root.innerHTML = `${topbar({ title: 'Wochenrückblick', back: '#/home', right: list.length ? `<button class="tb-btn" data-share aria-label="Teilen">${icon('share')}</button>` : '' })}
    <main class="page review">
      <div class="cal-nav">
        <button class="tb-btn" data-wk="-1" aria-label="Woche davor">${icon('back')}</button>
        <h2>${weekLabel(key)}${key === cur ? ' <span class="pill">Diese Woche</span>' : ''}</h2>
        <button class="tb-btn flip" data-wk="1" aria-label="Woche danach" ${key >= cur ? 'disabled' : ''}>${icon('back')}</button>
      </div>

      <section class="card rv-hero">
        <div class="rv-main num ${tone(s.sumEur)}">${s.n ? (s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur)) : '–'}</div>
        <div class="rv-sub">${s.n ? `${s.nR ? `${fmtEur(s.sumEur)} · ` : ''}${diff != null ? `<span class="${tone(diff)}">${diff >= 0 ? '▲' : '▼'} ${fmtR(Math.abs(diff), false)} zur Vorwoche</span>` : ''}` : 'Keine abgeschlossenen Trades in dieser Woche'}</div>
        <div class="rv-days">${days
          .map((v, i) => `<div class="rv-day"><div class="rv-bar-wrap">${v == null ? '' : `<i class="${v >= 0 ? 'up' : 'down'}" style="--h:${Math.max(6, (Math.abs(v) / maxAbs) * 100).toFixed(0)}%"></i>`}</div><span>${'MDMDFSS'[i]}</span></div>`)
          .join('')}</div>
        <div class="rv-kpis">
          <div><span>Trades</span><b class="num">${s.n}</b></div>
          <div><span>Treffer</span><b class="num">${fmtPct(s.wr)}</b></div>
          <div><span>Regeln</span><b class="num">${fmtPct(s.rulesPct)}</b></div>
          <div><span>Ø R</span><b class="num">${s.avgR == null ? '–' : fmtR(s.avgR).replace(' R', '')}</b></div>
        </div>
      </section>

      ${best ? `<div class="sec-title"><h2>Bester${worst ? ' und schwächster' : ''} Trade</h2></div><div class="rows">${closedRow(best)}${worst ? closedRow(worst) : ''}</div>` : ''}

      ${mk.length ? `<div class="sec-title"><h2>Fehler der Woche</h2></div>
        <section class="card flush mk-list">${mk.map((m) => `<div class="mk-row"><span>${m.l}</span><span class="muted">${m.n}×</span><b class="num ${tone(m.r)}">${fmtR(m.r)}</b></div>`).join('')}</section>` : ''}

      ${lessons.length ? `<div class="sec-title"><h2>Deine Lektionen</h2></div>
        <section class="card lessons">${lessons.map((t) => `<a href="#/trade/${t.id}" class="lesson-row">„${esc(t.lesson)}“<small>${esc(t.symbol)}</small></a>`).join('')}</section>` : ''}

      ${prevFocus ? `<div class="sec-title"><h2>Dein Fokus für diese Woche war</h2></div>
        <section class="card focus-check">
          <p class="focus-quote">„${esc(prevFocus)}“</p>
          <div class="seg three small" data-rate>${FOCUS_RATES.map(([k, l]) => `<button type="button" data-v="${k}" class="${draft.focusRate === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        </section>` : ''}

      <div class="sec-title"><h2>Reflexion</h2></div>
      <section class="card reflect">
        <label><span>Was lief gut?</span><textarea data-f="good" rows="3" placeholder="Geduld, saubere Bias-Analyse …">${esc(draft.good)}</textarea></label>
        <label><span>Was mache ich nächste Woche besser?</span><textarea data-f="improve" rows="3" placeholder="Nicht vor dem Shift einsteigen …">${esc(draft.improve)}</textarea></label>
        <label class="focus-in"><span>${icon('spark')} Mein Fokus für nächste Woche</span><input data-f="focus" value="${esc(draft.focus)}" placeholder="Ein Satz. Der steht dann auf Home." autocomplete="off"></label>
      </section>
    </main>
    <div class="savebar"><button class="btn primary block" data-save>${saved.updatedAt ? 'Rückblick aktualisieren' : 'Woche abschließen'}</button></div>`;

  root.querySelectorAll('[data-wk]').forEach((b) => (b.onclick = () => go(`review/${shiftWeek(key, Number(b.dataset.wk))}`, true)));
  root.querySelectorAll('[data-f]').forEach((el) => (el.oninput = () => (draft[el.dataset.f] = el.value)));
  root.querySelectorAll('[data-rate] button').forEach((b) => {
    b.onclick = () => {
      draft.focusRate = draft.focusRate === b.dataset.v ? null : b.dataset.v;
      root.querySelectorAll('[data-rate] button').forEach((x) => x.classList.toggle('on', x.dataset.v === draft.focusRate));
    };
  });
  root.querySelector('[data-share]')?.addEventListener('click', () => shareCanvas(weekCard(list, range, activeAccount().name), `vanta-woche-${key}`));
  root.querySelector('[data-save]').onclick = async () => {
    await saveReview(key, { good: draft.good.trim(), improve: draft.improve.trim(), focus: draft.focus.trim(), focusRate: draft.focusRate });
    toast(draft.focus.trim() ? 'Gespeichert · Fokus steht auf Home' : 'Rückblick gespeichert');
    go('home', true);
  };
}

// Alle Wochen mit Trades
export function reviewsView(root) {
  const keys = [...new Set(accTrades().filter((t) => t.status === 'closed').map((t) => weekKey(new Date(t.date))))].sort().reverse();
  const reviews = state.reviews[state.settings.active] || {};
  root.innerHTML = `${topbar({ title: 'Rückblicke', back: '#/home' })}
    <main class="page">
      ${keys.length ? `<div class="rows">${keys
        .map((k) => {
          const s = summarize(weekTrades(k));
          const r = reviews[k];
          return `<a class="row" href="#/review/${k}">
            <div class="row-main"><div class="row-title"><b>${weekLabel(k)}</b>${r ? `<span class="rule ok">${icon('check')}</span>` : ''}</div>
            <div class="row-sub">${r?.focus ? `Fokus: ${esc(r.focus)}` : r ? 'Abgeschlossen' : 'Noch offen'}</div></div>
            <div class="row-val"><div class="num ${tone(s.sumEur)}">${s.nR ? fmtR(s.sumR) : fmtEur(s.sumEur)}</div><div class="muted small">${s.n} Trades</div></div>
          </a>`;
        })
        .join('')}</div>` : '<div class="empty small"><h2>Noch keine Wochen</h2><p>Sobald du Trades abschließt, kannst du hier jede Woche zurückblicken.</p></div>'}
    </main>`;
}
