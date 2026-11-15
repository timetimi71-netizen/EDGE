// Ergebnis eintragen: als Sheet zum Abschließen und als Teil des Formulars
import { getTrade, saveTrade, defaultRisk, activeAccount, accTrades } from '../store.js';
import { moment, haptic } from '../fx.js';
import { rulesAuto, rulesOk, missing, outcome, OUTCOME_LABEL, MISTAKES, rOf, byClose } from '../model.js';
import { esc, fmtR, fmtEur, parseNum, sheet, toast, sideTag, tone } from '../ui.js';

const fmtIn = (v) => (v == null ? '' : String(v).replace('.', ','));

// draft: { sign: 1|-1, amount, risk, override: null|true|false }, t: Trade mit checks
export function resultHtml(draft, t) {
  const acc = activeAccount()?.size;
  return `<div class="result">
    <div class="seg two" data-sign>
      <button type="button" data-v="1" class="${draft.sign > 0 ? 'on up' : ''}">Gewinn</button>
      <button type="button" data-v="-1" class="${draft.sign < 0 ? 'on down' : ''}">Verlust</button>
    </div>
    <div class="fields">
      <label class="field"><span>Betrag</span>
        <div class="input-unit"><input data-amount inputmode="decimal" placeholder="0" value="${fmtIn(draft.amount)}" autocomplete="off"><em>€</em></div>
      </label>
      <label class="field"><span>Risiko</span>
        <div class="input-unit"><input data-risk inputmode="decimal" placeholder="${acc > 0 ? '' : 'z. B. 100'}" value="${fmtIn(draft.risk)}" autocomplete="off"><em>€</em></div>
      </label>
    </div>
    <div class="calc" data-calc></div>
    <div class="rules-box" data-rules></div>
    <div class="mistakes">
      <div class="group-head"><span>Fehler gemacht?</span><span class="opt">optional</span></div>
      <div class="chips">${MISTAKES.map(([k, l]) => `<button type="button" class="chip sm mk ${draft.mistakes.includes(k) ? 'on' : ''}" data-mistake="${k}">${l}</button>`).join('')}</div>
      <input class="lesson" data-lesson value="${esc(draft.lesson)}" placeholder="Lektion in einem Satz …" autocomplete="off">
    </div>
  </div>`;
}

export function bindResult(root, draft, t) {
  const calc = root.querySelector('[data-calc]');
  const rulesEl = root.querySelector('[data-rules]');

  const update = () => {
    const pnl = draft.amount == null ? null : draft.sign * draft.amount;
    if (pnl == null) calc.innerHTML = '<span class="muted">Betrag eintragen, R wird berechnet</span>';
    else {
      const fake = { status: 'closed', pnl, riskEur: draft.risk };
      const r = draft.risk > 0 ? pnl / draft.risk : null;
      calc.innerHTML = `<span class="num ${tone(pnl)}">${r != null ? fmtR(r) : fmtEur(pnl)}</span><span class="pill">${OUTCOME_LABEL[outcome(fake)]}</span>`;
    }
    const auto = rulesAuto(t);
    const eff = typeof draft.override === 'boolean' ? draft.override : auto;
    const miss = missing(t.checks);
    rulesEl.innerHTML = `<div class="rules-row">
        <span>Regeln eingehalten?</span>
        <div class="seg two small" data-ov>
          <button type="button" data-v="1" class="${eff ? 'on' : ''}">Ja</button>
          <button type="button" data-v="0" class="${!eff ? 'on' : ''}">Nein</button>
        </div>
      </div>
      <p class="rules-note">${
        typeof draft.override === 'boolean'
          ? `Von dir geändert (automatisch wäre ${auto ? 'Ja' : 'Nein'}). <button type="button" class="link" data-reset>Zurücksetzen</button>`
          : auto
            ? 'Automatisch: alle Pflicht-Haken gesetzt.'
            : `Automatisch: fehlt ${miss.map((g) => esc(g.label)).join(', ')}.`
      }</p>`;
    rulesEl.querySelectorAll('[data-ov] button').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.v === '1';
        draft.override = v === auto ? null : v;
        update();
      };
    });
    rulesEl.querySelector('[data-reset]')?.addEventListener('click', () => {
      draft.override = null;
      update();
    });
  };

  root.querySelectorAll('[data-sign] button').forEach((b) => {
    b.onclick = () => {
      draft.sign = Number(b.dataset.v);
      root.querySelectorAll('[data-sign] button').forEach((x) => (x.className = ''));
      b.className = `on ${draft.sign > 0 ? 'up' : 'down'}`;
      update();
    };
  });
  const amount = root.querySelector('[data-amount]');
  amount.oninput = () => {
    const v = parseNum(amount.value);
    draft.amount = v == null ? null : Math.abs(v);
    if (v != null && v < 0) draft.sign = -1;
    update();
  };
  root.querySelectorAll('[data-mistake]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.mistake;
      const i = draft.mistakes.indexOf(k);
      if (i >= 0) draft.mistakes.splice(i, 1);
      else draft.mistakes.push(k);
      b.classList.toggle('on', i < 0);
    };
  });
  const lesson = root.querySelector('[data-lesson]');
  lesson.oninput = () => (draft.lesson = lesson.value);
  const risk = root.querySelector('[data-risk]');
  risk.oninput = () => {
    draft.risk = parseNum(risk.value);
    update();
  };
  update();
}

export function draftFrom(t) {
  if (t.status === 'closed') {
    return { sign: t.pnl < 0 ? -1 : 1, amount: Math.abs(t.pnl), risk: t.riskEur ?? defaultRisk(), override: t.rulesOverride ?? null, mistakes: [...(t.mistakes || [])], lesson: t.lesson || '' };
  }
  return { sign: 1, amount: null, risk: t.riskEur ?? defaultRisk(), override: t.rulesOverride ?? null, mistakes: [...(t.mistakes || [])], lesson: t.lesson || '' };
}

export function applyDraft(t, draft) {
  t.status = 'closed';
  t.pnl = draft.sign * draft.amount;
  t.riskEur = draft.risk > 0 ? draft.risk : null;
  t.rulesOverride = draft.override;
  t.mistakes = draft.mistakes;
  t.lesson = draft.lesson.trim();
  t.closedAt ??= Date.now();
}

export function openClose(id, done) {
  const t = getTrade(id);
  if (!t) return;
  const draft = draftFrom(t);
  const w = sheet(`<div class="sheet-body">
      <h3>Trade abschließen</h3>
      <p class="sheet-sub"><b>${esc(t.symbol)}</b>${sideTag(t.side)}</p>
      ${resultHtml(draft, t)}
      <div class="sheet-actions"><button class="btn primary block" data-save>Speichern</button></div>
    </div>`);
  bindResult(w, draft, t);
  setTimeout(() => w.querySelector('[data-amount]').focus(), 300);
  w.querySelector('[data-save]').onclick = async () => {
    if (draft.amount == null) {
      toast('Betrag fehlt');
      return;
    }
    applyDraft(t, draft);
    await saveTrade(t);
    w.close();
    await celebrate(t);
    done?.();
  };
}

// Vollbild-Moment nach dem Abschließen
const MILESTONES = [3, 5, 10, 15, 20, 30, 50, 75, 100];
export async function celebrate(t) {
  const r = rOf(t);
  const o = outcome(t);
  const ok = rulesOk(t);
  let streak = 0;
  for (const x of accTrades().filter((x) => x.status === 'closed').sort(byClose).reverse()) {
    if (!rulesOk(x)) break;
    streak++;
  }
  const big = r != null ? fmtR(r) : fmtEur(t.pnl);
  const milestone = ok && MILESTONES.includes(streak);
  haptic(o === 'win' ? 30 : 12);
  const lines = {
    win: ok ? 'Win nach Regeln. Genau so.' : 'Win, aber außerhalb der Regeln. Glück zählt nicht.',
    loss: ok ? 'Regeln eingehalten. So verliert ein Profi.' : 'Regeln gebrochen. Was nimmst du mit?',
    be: ok ? 'Break-even nach Regeln. Kapital geschützt.' : 'Break-even. Nächstes Mal nach Regeln.',
  };
  await moment({
    kicker: milestone ? `🔥 ${streak} Trades in Folge nach Regeln` : `${esc(t.symbol)} · ${OUTCOME_LABEL[o]}`,
    title: `<span class="m-num ${o === 'win' ? 'up' : o === 'loss' ? 'down' : ''}">${big}</span>`,
    text: lines[o],
    tone: o === 'win' || milestone ? 'good' : o === 'loss' ? 'bad' : 'neutral',
    ms: milestone ? 2600 : 1900,
  });
}
