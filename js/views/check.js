// Edge · Vor dem Trade: Lotgröße und Ampel aus deinen Regeln, den Limits, dem Marktplan und deiner Statistik.
// Ist der Trade raus, merkt Edge ihn sich als offen; das Ergebnis kommt später dazu.
import { S, activeAccount, saveOpen, removeOpen, openOf } from '../store.js';
import { tradeCheck, symInfo, fmtMoney, CHECK, accountState } from '../edge.js';
import { icon, openSheet, confirmDialog, segHTML, setSeg, facesHTML } from '../ui.js';
import { esc, fmtNum, fmtShort, iso, num, amount, haptic, toast, today, hm } from '../util.js';
import { act, app } from '../app.js';
import { openTradeForm, recentSymbols } from './trades.js';

const LEVEL = {
  green: ['Grün · Passt', 'Alles nach deinen Regeln'],
  yellow: ['Gelb · Mit Vorsicht', ''],
  red: ['Rot · Lieber nicht', ''],
  open: ['Noch nicht fertig', ''],
};
const ORDER = { red: 0, yellow: 1, info: 2, good: 3 };

// Beispielpreis passend zum Symbol: letzter eigener Einstieg, sonst ein typischer Kurs
function example(info) {
  const last = [...S.trades.values()].filter((t) => t.entry && symInfo(t.symbol).sym === info.sym).sort((a, b) => b.closeAt - a.closeAt)[0]?.entry;
  const ex = last || { USDJPY: 151.6, GBPJPY: 196.4, EURJPY: 164.2, XAUUSD: 2650, XAGUSD: 31.2, NAS100: 20500, US100: 20500, US30: 42800, GER40: 19400, DE40: 19400, BTCUSD: 65000 }[info.sym] || (info.kind === 'fx' ? (info.quote === 'JPY' ? 150 : 1.085) : 1000);
  const dec = info.pip >= 1 ? 0 : Math.round(-Math.log10(info.pip)) + 1;
  return { ex, dec };
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function openCheck() {
  const acc = activeAccount();
  if (!acc) {
    toast('Lege zuerst dein Konto an.');
    return;
  }
  const ccy = acc.currency;
  const st0 = accountState(acc);
  const c = { symbol: recentSymbols()[0] || 'EURUSD', side: 'long', mode: 'price', risk: S.settings.risk || 1, balance: Math.round(st0.bal), setup: null, feel: null, answers: {} };
  let last = null;
  const sheet = openSheet({ title: 'Vor dem Trade', cls: 'tall' });
  sheet.body.innerHTML = `<div class="form chk">
    <div class="chk-bar open" id="ck-bar" role="status" aria-live="polite"><i class="adot"></i><div class="chk-v"><b id="ck-verdict">Noch nicht fertig</b><span id="ck-sub"></span></div><div class="chk-lots"><b id="ck-lots">–</b><small>Lot</small></div></div>
    <div class="group-label">Symbol</div>
    <div class="chips" id="ck-syms">${recentSymbols().map((s) => `<button type="button" class="chip ${c.symbol === s ? 'on' : ''}" data-sym="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="group"><div class="li"><input class="li-input" id="ck-symbol" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="20" value="${esc(c.symbol)}" aria-label="Symbol"></div></div>
    ${segHTML('ck-side', [
      ['long', 'Long · Kauf'],
      ['short', 'Short · Verkauf'],
    ], c.side)}
    <div class="group-label">Einstieg und Stop</div>
    ${segHTML('ck-mode', [
      ['price', 'Mit Preisen'],
      ['pips', 'Abstand in Pips/Punkten'],
    ], c.mode, 'sm')}
    <div class="group">
      <label class="li" for="ck-entry"><span class="li-title">Einstieg</span><input class="num-in wide" id="ck-entry" type="text" inputmode="decimal" autocomplete="off"></label>
      <label class="li lc-price" for="ck-sl"><span class="li-title">Stop-Loss</span><input class="num-in wide" id="ck-sl" type="text" inputmode="decimal" autocomplete="off"></label>
      <label class="li lc-pips" for="ck-pips"><span class="li-title" id="ck-pips-l">Abstand</span><input class="num-in wide" id="ck-pips" type="text" inputmode="decimal" autocomplete="off" placeholder="z. B. 20"></label>
      <label class="li" for="ck-tp"><span class="li-title">Ziel <small class="faint">(optional)</small></span><input class="num-in wide" id="ck-tp" type="text" inputmode="decimal" autocomplete="off"></label>
    </div>
    <div class="group-label">Risiko</div>
    <div class="chips" id="ck-risks">${[0.25, 0.5, 1, 1.5, 2].map((v) => `<button type="button" class="chip ${c.risk === v ? 'on' : ''}" data-r="${v}">${fmtNum(v, v % 1 ? 2 : 0).replace(/0$/, '')} %</button>`).join('')}</div>
    <div class="group">
      <label class="li" for="ck-risk"><span class="li-title">Eigener Wert</span><span class="unit-in"><input class="num-in" id="ck-risk" type="text" inputmode="decimal" value="${String(c.risk).replace('.', ',')}"><small>%</small></span></label>
      <label class="li" for="ck-bal"><span class="li-title">Kontostand</span><span class="unit-in"><input class="num-in wide" id="ck-bal" type="text" inputmode="decimal" value="${c.balance}"><small>${esc(ccy)}</small></span></label>
    </div>
    <div class="calc-out" id="ck-out"></div>
    <div class="group-label">Setup <small>(optional)</small></div>
    <div class="chips" id="ck-setups">${S.settings.setups.map((s) => `<button type="button" class="chip" data-setup="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="group-label">Wie fühlst du dich gerade?</div>
    <div id="ck-feel">${facesHTML('ck', null)}</div>
    <div class="group-label">Deine Regeln</div>
    <div class="ck-rules" id="ck-rules"></div>
    <div class="group-label">Was Edge sieht</div>
    <div class="ck-res" id="ck-res"></div>
    <div class="chk-actions">
      <button type="button" class="btn btn-primary btn-lg btn-block" id="ck-go">Trade ist raus · merken</button>
      <button type="button" class="btn btn-ghost btn-block" id="ck-skip">Lass ich</button>
    </div>
    <p class="note" id="ck-note"></p>
  </div>`;
  const q = (s) => sheet.body.querySelector(s);

  const read = () => {
    c.symbol = q('#ck-symbol').value.trim().toUpperCase();
    c.entry = num(q('#ck-entry').value);
    c.tp = num(q('#ck-tp').value);
    c.risk = num(q('#ck-risk').value) || 0;
    c.balance = amount(q('#ck-bal').value) || 0;
    const info = symInfo(c.symbol || 'EURUSD');
    if (c.mode === 'pips') {
      const p = num(q('#ck-pips').value);
      // Mit bekannter Richtung liegt der Stop beim Long darunter, beim Short darüber
      c.sl = c.entry && p ? +(c.entry + (c.side === 'short' ? 1 : -1) * p * info.pip).toFixed(8) : null;
    } else c.sl = num(q('#ck-sl').value);
    return info;
  };

  const ruleHint = (r, info) => {
    if (r.auto) return 'prüft Edge selbst';
    const plan = S.days.get(today());
    if (r.id === 'plan') {
      const b = plan?.bias?.[info.sym];
      return b === 'bull' ? `Plan heute: ${info.sym} Long` : b === 'bear' ? `Plan heute: ${info.sym} Short` : plan?.plan ? `Plan: ${plan.plan.slice(0, 60)}${plan.plan.length > 60 ? '…' : ''}` : '';
    }
    if (r.id === 'news') return plan?.news ? `Heute: ${plan.news.slice(0, 60)}${plan.news.length > 60 ? '…' : ''}` : '';
    return '';
  };

  const paint = () => {
    const info = read();
    const { ex, dec } = example(info);
    q('#ck-entry').placeholder = `z. B. ${fmtNum(ex, dec)}`;
    q('#ck-sl').placeholder = `z. B. ${fmtNum(ex + (c.side === 'short' ? 20 : -20) * info.pip, dec)}`;
    q('#ck-tp').placeholder = `z. B. ${fmtNum(ex + (c.side === 'short' ? -40 : 40) * info.pip, dec)}`;
    q('#ck-pips-l').textContent = `Abstand in ${info.unit}`;
    q('.form').classList.toggle('pips-mode', c.mode === 'pips');
    const r = tradeCheck({ acc, x: { symbol: c.symbol, side: c.side, entry: c.entry, sl: c.sl, tp: c.tp, riskPct: c.risk, balance: c.balance, setup: c.setup, feel: c.feel }, answers: c.answers, open: S.open, plan: S.days.get(today()) || null });
    last = r;

    // Leiste oben
    const bar = q('#ck-bar');
    if (bar.dataset.lv && bar.dataset.lv !== r.level && r.level === 'red') haptic('error');
    bar.dataset.lv = r.level;
    bar.className = `chk-bar ${r.level}`;
    const nRed = r.reasons.filter((x) => x.lv === 'red').length;
    const nYellow = r.reasons.filter((x) => x.lv === 'yellow').length;
    q('#ck-verdict').textContent = LEVEL[r.level][0];
    q('#ck-sub').textContent =
      r.level === 'red'
        ? `${plural(nRed, 'Grund', 'Gründe')} dagegen`
        : r.level === 'open'
          ? r.needs.length
            ? `${r.needs.join(' und ')} ${r.needs.length === 1 ? 'fehlt' : 'fehlen'} noch`
            : `${plural(r.missing, 'Regel', 'Regeln')} noch offen`
          : r.level === 'yellow'
            ? `${plural(nYellow, 'Warnzeichen', 'Warnzeichen')}`
            : LEVEL.green[1];
    q('#ck-lots').textContent = r.lots ? fmtNum(r.lots, 2) : '–';

    // Lot-Details
    q('#ck-out').innerHTML = r.lots
      ? `<div class="lc-big"><span>Lotgröße</span><b>${fmtNum(r.lots, 2)}</b></div>
        <div class="lc-meta"><span>Risiko <b>${fmtMoney(r.risk, ccy)}</b> (${fmtNum(r.riskPct, 2)}&nbsp;%)</span>${r.res?.pips ? `<span>${fmtNum(r.res.pips, 1)} ${info.unit}</span>` : ''}${r.rr ? `<span>Chance-Risiko <b>1&nbsp;:&nbsp;${fmtNum(r.rr, 1)}</b></span>` : ''}${r.res?.valuePerPip ? `<span>${fmtMoney(r.res.valuePerPip, ccy, { dec: 2 })} pro ${info.unit === 'Pips' ? 'Pip' : 'Punkt'} und Lot</span>` : ''}</div>`
      : `<div class="lc-big"><span>Lotgröße</span><em>${c.mode === 'pips' ? 'Einstieg und Abstand eintragen' : 'Einstieg und Stop-Loss eintragen'}</em></div>
        <div class="lc-meta"><span>Risiko <b>${fmtMoney((c.balance * c.risk) / 100, ccy)}</b></span></div>`;
    const conv = info.quote !== ccy && !(info.kind === 'fx' && info.base === ccy);
    q('#ck-note').innerHTML = r.res?.noRate
      ? 'Für diese Währung fehlt ein Umrechnungskurs. Trag ihn in den Einstellungen ein.'
      : `${info.kind === 'index' || info.kind === 'crypto' ? `Kontraktgröße ${fmtNum(info.contract, 0)} pro Lot, bei deinem Broker kann sie anders sein (Einstellungen → Symbole). ` : ''}${conv ? `Umrechnung ${info.quote} → ${ccy} mit ungefährem Kurs. ` : ''}Lots sind abgerundet, damit das Risiko nicht größer wird.`;

    // Regeln
    q('#ck-rules').innerHTML = r.rules
      .map((ru) => {
        const hint = ruleHint(ru, info);
        return `<div class="ck-rule ${ru.val === true ? 'yes' : ru.val === false ? 'no' : ''} ${ru.auto ? 'auto' : ''}">
        <span class="ck-rt">${esc(ru.text)}${hint ? `<small>${esc(hint)}</small>` : ''}</span>
        <span class="ck-yn"><button type="button" data-rid="${esc(ru.id)}" data-yn="1" aria-label="Erfüllt" aria-pressed="${ru.val === true}" ${ru.auto ? 'disabled' : ''}>${icon('check')}</button><button type="button" data-rid="${esc(ru.id)}" data-yn="0" aria-label="Nicht erfüllt" aria-pressed="${ru.val === false}" ${ru.auto ? 'disabled' : ''}>${icon('close')}</button></span>
      </div>`;
      })
      .join('') || '<p class="empty">Keine Regeln angelegt. Das geht in den Einstellungen.</p>';

    // Was Edge sieht
    const list = [...r.reasons].sort((a, b) => ORDER[a.lv] - ORDER[b.lv]);
    q('#ck-res').innerHTML = list.length
      ? list.map((x) => `<div class="ck-why ${x.lv}"><span class="ck-ic">${icon(x.ic || 'info')}</span><p>${esc(x.text)}</p></div>`).join('')
      : `<p class="empty">${r.level === 'green' ? 'Keine Warnzeichen. Viel Erfolg!' : 'Noch nichts Auffälliges.'}</p>`;

    // Knöpfe: bei Rot ist „Lass ich“ der Hauptknopf
    const go = q('#ck-go');
    const skip = q('#ck-skip');
    go.disabled = !r.lots;
    go.className = `btn btn-lg btn-block ${r.level === 'red' ? 'btn-soft danger-soft' : 'btn-primary'}`;
    go.textContent = r.level === 'red' ? 'Trotzdem rein · merken' : 'Trade ist raus · merken';
    skip.className = `btn btn-block ${r.level === 'red' ? 'btn-primary btn-lg' : 'btn-ghost'}`;
  };

  sheet.body.addEventListener('input', paint);
  sheet.body.addEventListener('click', (e) => {
    const t = e.target;
    const seg = t.closest('.seg button');
    if (seg) {
      setSeg(seg);
      if (seg.dataset.act === 'ck-side') c.side = seg.dataset.v;
      if (seg.dataset.act === 'ck-mode') c.mode = seg.dataset.v;
      haptic();
      paint();
      return;
    }
    const sym = t.closest('[data-sym]');
    if (sym) {
      q('#ck-symbol').value = sym.dataset.sym;
      sheet.body.querySelectorAll('[data-sym]').forEach((b) => b.classList.toggle('on', b === sym));
      haptic();
      paint();
      return;
    }
    const rk = t.closest('[data-r]');
    if (rk) {
      q('#ck-risk').value = rk.dataset.r.replace('.', ',');
      sheet.body.querySelectorAll('[data-r]').forEach((b) => b.classList.toggle('on', b === rk));
      haptic();
      paint();
      return;
    }
    const su = t.closest('[data-setup]');
    if (su) {
      c.setup = c.setup === su.dataset.setup ? null : su.dataset.setup;
      sheet.body.querySelectorAll('[data-setup]').forEach((b) => b.classList.toggle('on', b.dataset.setup === c.setup));
      haptic();
      paint();
      return;
    }
    const yn = t.closest('[data-yn]');
    if (yn && !yn.disabled) {
      const v = yn.dataset.yn === '1';
      c.answers[yn.dataset.rid] = c.answers[yn.dataset.rid] === v ? null : v;
      haptic();
      paint();
      return;
    }
    const face = t.closest('[data-face="ck"]');
    if (face) {
      const v = Number(face.dataset.v);
      c.feel = c.feel === v ? null : v;
      face.parentElement.querySelectorAll('.face-b').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === c.feel));
      face.parentElement.classList.toggle('sel', !!c.feel);
      haptic();
      paint();
    }
  });
  q('#ck-risk').addEventListener('input', () => sheet.body.querySelectorAll('[data-r]').forEach((b) => b.classList.toggle('on', Number(b.dataset.r) === num(q('#ck-risk').value))));

  q('#ck-go').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    paint();
    const r = last;
    if (!r?.lots || btn.disabled) return;
    if (r.level === 'red') {
      const first = r.reasons.find((x) => x.lv === 'red');
      const ok = await confirmDialog({ title: 'Trotz Rot traden?', text: `${first?.text || ''} Edge merkt sich, dass die Ampel rot war.`, ok: 'Trotzdem', cancel: 'Lass ich' });
      if (!ok) return;
    }
    const checks = Object.fromEntries(r.rules.filter((ru) => ru.val != null).map((ru) => [ru.id, ru.val]));
    saveOpen({
      accountId: acc.id,
      symbol: r.info.sym,
      side: c.side,
      lots: r.lots,
      entry: c.entry,
      sl: c.sl,
      tp: c.tp || null,
      risk: Math.round(r.risk * 100) / 100,
      setup: c.setup,
      feelBefore: c.feel,
      checks,
      rulesOk: r.missing ? null : r.rules.every((ru) => ru.val === true),
      check: r.level,
      openAt: Date.now(),
    });
    sheet.close();
    haptic('success');
    app.refresh();
    toast(`${r.info.sym} gemerkt. Trag das Ergebnis ein, wenn der Trade zu ist.`, { icon: icon('check'), ms: 4200 });
  });
  q('#ck-skip').addEventListener('click', () => {
    const red = last?.level === 'red';
    sheet.close();
    haptic(red ? 'success' : 'tap');
    if (red) toast('Ausgelassen. Kein Trade ist auch eine gute Entscheidung.', { icon: icon('shield'), ms: 3800 });
  });
  paint();
}
act('t-check', () => openCheck());

/* ---------- Offene Trades auf „Heute“ ---------- */
// Laufende Positionen laut MT5 (aus dem automatischen Abruf, höchstens drei Stunden alt)
function livePositions(acc) {
  const cfg = S.settings.mt5;
  const last = cfg?.last;
  if (!cfg?.key || last?.state !== 'ok' || (cfg.accountId && cfg.accountId !== acc.id) || Date.now() - last.at > 3 * 3600e3) return [];
  return last.positions || [];
}

export function openCardHTML(acc) {
  const list = openOf(acc.id);
  const live = livePositions(acc);
  const used = new Set();
  // Check-Einträge mit ihrer MT5-Position verbinden
  const match = (o) => {
    const p = live.find((x, i) => !used.has(i) && x.symbol === o.symbol && x.side === o.side && Math.abs((x.lots || 0) - (o.lots || 0)) < 0.005);
    if (p) used.add(live.indexOf(p));
    return p;
  };
  const pairs = list.map((o) => [o, match(o)]);
  const extra = live.filter((x, i) => !used.has(i));
  if (!list.length && !extra.length) return '';
  const t0 = today();
  const since = (ms) => (iso(new Date(ms)) === t0 ? `seit ${hm(ms)}` : `seit ${fmtShort(iso(new Date(ms)))}`);
  const float = (p) => (p ? ` · <b class="${p.profit > 0 ? 'win' : p.profit < 0 ? 'loss' : ''}">${fmtMoney(p.profit, acc.currency, { sign: true })}</b> offen` : '');
  return `<section class="card open-card">
    <div class="card-h"><h2 class="card-t">${icon('clock')} Läuft gerade</h2><span class="faint small">${S.settings.mt5?.key ? 'Ergebnis kommt aus MT5' : 'Ergebnis fehlt noch'}</span></div>
    ${pairs
      .map(([o, p]) => {
        return `<div class="orow"><span class="tside ${o.side === 'short' ? 'short' : 'long'}">${icon(o.side === 'short' ? 'down' : 'up')}</span>
        <span class="tmain"><span class="tsym">${esc(o.symbol)} <i class="adot ${esc(o.check || 'open')}" title="Ampel ${esc(CHECK[o.check] || '')}"></i></span><span class="tsub">${fmtNum(o.lots || 0, 2)} Lot · ${since(o.openAt)}${p ? float(p) : o.risk ? ` · Risiko ${fmtMoney(o.risk, acc.currency)}` : ''}</span></span>
        <span class="oacts"><button type="button" class="btn btn-primary btn-sm" data-act="open-done" data-id="${esc(o.id)}">Ergebnis</button><button type="button" class="icon-btn sm" data-act="open-drop" data-id="${esc(o.id)}" aria-label="Verwerfen">${icon('close')}</button></span></div>`;
      })
      .join('')}
    ${extra
      .map(
        (p) => `<div class="orow"><span class="tside ${p.side === 'short' ? 'short' : 'long'}">${icon(p.side === 'short' ? 'down' : 'up')}</span>
        <span class="tmain"><span class="tsym">${esc(p.symbol)} <small class="faint">aus MT5</small></span><span class="tsub">${fmtNum(p.lots || 0, 2)} Lot · ${since(p.openAt)}${float(p)}</span></span></div>`,
      )
      .join('')}
  </section>`;
}
act('open-done', (el) => {
  const o = S.open.find((x) => x.id === el.dataset.id);
  if (!o) return;
  const { id, createdAt, ...rest } = o;
  openTradeForm({ prefill: { ...rest, pnl: null, closeAt: Date.now() }, openId: id });
});
act('open-drop', async (el) => {
  const o = S.open.find((x) => x.id === el.dataset.id);
  if (!o) return;
  const ok = await confirmDialog({ title: 'Trade verwerfen?', text: `${o.symbol}: Hast du ihn doch nicht genommen, wird er hier gelöscht.`, ok: 'Verwerfen', danger: true });
  if (!ok) return;
  await removeOpen(o.id);
  haptic();
  app.refresh();
});
