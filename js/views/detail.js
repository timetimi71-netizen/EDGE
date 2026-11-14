// Trade-Detail: Ergebnis, Regeln, Checkliste, Screenshots, Notiz
import { getTrade, getImage, saveTrade, deleteTrade, delImage } from '../store.js';
import { BIAS, ENTRY, SENSE_LABELS, groupOk, missing, rOf, rulesAuto, rulesOk, outcome, OUTCOME_LABEL, MISTAKE_LABEL } from '../model.js';
import { tradeCard, shareCanvas } from '../share.js';
import { esc, icon, fmtEur, fmtR, fmtDate, sideTag, tone, viewImage, confirmSheet, toast, topbar } from '../ui.js';
import { go } from '../main.js';
import { openClose } from './close.js';

function groupView(g, c) {
  const ok = groupOk(g, c);
  if (g.type === 'toggle') {
    return `<div class="dl-row ${ok ? 'on' : 'off'}">
      <span class="dot">${ok ? icon('check') : ''}</span><span class="dl-label">${esc(g.label)}</span>
      ${g.required ? (ok ? '' : '<span class="miss">fehlt</span>') : '<span class="opt">optional</span>'}
    </div>`;
  }
  const sel = c[g.key] || [];
  return `<div class="dl-group">
    <div class="dl-ghead"><span class="dot ${ok ? 'on' : ''}">${ok ? icon('check') : ''}</span>${esc(g.label)}${g.required && !ok ? '<span class="miss">fehlt</span>' : ''}</div>
    <div class="chips ro">${g.options.map(([v, l]) => `<span class="chip ${sel.includes(v) ? 'on' : ''}">${esc(l)}</span>`).join('')}</div>
  </div>`;
}

export async function detailView(root, id) {
  const t = getTrade(id);
  if (!t) return go('trades', true);
  const closed = t.status === 'closed';
  const r = rOf(t);
  const auto = rulesAuto(t);
  const ok = rulesOk(t);
  const miss = missing(t.checks);
  const overridden = typeof t.rulesOverride === 'boolean';

  const result = closed
    ? `<section class="card hero">
        <div class="hero-main num ${tone(t.pnl)}">${r != null ? fmtR(r) : fmtEur(t.pnl)}</div>
        <div class="hero-sub">
          ${r != null ? `<span class="num ${tone(t.pnl)}">${fmtEur(t.pnl)}</span><span class="muted">·</span>` : ''}
          <span class="pill">${OUTCOME_LABEL[outcome(t)]}</span>
          ${t.riskEur ? `<span class="muted">Risiko ${fmtEur(t.riskEur, false)}</span>` : ''}
        </div>
      </section>`
    : `<section class="card hero open">
        <div class="hero-open"><span class="pill">Offen</span><span class="muted">Ergebnis fehlt noch</span></div>
        <button class="btn primary block" data-close>Abschließen</button>
      </section>`;

  const rules = `<section class="card rules-card ${ok ? 'ok' : 'bad'}">
      <div class="rules-line">
        <span class="rule-big">${icon(ok ? 'check' : 'x')}</span>
        <div><b>${closed ? (ok ? 'Regeln eingehalten' : 'Regeln gebrochen') : ok ? 'Regeln erfüllt' : 'Regeln nicht erfüllt'}</b>
        <span class="muted small">${overridden ? `von dir gesetzt · automatisch: ${auto ? 'Ja' : 'Nein'}` : auto ? 'automatisch' : `automatisch · fehlt ${miss.map((g) => esc(g.label)).join(', ')}`}</span></div>
      </div>
      <button class="btn ghost sm" data-flip>${ok ? 'Auf Nein' : 'Auf Ja'}</button>
    </section>`;

  root.innerHTML = `${topbar({ title: t.symbol, back: '#/trades', right: `<button class="tb-btn" data-share aria-label="Teilen">${icon('share')}</button><a class="tb-text" href="#/edit/${t.id}">Bearbeiten</a>` })}
    <main class="page">
      <div class="detail-head">${sideTag(t.side)}<span class="muted">${fmtDate(t.date, true)}</span></div>
      ${result}
      ${rules}
      <div class="sec-title"><h2>Bias</h2></div>
      <section class="card">${BIAS.map((g) => groupView(g, t.checks)).join('')}</section>
      <div class="sec-title"><h2>Entry</h2></div>
      <section class="card">${ENTRY.map((g) => groupView(g, t.checks)).join('')}</section>
      <div class="sec-title"><h2>Macht der Trade Sinn?</h2></div>
      <section class="card">
        <div class="sense ro">${[1, 2, 3, 4, 5].map((n) => `<span class="${t.sense === n ? 'on' : t.sense > n ? 'part' : ''}">${n}</span>`).join('')}</div>
        <div class="sense-label">${t.sense ? SENSE_LABELS[t.sense] : 'Nicht bewertet'}</div>
      </section>
      ${closed && (t.mistakes?.length || t.lesson) ? `<div class="sec-title"><h2>Nach dem Trade</h2></div>
      <section class="card after">
        ${t.mistakes?.length ? `<div class="chips">${t.mistakes.map((k) => `<span class="chip sm mk on">${esc(MISTAKE_LABEL[k] || k)}</span>`).join('')}</div>` : '<span class="muted small">Keine Fehler markiert</span>'}
        ${t.lesson ? `<p class="lesson-quote">„${esc(t.lesson)}“</p>` : ''}
      </section>` : ''}
      ${t.shots?.length ? '<div class="sec-title"><h2>Screenshots</h2></div><section class="card"><div class="shots" data-shots></div></section>' : ''}
      ${t.note ? `<div class="sec-title"><h2>Notiz</h2></div><section class="card note">${esc(t.note)}</section>` : ''}
      <button class="btn danger-ghost block" data-del>${icon('trash')} Trade löschen</button>
    </main>`;

  root.querySelector('[data-close]')?.addEventListener('click', () => openClose(t.id, () => detailView(root, id)));

  root.querySelector('[data-flip]').onclick = async () => {
    const next = !ok;
    t.rulesOverride = next === auto ? null : next;
    await saveTrade(t);
    detailView(root, id);
  };

  root.querySelector('[data-share]').onclick = () => shareCanvas(tradeCard(t), `vanta-${t.symbol}-${t.date}`);

  root.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmSheet({ title: 'Trade löschen?', text: `${t.symbol} vom ${fmtDate(t.date, true)} wird gelöscht.`, ok: 'Löschen', danger: true }))) return;
    const gone = await deleteTrade(t.id, { keepImages: true });
    let undone = false;
    toast('Trade gelöscht', {
      action: 'Rückgängig',
      onAction: async () => {
        undone = true;
        await saveTrade(gone);
        toast('Wiederhergestellt');
        go(`trade/${gone.id}`);
      },
      onDone: () => !undone && (gone.shots || []).forEach((s) => delImage(s)),
    });
    go('trades', true);
  };

  const shotsEl = root.querySelector('[data-shots]');
  if (shotsEl) {
    for (const s of t.shots) {
      const b = await getImage(s);
      if (!b) continue;
      const u = URL.createObjectURL(b);
      const img = document.createElement('img');
      img.src = u;
      img.alt = '';
      img.onclick = () => viewImage(u);
      const d = document.createElement('div');
      d.className = 'shot';
      d.append(img);
      shotsEl.append(d);
    }
  }
}
