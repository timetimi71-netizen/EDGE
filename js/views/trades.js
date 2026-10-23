// Edge · Trades: Logbuch, Eintragen/Bearbeiten, Details, Lot-Rechner, Import aus MT5-Screenshots
import { S, saveTrade, deleteTrade, savePic, picURL, deletePic, saveSettings, activeAccount, accountTrades, removeOpen } from '../store.js';
import {
  symInfo,
  riskOf,
  rOf,
  rrOf,
  sessionOf,
  sessionName,
  holdMin,
  fmtHold,
  fmtMoney,
  fmtPct,
  fmtR,
  tone,
  tradingDay,
  accountState,
  guard,
  personal,
  kpis,
  CHECK,
} from '../edge.js';
import { extractTrades, errorText, connect } from '../gemini.js';
import { prepareChart, prepareForAI } from '../img.js';
import { icon, facesHTML, FEEL, openSheet, confirmDialog, segHTML, setSeg } from '../ui.js';
import { esc, iso, fmtNum, fmtShort, relDay, toLocalInput, fromLocalInput, hm, num, amount, clamp, haptic, toast, autosize, uid, IS_PREVIEW } from '../util.js';
import { act, app } from '../app.js';
import { toggleDictation, stopDictation } from '../speech.js';

let filter = 'all';
let symFilter = null;

/* ---------- Bausteine ---------- */
export function tradeRow(t, { date = false } = {}) {
  const r = rOf(t);
  const missing = !t.setup && t.feelBefore == null && t.rulesOk == null;
  const sub = [date ? fmtShort(t.day) : t.openAt ? hm(t.openAt) : hm(t.closeAt), `${fmtNum(t.lots || 0, 2)} Lot`, t.setup].filter(Boolean).join(' · ');
  return `<button type="button" class="trow" data-act="t-open" data-id="${esc(t.id)}">
    <span class="tside ${t.side === 'short' ? 'short' : 'long'}">${icon(t.side === 'short' ? 'down' : 'up')}</span>
    <span class="tmain"><span class="tsym">${esc(symInfo(t.symbol).sym)}${missing ? '<i class="tmiss" title="Details fehlen"></i>' : ''}</span><span class="tsub">${esc(sub)}</span></span>
    <span class="tres ${tone(t.pnl)}"><b>${fmtMoney(t.pnl, cur(t), { sign: true })}</b>${r != null ? `<small>${fmtR(r)}</small>` : ''}</span>
  </button>`;
}
const cur = (t) => S.accounts.get(t.accountId)?.currency || 'USD';

/* ---------- Ansicht: Logbuch ---------- */
export function render() {
  const acc = activeAccount();
  const all = acc ? accountTrades(acc.id).reverse() : [];
  const syms = [...new Set(all.map((t) => symInfo(t.symbol).sym))];
  const list = all.filter((t) => (filter === 'win' ? t.pnl > 0 : filter === 'loss' ? t.pnl < 0 : true) && (!symFilter || symInfo(t.symbol).sym === symFilter));
  const k = kpis(list);
  const groups = new Map();
  for (const t of list) {
    if (!groups.has(t.day)) groups.set(t.day, []);
    groups.get(t.day).push(t);
  }
  return `
  <header class="vhead"><div class="vhead-text"><div class="eyebrow">${acc ? esc(acc.name) : 'Trades'}</div><h1 class="vtitle">Dein <em>Logbuch</em></h1></div>
    <div class="head-actions">
      <button type="button" class="icon-btn" data-act="t-import" aria-label="Aus MT5-Screenshot übernehmen">${icon('camera')}</button>
      <button type="button" class="icon-btn accent" data-act="t-new" aria-label="Trade eintragen">${icon('plus')}</button>
    </div></header>
  ${
    !acc
      ? `<section class="card empty-card">${icon('wallet', 'lg')}<p>Lege zuerst dein Konto an, dann kannst du Trades eintragen.</p><button type="button" class="btn btn-primary" data-act="acc-new">Konto anlegen</button></section>`
      : !all.length
        ? `<section class="card empty-card">${icon('candles', 'lg')}<p>Noch keine Trades. Trag deinen ersten ein oder übernimm ihn aus einem Screenshot vom MT5-Verlauf.</p>
          <div class="row-2"><button type="button" class="btn btn-primary" data-act="t-new">${icon('plus')} Trade</button><button type="button" class="btn btn-soft" data-act="t-import">${icon('camera')} Screenshot</button></div></section>`
        : `${segHTML('t-filter', [
            ['all', 'Alle'],
            ['win', 'Gewinner'],
            ['loss', 'Verlierer'],
          ], filter)}
    ${syms.length > 1 ? `<div class="chips scroll-chips">${syms.map((s) => `<button type="button" class="chip ${symFilter === s ? 'on' : ''}" data-act="t-sym" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
    <div class="tsum"><span>${k.n} ${k.n === 1 ? 'Trade' : 'Trades'}</span><b class="${tone(k.net)}">${fmtMoney(k.net, acc.currency, { sign: true })}</b><span>${k.winRate != null ? `${fmtNum(k.winRate * 100, 0)}&nbsp;% Treffer` : ''}</span></div>
    ${
      list.length
        ? [...groups.entries()]
            .map(([day, ts]) => {
              const sum = ts.reduce((s, t) => s + t.pnl, 0);
              return `<section class="card tday"><div class="tday-h"><span>${esc(relDay(day) || fmtShort(day))}</span><b class="${tone(sum)}">${fmtMoney(sum, acc.currency, { sign: true })}</b></div>${ts.map((t) => tradeRow(t)).join('')}</section>`;
            })
            .join('')
        : '<p class="empty center">Keine Trades für diesen Filter.</p>'
    }`
  }`;
}
act('t-filter', (el) => {
  filter = el.dataset.v;
  haptic();
  app.refresh();
});
act('t-sym', (el) => {
  symFilter = symFilter === el.dataset.v ? null : el.dataset.v;
  haptic();
  app.refresh();
});

/* ---------- Trade eintragen / bearbeiten ---------- */
const TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
export function recentSymbols() {
  const seen = [];
  for (const t of [...S.trades.values()].sort((a, b) => b.closeAt - a.closeAt)) {
    const s = symInfo(t.symbol).sym;
    if (!seen.includes(s)) seen.push(s);
    if (seen.length >= 6) break;
  }
  return [...new Set([...seen, ...S.settings.symbols])].slice(0, 10);
}

// openId: Ergebnis zu einem offenen Trade aus dem Check eintragen
export function openTradeForm({ id = null, prefill = {}, onSaved = null, openId = null } = {}) {
  const orig = id ? S.trades.get(id) : null;
  // Beim Bearbeiten zählt das Konto des Trades, nicht das gerade aktive
  const acc = (orig && S.accounts.get(orig.accountId)) || activeAccount();
  if (!acc) {
    toast('Lege zuerst dein Konto an.');
    app.go('today');
    return;
  }
  const now = Date.now();
  const f = {
    symbol: '',
    side: 'long',
    lots: null,
    entry: null,
    sl: null,
    tp: null,
    exit: null,
    pnl: null,
    risk: null,
    openAt: null,
    closeAt: now,
    setup: null,
    tf: null,
    mistakes: [],
    checks: {},
    rulesOk: null,
    feelBefore: null,
    feelAfter: null,
    note: '',
    ...(orig || {}),
    ...prefill,
  };
  f.mistakes = [...(f.mistakes || [])];
  f.checks = { ...(f.checks || {}) };
  let pic = null; // neues Bild (Blob) oder 'remove'
  const rules = S.settings.rules;
  const sheet = openSheet({ title: orig ? 'Trade bearbeiten' : openId ? 'Ergebnis eintragen' : 'Neuer Trade', cls: 'tall', onClose: () => stopDictation() });
  const ccy = acc.currency;
  const field = (id2, label, v, ph = '', mode = 'decimal') =>
    `<label class="li" for="${id2}"><span class="li-title">${label}</span><input class="num-in wide" id="${id2}" type="text" inputmode="${mode}" autocomplete="off" placeholder="${ph}" value="${v ?? ''}"></label>`;
  sheet.body.innerHTML = `<div class="form tform">
    ${orig ? '' : `<button type="button" class="btn btn-soft btn-block" id="tf-import">${icon('camera')} Aus MT5-Screenshot ausfüllen</button>`}
    ${f.check ? `<div class="from-check"><i class="adot ${esc(f.check)}"></i><span>Ampel vor dem Einstieg: <b>${esc(CHECK[f.check] || '')}</b></span></div>` : ''}
    <div class="group-label">Symbol</div>
    <div class="chips" id="tf-syms">${recentSymbols().map((s) => `<button type="button" class="chip ${symInfo(f.symbol).sym === s ? 'on' : ''}" data-sym="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="group"><div class="li"><input class="li-input" id="tf-symbol" placeholder="oder eintippen, z. B. EURUSD" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="20" value="${esc(f.symbol)}"></div></div>
    ${segHTML('tf-side', [
      ['long', 'Long · Kauf'],
      ['short', 'Short · Verkauf'],
    ], f.side)}
    <div class="group-label">Ergebnis</div>
    <div class="res-row">
      ${segHTML('tf-sign', [
        ['+', 'Gewinn'],
        ['-', 'Verlust'],
      ], f.pnl != null && f.pnl < 0 ? '-' : '+', 'sm')}
      <div class="res-in"><input id="tf-pnl" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${f.pnl != null ? fmtNum(Math.abs(f.pnl), 2).replace(/\./g, '') : ''}"><span>${esc(ccy === 'USD' ? '$' : ccy)}</span></div>
    </div>
    <p class="note">Netto, also mit Kommission und Swap, so wie es bei MT5 im Verlauf steht.</p>
    <div class="group">
      ${field('tf-lots', 'Lots', f.lots ?? '', '0,50')}
      <label class="li" for="tf-open"><span class="li-title">Eröffnet</span><input type="datetime-local" id="tf-open" value="${f.openAt ? toLocalInput(f.openAt) : ''}"></label>
      <label class="li" for="tf-close"><span class="li-title">Geschlossen</span><input type="datetime-local" id="tf-close" value="${toLocalInput(f.closeAt || now)}"></label>
    </div>
    <div class="group-label">Preise <small>(optional, für R und Risiko)</small></div>
    <div class="group">
      ${field('tf-entry', 'Einstieg', f.entry ?? '')}
      ${field('tf-sl', 'Stop-Loss', f.sl ?? '')}
      ${field('tf-tp', 'Take-Profit', f.tp ?? '')}
      ${field('tf-exit', 'Ausstieg', f.exit ?? '')}
      ${field('tf-risk', `Risiko in ${esc(ccy === 'USD' ? '$' : ccy)}`, f.risk ?? '', 'falls kein SL')}
    </div>
    <div class="calc-line" id="tf-calc"></div>
    <div class="group-label">Setup</div>
    <div class="chips" id="tf-setups">${S.settings.setups.map((s) => `<button type="button" class="chip ${f.setup === s ? 'on' : ''}" data-setup="${esc(s)}">${esc(s)}</button>`).join('')}<button type="button" class="chip add" id="tf-setup-new">${icon('plus')} Neu</button></div>
    <div class="group-label">Zeiteinheit</div>
    <div class="chips tf-chips" id="tf-tfs">${TFS.map((x) => `<button type="button" class="chip ${f.tf === x ? 'on' : ''}" data-tf="${x}">${x}</button>`).join('')}</div>
    <div class="group-label">Regeln <button type="button" class="link small" id="tf-all-ok">Alle eingehalten</button></div>
    <div class="checklist" id="tf-rules">${rules
      .map(
        (r) =>
          `<button type="button" class="check-row ${f.checks[r.id] ? 'on' : ''}" data-rule="${esc(r.id)}" aria-pressed="${!!f.checks[r.id]}"><span class="cbox">${icon('check')}</span><span>${esc(r.text)}</span></button>`,
      )
      .join('')}</div>
    <div class="group-label">Fehler</div>
    <div class="chips" id="tf-mistakes">${S.settings.mistakes.map((m) => `<button type="button" class="chip bad ${f.mistakes.includes(m) ? 'on' : ''}" data-mis="${esc(m)}">${esc(m)}</button>`).join('')}</div>
    <div class="group-label">Wie ging es dir vor dem Trade?</div>
    <div id="tf-fb">${facesHTML('before', f.feelBefore)}</div>
    <div class="group-label">Und danach?</div>
    <div id="tf-fa">${facesHTML('after', f.feelAfter)}</div>
    <div class="group-label">Notiz</div>
    <div class="write card"><textarea class="jtext" id="tf-note" rows="3" placeholder="Warum bist du rein? Was hast du gesehen?">${esc(f.note)}</textarea>
      <button type="button" class="mic" id="tf-mic" aria-label="Diktieren" aria-pressed="false">${icon('mic')}</button></div>
    <div class="group-label">Chart-Screenshot</div>
    <div id="tf-pic"></div>
    <button type="button" class="btn btn-primary btn-lg btn-block" id="tf-save">${orig ? 'Speichern' : 'Trade speichern'}</button>
    ${orig ? '<button type="button" class="btn btn-danger btn-block" id="tf-del">Löschen</button>' : ''}
  </div>`;
  const q = (s) => sheet.body.querySelector(s);
  const ta = q('#tf-note');
  autosize(ta);
  ta.addEventListener('input', () => autosize(ta));
  q('#tf-mic').addEventListener('click', (e) => toggleDictation(e.currentTarget, ta, () => autosize(ta)));

  const read = () => {
    f.symbol = q('#tf-symbol').value.trim().toUpperCase();
    const v = amount(q('#tf-pnl').value);
    f.pnl = v == null ? null : (q('[data-act="tf-sign"].on')?.dataset.v === '-' ? -1 : 1) * Math.abs(v);
    f.lots = num(q('#tf-lots').value);
    f.entry = num(q('#tf-entry').value);
    f.sl = num(q('#tf-sl').value);
    f.tp = num(q('#tf-tp').value);
    f.exit = num(q('#tf-exit').value);
    f.risk = amount(q('#tf-risk').value);
    f.openAt = fromLocalInput(q('#tf-open').value);
    f.closeAt = fromLocalInput(q('#tf-close').value) || f.closeAt || Date.now();
    f.note = ta.value.trim();
  };
  const calc = () => {
    read();
    const t = { ...f, accountId: acc.id, pnl: f.pnl ?? 0 };
    const risk = riskOf(t, acc);
    const rr = rrOf(t);
    const parts = [];
    if (risk) parts.push(`Risiko <b>${fmtMoney(risk, ccy)}</b> (${fmtPct((risk / acc.size) * 100, 2)})`);
    if (risk && f.pnl != null) parts.push(`Ergebnis <b class="${tone(f.pnl)}">${fmtR(f.pnl / risk)}</b>`);
    if (rr) parts.push(`geplant 1 : ${fmtNum(rr, 1)}`);
    if (f.openAt) parts.push(`${sessionName(sessionOf(f.openAt))}`);
    const h = f.openAt && f.closeAt ? holdMin(f) : null;
    if (h != null) parts.push(`${fmtHold(h)} gehalten`);
    // Plausibilität: SL auf der falschen Seite?
    if (f.entry && f.sl && ((f.side === 'long' && f.sl > f.entry) || (f.side === 'short' && f.sl < f.entry))) parts.push('<span class="warn">SL liegt auf der falschen Seite</span>');
    q('#tf-calc').innerHTML = parts.join(' · ') || '<span class="faint">Mit Einstieg, SL und Lots rechnet Edge Risiko und R aus.</span>';
  };
  const paintPic = async () => {
    const box = q('#tf-pic');
    const has = pic instanceof Blob || (orig && S.pics.has(orig.id) && pic !== 'remove');
    const url = pic instanceof Blob ? URL.createObjectURL(pic) : has ? await picURL(orig.id) : null;
    box.innerHTML = has
      ? `<div class="pic-box"><img src="${url}" alt="Chart"><button type="button" class="icon-btn sm" id="tf-pic-x" aria-label="Bild entfernen">${icon('close')}</button></div>`
      : `<label class="btn btn-soft btn-block pic-add">${icon('image')} Screenshot hinzufügen<input type="file" accept="image/*" id="tf-pic-in" class="sr"></label>`;
    box.querySelector('#tf-pic-in')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        pic = await prepareChart(file);
        paintPic();
      } catch {
        toast('Das Bild ließ sich nicht öffnen.');
      }
    });
    box.querySelector('#tf-pic-x')?.addEventListener('click', () => {
      pic = 'remove';
      paintPic();
    });
  };
  paintPic();
  sheet.body.addEventListener('input', calc);
  sheet.body.addEventListener('change', calc);
  sheet.body.addEventListener('click', (e) => {
    const t = e.target;
    const seg = t.closest('.seg button');
    if (seg) {
      setSeg(seg);
      if (seg.dataset.act === 'tf-side') {
        f.side = seg.dataset.v;
        // Aus dem Lot-Rechner mit Pip-Abstand: der SL kennt die Richtung nicht, also beim Wechsel auf die andere Seite spiegeln
        const e = num(q('#tf-entry').value);
        const sl = num(q('#tf-sl').value);
        if (prefill.fromCalc && e && sl && ((f.side === 'short' && sl < e) || (f.side === 'long' && sl > e))) q('#tf-sl').value = String(+(2 * e - sl).toFixed(6));
      }
      haptic();
      calc();
      return;
    }
    const sym = t.closest('[data-sym]');
    if (sym) {
      q('#tf-symbol').value = sym.dataset.sym;
      sheet.body.querySelectorAll('[data-sym]').forEach((c) => c.classList.toggle('on', c === sym));
      haptic();
      calc();
      return;
    }
    const su = t.closest('[data-setup]');
    if (su) {
      f.setup = f.setup === su.dataset.setup ? null : su.dataset.setup;
      sheet.body.querySelectorAll('[data-setup]').forEach((c) => c.classList.toggle('on', c.dataset.setup === f.setup));
      haptic();
      return;
    }
    const tf = t.closest('[data-tf]');
    if (tf) {
      f.tf = f.tf === tf.dataset.tf ? null : tf.dataset.tf;
      sheet.body.querySelectorAll('[data-tf]').forEach((c) => c.classList.toggle('on', c.dataset.tf === f.tf));
      haptic();
      return;
    }
    const rule = t.closest('[data-rule]');
    if (rule) {
      f.checks[rule.dataset.rule] = !f.checks[rule.dataset.rule];
      rule.classList.toggle('on', f.checks[rule.dataset.rule]);
      rule.setAttribute('aria-pressed', f.checks[rule.dataset.rule]);
      f.touched = true;
      haptic();
      return;
    }
    const mis = t.closest('[data-mis]');
    if (mis) {
      const m = mis.dataset.mis;
      f.mistakes = f.mistakes.includes(m) ? f.mistakes.filter((x) => x !== m) : [...f.mistakes, m];
      mis.classList.toggle('on', f.mistakes.includes(m));
      haptic();
      return;
    }
    const fb = t.closest('[data-face]');
    if (fb) {
      const key = fb.dataset.face === 'before' ? 'feelBefore' : 'feelAfter';
      const v = Number(fb.dataset.v);
      f[key] = f[key] === v ? null : v;
      fb.parentElement.querySelectorAll('.face-b').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === f[key]));
      fb.parentElement.classList.toggle('sel', !!f[key]);
      haptic();
    }
  });
  q('#tf-all-ok').addEventListener('click', () => {
    rules.forEach((r) => (f.checks[r.id] = true));
    sheet.body.querySelectorAll('[data-rule]').forEach((b) => {
      b.classList.add('on');
      b.setAttribute('aria-pressed', 'true');
    });
    f.touched = true;
    haptic();
  });
  // Neues Setup direkt hier anlegen
  q('#tf-setup-new').addEventListener('click', (e) => {
    const chip = e.currentTarget;
    chip.outerHTML = `<span class="chip-new"><input class="field" id="tf-setup-in" maxlength="30" placeholder="Name des Setups" enterkeyhint="done"><button type="button" class="btn btn-soft btn-sm" id="tf-setup-ok">OK</button></span>`;
    const inp = q('#tf-setup-in');
    inp.focus();
    const add = async () => {
      const v = inp.value.trim().slice(0, 30);
      if (!v) return;
      if (!S.settings.setups.includes(v)) await saveSettings({ setups: [...S.settings.setups, v] });
      f.setup = v;
      q('#tf-setups').insertAdjacentHTML('afterbegin', `<button type="button" class="chip" data-setup="${esc(v)}">${esc(v)}</button>`);
      sheet.body.querySelectorAll('[data-setup]').forEach((c) => c.classList.toggle('on', c.dataset.setup === v));
      inp.closest('.chip-new').remove();
      haptic('success');
    };
    q('#tf-setup-ok').addEventListener('click', add);
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        add();
      }
    });
  });
  q('#tf-import')?.addEventListener('click', () => {
    sheet.close();
    openImport();
  });
  const shake = (sel, msg) => {
    const el = q(sel);
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    el.focus?.();
    haptic('error');
    toast(msg);
  };
  q('#tf-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    read();
    if (!f.symbol) return shake('#tf-symbol', 'Welches Symbol?');
    if (f.pnl == null) return shake('#tf-pnl', 'Wie viel hast du gewonnen oder verloren?');
    if (f.openAt && f.closeAt && f.openAt > f.closeAt) return shake('#tf-open', 'Eröffnet liegt nach Geschlossen.');
    btn.disabled = true;
    const answered = f.touched || Object.keys(f.checks).length > 0;
    const t = saveTrade({
      ...(orig || {}),
      accountId: orig?.accountId || acc.id,
      symbol: symInfo(f.symbol).sym || f.symbol,
      side: f.side,
      lots: f.lots,
      entry: f.entry,
      sl: f.sl,
      tp: f.tp,
      exit: f.exit,
      pnl: Math.round(f.pnl * 100) / 100,
      risk: f.risk,
      openAt: f.openAt,
      closeAt: f.closeAt,
      day: tradingDay(f.closeAt, acc.resetHour),
      setup: f.setup,
      tf: f.tf,
      mistakes: f.mistakes,
      checks: f.checks,
      rulesOk: answered ? rules.every((r) => f.checks[r.id]) : null,
      feelBefore: f.feelBefore,
      feelAfter: f.feelAfter,
      note: f.note,
      check: f.check || null,
      source: orig?.source || prefill.source || 'hand',
    });
    if (openId) await removeOpen(openId);
    if (pic instanceof Blob) await savePic(t.id, pic);
    else if (pic === 'remove' && S.pics.has(t.id)) await deletePic(t.id);
    sheet.close();
    haptic('success');
    app.refresh();
    onSaved?.(t);
    if (!orig) afterTrade(t);
    else toast('Gespeichert', { icon: icon('check') });
  });
  q('#tf-del')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Trade löschen?', text: `${symInfo(orig.symbol).sym}, ${fmtMoney(orig.pnl, ccy, { sign: true })}`, ok: 'Löschen', danger: true });
    if (!ok) return;
    await deleteTrade(orig.id);
    sheet.close();
    app.refresh();
    toast('Trade gelöscht');
  });
  calc();
  if (!orig) setTimeout(() => !f.symbol && q('#tf-symbol')?.focus?.(), 450);
}
act('t-new', () => openTradeForm());

// Nach einem neuen Trade: Regeln der Challenge und eigene Grenzen prüfen
async function afterTrade(t) {
  const acc = S.accounts.get(t.accountId);
  const st = accountState(acc);
  const g = guard(st);
  const p = personal(st);
  const money = (v) => fmtMoney(v, acc.currency);
  if (st.breach && st.breach.at === t.closeAt) {
    await confirmDialog({
      title: st.breach.kind === 'daily' ? 'Tagesverlust-Limit erreicht' : 'Gesamtverlust-Limit erreicht',
      text: 'Nach den eingetragenen Trades ist eine Regel deiner Challenge verletzt. Prüf dein Konto bei der Firma.',
      ok: 'Verstanden',
      cancel: '',
    });
    return;
  }
  if (p.overLosses) {
    await confirmDialog({
      title: p.lossStreak === 1 ? 'Ein Verlust' : `${p.lossStreak} Verluste in Folge`,
      text: `Deine Regel: nach ${p.stopAfter === 1 ? 'einem Verlust' : `${p.stopAfter} Verlusten`} für heute Schluss. Morgen ist ein neuer Tag.`,
      ok: 'Okay, Pause',
      cancel: '',
    });
    return;
  }
  if (p.overTrades && p.count === p.maxTrades) {
    toast(`Das war Trade ${p.count} von ${p.maxTrades} für heute.`, { icon: icon('pause'), ms: 4500 });
    return;
  }
  if (g.daily === 'warn') {
    toast(`Achtung: noch ${money(st.dailyLeft)} bis zum Tageslimit.`, { icon: icon('alert'), ms: 5000 });
    return;
  }
  const r = rOf(t);
  toast(`${symInfo(t.symbol).sym} gespeichert · ${fmtMoney(t.pnl, acc.currency, { sign: true })}${r != null ? ` (${fmtR(r)})` : ''}`, { icon: icon('check') });
}

/* ---------- Details ---------- */
export async function openTrade(id) {
  const t = S.trades.get(id);
  if (!t) return;
  const acc = S.accounts.get(t.accountId);
  const ccy = acc?.currency || 'USD';
  const info = symInfo(t.symbol);
  const risk = riskOf(t, acc);
  const r = risk ? t.pnl / risk : null;
  const rr = rrOf(t);
  const h = holdMin(t);
  const rules = S.settings.rules;
  const row = (k, v) => (v == null || v === '' ? '' : `<div class="kv"><span>${k}</span><b>${v}</b></div>`);
  const price = (v) => (v ? fmtNum(v, info.kind === 'fx' ? (info.quote === 'JPY' ? 3 : 5) : 2) : null);
  const sheet = openSheet({
    title: `${info.sym} ${t.side === 'short' ? 'Short' : 'Long'}`,
    cls: 'tall',
    body: `<div class="tdetail">
      <div class="td-head"><span class="tside big ${t.side === 'short' ? 'short' : 'long'}">${icon(t.side === 'short' ? 'down' : 'up')}</span>
        <div><div class="td-res ${tone(t.pnl)}">${fmtMoney(t.pnl, ccy, { sign: true, dec: 2 })}</div><div class="faint">${r != null ? `${fmtR(r)} · ` : ''}${esc(fmtShort(t.day))}${t.openAt ? `, ${hm(t.openAt)}–${hm(t.closeAt)}` : `, ${hm(t.closeAt)}`}</div></div></div>
      <div id="td-pic"></div>
      <div class="kvs">
        ${row('Lots', t.lots ? fmtNum(t.lots, 2) : null)}
        ${row('Einstieg → Ausstieg', t.entry ? `${price(t.entry)} → ${price(t.exit) || '–'}` : null)}
        ${row('Stop-Loss / Take-Profit', t.sl || t.tp ? `${price(t.sl) || '–'} / ${price(t.tp) || '–'}` : null)}
        ${row('Risiko', risk ? `${fmtMoney(risk, ccy)} (${fmtPct((risk / acc.size) * 100, 2)})` : null)}
        ${row('Geplantes CRV', rr ? `1 : ${fmtNum(rr, 1)}` : null)}
        ${row('Session', t.openAt ? sessionName(sessionOf(t.openAt)) : null)}
        ${row('Haltedauer', h != null ? fmtHold(h) : null)}
        ${row('Setup', t.setup ? esc(t.setup) : null)}
        ${row('Zeiteinheit', t.tf)}
        ${row('Ampel vorher', t.check ? `<i class="adot ${esc(t.check)}"></i> ${esc(CHECK[t.check] || '')}` : null)}
        ${row('Gefühl vorher / nachher', t.feelBefore || t.feelAfter ? `${t.feelBefore ? FEEL[t.feelBefore - 1] : '–'} / ${t.feelAfter ? FEEL[t.feelAfter - 1] : '–'}` : null)}
      </div>
      ${
        t.rulesOk != null
          ? `<div class="sub-h">Regeln</div><div class="rule-list">${rules.map((ru) => `<div class="rl ${t.checks?.[ru.id] ? 'ok' : 'no'}">${icon(t.checks?.[ru.id] ? 'check' : 'close')}<span>${esc(ru.text)}</span></div>`).join('')}</div>`
          : ''
      }
      ${t.mistakes?.length ? `<div class="sub-h">Fehler</div><div class="chips">${t.mistakes.map((m) => `<span class="chip bad on">${esc(m)}</span>`).join('')}</div>` : ''}
      ${t.note ? `<div class="sub-h">Notiz</div><p class="td-note">${esc(t.note)}</p>` : ''}
      <button type="button" class="btn btn-primary btn-block" id="td-edit">${icon('edit')} Bearbeiten</button>
    </div>`,
  });
  if (S.pics.has(t.id)) {
    const url = await picURL(t.id);
    if (url) {
      sheet.body.querySelector('#td-pic').innerHTML = `<button type="button" class="pic-box" id="td-pic-b"><img src="${url}" alt="Chart"></button>`;
      sheet.body.querySelector('#td-pic-b').addEventListener('click', () => viewer(url, info.sym));
    }
  }
  sheet.body.querySelector('#td-edit').addEventListener('click', () => {
    sheet.close();
    setTimeout(() => openTradeForm({ id }), 200);
  });
}
act('t-open', (el) => openTrade(el.dataset.id));

export function viewer(url, caption) {
  const el = document.createElement('div');
  el.className = 'viewer';
  el.innerHTML = `<div class="cap">${esc(caption)}</div><button type="button" class="icon-btn" aria-label="Schließen">${icon('close')}</button><img src="${url}" alt="">`;
  el.addEventListener('click', () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  });
  document.body.appendChild(el);
}

/* ---------- Import aus MT5-Screenshot ---------- */
const OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
export function openImport() {
  const acc = activeAccount();
  if (!acc) {
    toast('Lege zuerst dein Konto an.');
    return;
  }
  if (!S.settings.geminiKey || IS_PREVIEW) {
    openKeySheet(() => openImport());
    return;
  }
  const sheet = openSheet({ title: 'Aus MT5 übernehmen', cls: 'tall' });
  let ctrl = null;
  sheet.onClose = () => ctrl?.abort();
  sheet.body.innerHTML = `<div class="form">
    <div class="howto"><b>So geht's</b><ol class="steps sm">
      <li><span>Öffne die <b>MT5-App</b> und tippe unten auf <b>Verlauf</b>.</span></li>
      <li><span>Oben <b>Positionen</b> wählen und den Zeitraum einstellen.</span></li>
      <li><span>Screenshot machen (Seitentaste + Lauter) und hier auswählen.</span></li>
    </ol></div>
    <label class="btn btn-primary btn-lg btn-block">${icon('image')} Screenshot auswählen<input type="file" accept="image/*" id="im-file" class="sr"></label>
    <p class="note center">Gemini liest Symbol, Richtung, Lots, Preise, Zeiten und Gewinn aus. Du prüfst alles, bevor es gespeichert wird.</p>
  </div>`;
  sheet.body.querySelector('#im-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sheet.body.innerHTML = '<div class="est"><div class="est-pic est-pic-wait scanning"><i class="scan"></i></div><div class="est-wait"><span class="spinner sm"></span> Gemini liest den Verlauf …</div></div>';
    ctrl = new AbortController();
    try {
      const img = await prepareForAI(file);
      if (sheet.closed) return;
      const res = await extractTrades({ image: img.b64, signal: ctrl.signal });
      if (sheet.closed) return;
      if (!res.trades.length) {
        failed(res.hint || 'Auf dem Bild waren keine abgeschlossenen Trades zu erkennen.');
        return;
      }
      review(res);
    } catch (err) {
      if (sheet.closed) return;
      console.warn(err);
      failed(err?.message?.includes('Bild') ? 'Das Bild ließ sich nicht öffnen.' : errorText(err));
    }
  });
  const failed = (msg) => {
    sheet.body.innerHTML = `<div class="est"><div class="est-error">${icon('info')}<p>${esc(msg)}</p></div>
      <button type="button" class="btn btn-primary btn-block" id="im-again">Anderen Screenshot wählen</button>
      <button type="button" class="btn btn-ghost btn-block" id="im-hand">${icon('edit')} Von Hand eintragen</button></div>`;
    sheet.body.querySelector('#im-again').addEventListener('click', () => {
      sheet.close();
      setTimeout(openImport, 200);
    });
    sheet.body.querySelector('#im-hand').addEventListener('click', () => {
      sheet.close();
      setTimeout(() => openTradeForm(), 200);
    });
  };
  const review = (res) => {
    let off = S.settings.serverOffset ?? 1;
    const pick = res.trades.map(() => true);
    const at = (p) => (p ? new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s).getTime() - off * 3600e3 : null);
    const dupes = () =>
      res.trades.map((x) => {
        const c = at(x.close);
        const net = Math.round((x.profit + x.fees) * 100) / 100;
        return accountTrades(acc.id).some((t) => symInfo(t.symbol).sym === symInfo(x.symbol).sym && Math.abs((t.lots || 0) - x.lots) < 1e-6 && Math.abs(t.pnl - net) < 0.02 && (!c || Math.abs(t.closeAt - c) < 5 * 60e3));
      });
    let dup = dupes();
    dup.forEach((d, i) => (pick[i] = !d));
    // Passt ein importierter Trade zu einem offenen aus dem Check? Dann wandern Ampel, Setup und Regeln mit.
    const matchOpen = (x, used) =>
      S.open.find((o) => {
        if (used.has(o.id) || o.accountId !== acc.id || o.symbol !== symInfo(x.symbol).sym || o.side !== x.side || Math.abs((o.lots || 0) - x.lots) > 0.005) return false;
        const op = at(x.open);
        const cl = at(x.close);
        return op ? Math.abs(op - o.openAt) < 3 * 3600e3 : !cl || (o.openAt <= cl && cl - o.openAt < 3 * 864e5);
      });
    const links = () => {
      const used = new Set();
      return res.trades.map((x, i) => {
        if (dup[i]) return null;
        const o = matchOpen(x, used);
        if (o) used.add(o.id);
        return o || null;
      });
    };
    let linked = links();
    const paint = () => {
      const n = pick.filter(Boolean).length;
      sheet.body.innerHTML = `<div class="form">
        <p class="muted">${res.trades.length === 1 ? 'Ein Trade gefunden.' : `${res.trades.length} Trades gefunden.`} Tippe an, was übernommen werden soll.</p>
        <div class="im-list">${res.trades
          .map((x, i) => {
            const net = x.profit + x.fees;
            const c = at(x.close);
            return `<button type="button" class="im-row ${pick[i] ? 'on' : ''}" data-i="${i}"><span class="cbox">${icon('check')}</span>
              <span class="tmain"><span class="tsym">${esc(symInfo(x.symbol).sym)} <small class="${x.side === 'short' ? 'loss' : 'win'}">${x.side === 'short' ? 'Short' : 'Long'}</small></span>
              <span class="tsub">${fmtNum(x.lots, 2)} Lot${x.entry ? ` · ${fmtNum(x.entry, 5).replace(/0+$/, '')} → ${x.exit ? fmtNum(x.exit, 5).replace(/0+$/, '') : '–'}` : ''}${c ? ` · ${esc(fmtShort(iso(new Date(c))))} ${hm(c)}` : ''}${dup[i] ? ' · <b>schon eingetragen</b>' : linked[i] ? ' · <b>mit deinem Check</b>' : ''}</span></span>
              <span class="tres ${tone(net)}"><b>${fmtMoney(net, acc.currency, { sign: true, dec: 2 })}</b></span></button>`;
          })
          .join('')}</div>
        ${res.hint ? `<p class="note">${icon('info', 'inline-ic')} ${esc(res.hint)}</p>` : ''}
        <div class="group"><div class="li"><span class="li-main"><span class="li-title">MT5-Serverzeit</span><span class="li-sub">so viele Stunden geht der Server deiner Uhr voraus</span></span>
          <div class="stepper"><button type="button" data-off="-1" aria-label="Weniger">${icon('minus')}</button><output>${off > 0 ? '+' : ''}${off} h</output><button type="button" data-off="1" aria-label="Mehr">${icon('plus')}</button></div></div></div>
        <button type="button" class="btn btn-primary btn-lg btn-block" id="im-save" ${n ? '' : 'disabled'}>${n === 1 ? '1 Trade übernehmen' : `${n} Trades übernehmen`}</button>
      </div>`;
    };
    paint();
    sheet.body.addEventListener('click', async (e) => {
      const row = e.target.closest('[data-i]');
      if (row) {
        const i = Number(row.dataset.i);
        pick[i] = !pick[i];
        haptic();
        paint();
        return;
      }
      const o = e.target.closest('[data-off]');
      if (o) {
        off = clamp(off + Number(o.dataset.off), OFFSETS[0], OFFSETS[OFFSETS.length - 1]);
        dup = dupes();
        linked = links();
        haptic();
        paint();
        return;
      }
      if (e.target.closest('#im-save')) {
        const btn = e.target.closest('#im-save');
        if (btn.disabled) return;
        btn.disabled = true;
        await saveSettings({ serverOffset: off });
        let n = 0;
        let last = null;
        let merged = 0;
        for (const [i, x] of res.trades.entries()) {
          if (!pick[i]) continue;
          const closeAt = at(x.close) || Date.now();
          const o = linked[i];
          last = saveTrade({
            id: uid(),
            accountId: acc.id,
            symbol: symInfo(x.symbol).sym,
            side: x.side,
            lots: x.lots,
            entry: x.entry || o?.entry || null,
            exit: x.exit,
            sl: x.sl || o?.sl || null,
            tp: x.tp || o?.tp || null,
            pnl: Math.round((x.profit + x.fees) * 100) / 100,
            openAt: at(x.open) || o?.openAt || null,
            closeAt,
            day: tradingDay(closeAt, acc.resetHour),
            setup: o?.setup || null,
            feelBefore: o?.feelBefore || null,
            mistakes: [],
            checks: o?.checks || {},
            rulesOk: o ? o.rulesOk : null,
            check: o?.check || null,
            source: 'mt5',
          });
          if (o) {
            await removeOpen(o.id);
            merged++;
          }
          n++;
        }
        sheet.close();
        haptic('success');
        app.refresh();
        const tail = merged === n ? 'Ampel und Regeln aus deinem Check sind dabei.' : 'Ergänz noch Setup und Gefühl.';
        toast(n === 1 ? `Trade übernommen. ${tail}` : `${n} Trades übernommen. ${tail}`, {
          icon: icon('check'),
          ms: 5000,
          action: n === 1 ? 'Ergänzen' : undefined,
          onAction: () => last && openTradeForm({ id: last.id }),
        });
      }
    });
  };
}
act('t-import', () => openImport());

/* ---------- Gemini-Schlüssel ---------- */
export function openKeySheet(then = null) {
  if (IS_PREVIEW) {
    toast('Das Auslesen von Screenshots geht erst in der installierten App.', { ms: 3600 });
    return;
  }
  const st = S.settings;
  const sheet = openSheet({
    title: 'Screenshots auslesen',
    body: `<div class="form">
      <p class="muted">Edge schickt deinen MT5-Screenshot an Gemini von Google und bekommt die Trades als Daten zurück. Dafür brauchst du einmal einen kostenlosen Schlüssel. Hast du schon einen für Luna, kannst du denselben nehmen.</p>
      <ol class="steps">
        <li><span>Öffne <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"><b>aistudio.google.com/apikey</b></a> und melde dich mit deinem Google-Konto an.</span></li>
        <li><span>Tippe auf <b>„Create API key“</b>.</span></li>
        <li><span>Kopiere den Schlüssel und füg ihn hier ein.</span></li>
      </ol>
      <div class="group"><input class="li-input" id="gk-key" placeholder="Schlüssel einfügen (beginnt mit AIza…)" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(st.geminiKey)}"></div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="gk-save">${st.geminiKey ? 'Schlüssel prüfen' : 'Verbinden'}</button>
      <p class="note" id="gk-status">${st.geminiModel ? `Verbunden mit ${esc(st.geminiModel)}.` : 'Der Schlüssel bleibt nur auf diesem iPhone und landet nicht im Backup.'}</p>
      ${st.geminiKey ? '<button type="button" class="btn btn-danger btn-block" id="gk-remove">Schlüssel entfernen</button>' : ''}
    </div>`,
  });
  const q = (s) => sheet.body.querySelector(s);
  q('#gk-save').addEventListener('click', async () => {
    const key = q('#gk-key').value.trim();
    const status = q('#gk-status');
    if (key.length < 20) {
      status.textContent = 'Der Schlüssel sieht zu kurz aus. Kopier ihn bitte komplett.';
      haptic('error');
      return;
    }
    const btn = q('#gk-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner sm"></span> Prüfe …';
    try {
      const model = await connect(key);
      status.textContent = `Verbunden mit ${model}.`;
      haptic('success');
      toast('Screenshot-Import ist bereit', { icon: icon('check') });
      setTimeout(() => {
        sheet.close();
        app.refresh();
        then?.();
      }, 600);
    } catch (e) {
      status.textContent = errorText(e);
      haptic('error');
      btn.disabled = false;
      btn.textContent = 'Nochmal prüfen';
    }
  });
  q('#gk-remove')?.addEventListener('click', async () => {
    await saveSettings({ geminiKey: '', geminiModel: '' });
    sheet.close();
    app.refresh();
    toast('Schlüssel entfernt');
  });
}
export const fmtDay = (d) => relDay(d) || fmtShort(d);
