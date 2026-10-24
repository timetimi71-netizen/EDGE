// Edge · Einstellungen, Konten, Regeln, Sperre, Backup und Willkommen
import { S, saveSettings, saveAccount, deleteAccount, activeAccount, accountTrades, saveTrade, wipeAll, removeDemo, hasDemo, buildBackup, restoreBackup } from './store.js';
import { PHASES, PRESETS, phaseName, accountState, fmtMoney, tradingDay, cleanSymbol } from './edge.js';
import { icon, logoSVG, openSheet, confirmDialog, segHTML, setSeg, switchHTML, keypadHTML, pinDotsHTML, pinPad } from './ui.js';
import { esc, uid, today, fmtNum, fmtBytes, num, amount, clamp, debounce, haptic, toast, lockScroll, unlockScroll, setHaptics, IS_IOS, IS_STANDALONE } from './util.js';
import { act, onInput, onChange, app } from './app.js';
import { saveFile } from './file.js';
import { stopDictation } from './speech.js';
import { loadDemo } from './demo.js';
import { openKeySheet } from './views/trades.js';
import { syncSummary } from './views/mt5.js';

export const VERSION = '1.2.0';

const ACCENTS = [
  ['kobalt', '#3d6bff', 'Kobalt'],
  ['violett', '#8b5cf6', 'Violett'],
  ['petrol', '#0f9f9a', 'Petrol'],
  ['gold', '#d99a1e', 'Gold'],
  ['graphit', '#4b5468', 'Graphit'],
];

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
export function applySettings() {
  const st = S.settings;
  const root = document.documentElement;
  if (st.accent && st.accent !== 'kobalt') root.dataset.accent = st.accent;
  else delete root.dataset.accent;
  const dark = st.look === 'dark' || (st.look === 'auto' && darkQuery.matches);
  if (dark) root.dataset.look = 'dark';
  else delete root.dataset.look;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg || (dark ? '#080b12' : '#f3f5f9')));
  root.classList.toggle('calm', !!st.reduceMotion);
  setHaptics(st.haptics !== false);
}
darkQuery.addEventListener?.('change', () => {
  if (S.settings?.look === 'auto') applySettings();
});

/* ---------- Konto anlegen / bearbeiten ---------- */
export function openAccount({ id = null, onDone = null } = {}) {
  const cur = id ? S.accounts.get(id) : null;
  const d = cur
    ? { ...cur }
    : { name: '', firm: '', size: 100000, currency: 'USD', phase: 'p1', ...PRESETS.p1, maxLossType: 'static', resetHour: 0, startAt: Date.now() };
  const sheet = openSheet({ title: cur ? 'Konto bearbeiten' : 'Neues Konto', cls: 'tall' });
  const n = (id2, label, v, unit, mode = 'decimal') =>
    `<label class="li" for="${id2}"><span class="li-title">${label}</span><span class="unit-in"><input class="num-in" id="${id2}" type="text" inputmode="${mode}" value="${v ?? ''}"><small>${unit}</small></span></label>`;
  sheet.body.innerHTML = `<div class="form acc-form">
    ${cur ? '' : '<p class="muted">Trag die Werte deiner Challenge ein. Die Vorlagen sind typische Werte einer 2-Phasen-Challenge, prüf die genauen Regeln deiner Firma.</p>'}
    <div class="group">
      <div class="li"><input class="li-input" id="ac-firm" placeholder="Firma, z. B. FTMO" maxlength="30" value="${esc(d.firm)}"></div>
      <div class="li"><input class="li-input" id="ac-name" placeholder="Name, z. B. 100k Phase 1" maxlength="40" value="${esc(d.name)}"></div>
    </div>
    <div class="group-label">Phase</div>
    ${segHTML('ac-phase', PHASES, d.phase, 'sm')}
    <div class="group">
      ${n('ac-size', 'Kontogröße', d.size, '')}
      <div class="li"><span class="li-title">Währung</span><div class="look-seg">${segHTML('ac-cur', [
        ['USD', '$'],
        ['EUR', '€'],
        ['CHF', 'CHF'],
        ['GBP', '£'],
      ], d.currency, 'sm')}</div></div>
    </div>
    <div class="group-label">Regeln der Challenge</div>
    <div class="group">
      ${n('ac-target', 'Profitziel', d.target, '%')}
      ${n('ac-daily', 'Max. Tagesverlust', d.dailyLoss, '%')}
      ${n('ac-max', 'Max. Gesamtverlust', d.maxLoss, '%')}
      <div class="li"><span class="li-title">Gesamtverlust</span><div class="look-seg">${segHTML('ac-type', [
        ['static', 'fest'],
        ['trailing', 'zieht nach'],
      ], d.maxLossType, 'sm')}</div></div>
      ${n('ac-days', 'Mindest-Handelstage', d.minDays, 'Tage', 'numeric')}
      ${n('ac-reset', 'Neuer Handelstag um', d.resetHour, 'Uhr', 'numeric')}
    </div>
    <p class="note">Prozente beziehen sich auf die Kontogröße. „Fest“: Die Grenze bleibt bei Kontogröße minus Gesamtverlust. „Zieht nach“: Sie steigt mit deinem höchsten Kontostand mit, höchstens bis zur Kontogröße. Bei FTMO beginnt der neue Tag um Mitternacht (Schweizer Zeit).</p>
    <div class="calc" id="ac-calc"></div>
    <button type="button" class="btn btn-primary btn-lg btn-block" id="ac-save">${cur ? 'Speichern' : 'Konto anlegen'}</button>
    ${cur ? `<div class="group-label">Status</div>${segHTML('ac-status', [
      ['aktiv', 'Läuft'],
      ['bestanden', 'Bestanden'],
      ['verloren', 'Nicht bestanden'],
    ], d.status || 'aktiv', 'sm')}<button type="button" class="btn btn-danger btn-block" id="ac-del" style="margin-top:14px">Konto mit allen Trades löschen</button>` : ''}
  </div>`;
  const q = (s) => sheet.body.querySelector(s);
  const read = () => {
    d.firm = q('#ac-firm').value.trim();
    d.name = q('#ac-name').value.trim();
    d.size = amount(q('#ac-size').value);
    d.target = num(q('#ac-target').value) ?? 0;
    d.dailyLoss = num(q('#ac-daily').value) ?? 0;
    d.maxLoss = num(q('#ac-max').value) ?? 0;
    d.minDays = Math.round(num(q('#ac-days').value) ?? 0);
    d.resetHour = clamp(Math.round(num(q('#ac-reset').value) ?? 0), 0, 23);
  };
  const calc = () => {
    read();
    const m = (p) => fmtMoney(((d.size || 0) * (p || 0)) / 100, d.currency, { dec: 0 });
    q('#ac-calc').innerHTML = d.size
      ? `<div class="calc-grid"><div><b>${d.target ? m(d.target) : '–'}</b><span>Ziel</span></div><div><b>${d.dailyLoss ? m(d.dailyLoss) : '–'}</b><span>pro Tag</span></div><div><b>${d.maxLoss ? m(d.maxLoss) : '–'}</b><span>insgesamt</span></div></div>`
      : '';
  };
  sheet.body.addEventListener('input', debounce(calc, 120));
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('.seg button');
    if (!b) return;
    setSeg(b);
    const a = b.dataset.act;
    if (a === 'ac-phase') {
      d.phase = b.dataset.v;
      // Vorlagen nur übernehmen, solange es ein neues Konto ist
      if (!cur) {
        const p = PRESETS[d.phase];
        q('#ac-target').value = p.target;
        q('#ac-daily').value = p.dailyLoss;
        q('#ac-max').value = p.maxLoss;
        q('#ac-days').value = p.minDays;
      }
    }
    if (a === 'ac-cur') d.currency = b.dataset.v;
    if (a === 'ac-type') d.maxLossType = b.dataset.v;
    if (a === 'ac-status') d.status = b.dataset.v;
    haptic();
    calc();
  });
  q('#ac-save').addEventListener('click', async () => {
    read();
    if (!(d.size > 0) || d.size > 10000000) {
      const el = q('#ac-size');
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      el.focus();
      haptic('error');
      return;
    }
    if (!d.name) d.name = `${fmtNum(d.size / 1000, 0)}k ${phaseName(d.phase)}`;
    // Firma vorne dran, damit „FTMO 100k Phase 1“ überall gleich heißt
    if (d.firm && !d.name.toLowerCase().includes(d.firm.toLowerCase())) d.name = `${d.firm} ${d.name}`.slice(0, 60);
    const resetChanged = cur && cur.resetHour !== d.resetHour;
    const a = saveAccount(d);
    // Neuer Tageswechsel: Handelstage der Trades neu berechnen
    if (resetChanged) for (const t of accountTrades(a.id)) saveTrade({ ...t, day: tradingDay(t.closeAt, a.resetHour) });
    if (!cur) await saveSettings({ activeAccount: a.id });
    sheet.close();
    haptic('success');
    toast(cur ? 'Gespeichert' : 'Konto angelegt. Viel Erfolg bei der Challenge!', { icon: icon('check') });
    onDone?.(a);
    app.refresh({ animate: true });
  });
  q('#ac-del')?.addEventListener('click', async () => {
    const n2 = accountTrades(cur.id).length;
    const ok = await confirmDialog({ title: 'Konto löschen?', text: `„${cur.name}“ und ${n2} ${n2 === 1 ? 'Trade' : 'Trades'} werden gelöscht.`, ok: 'Löschen', danger: true });
    if (!ok) return;
    await deleteAccount(cur.id);
    sheet.close();
    onDone?.();
    app.refresh({ animate: true });
  });
  calc();
}
act('acc-new', () => openAccount());

// Konto wechseln
export function openSwitcher() {
  const list = [...S.accounts.values()].sort((a, b) => b.createdAt - a.createdAt);
  const act2 = activeAccount();
  const sheet = openSheet({
    title: 'Konten',
    body: `<div class="form"><div class="acc-list">${list
      .map((a) => {
        const st = accountState(a);
        return `<button type="button" class="acc-row ${a.id === act2?.id ? 'on' : ''}" data-id="${esc(a.id)}"><span class="cbox">${icon('check')}</span>
        <span class="tmain"><span class="tsym">${esc(a.name)}</span><span class="tsub">${esc(phaseName(a.phase))} · ${a.status === 'bestanden' ? 'bestanden' : a.status === 'verloren' ? 'nicht bestanden' : 'läuft'}</span></span>
        <span class="tres ${st.profit >= 0 ? 'win' : 'loss'}"><b>${fmtMoney(st.profit, a.currency, { sign: true })}</b></span></button>`;
      })
      .join('')}</div>
      <button type="button" class="btn btn-soft btn-block" id="sw-edit">${icon('edit')} Aktuelles Konto bearbeiten</button>
      <button type="button" class="btn btn-primary btn-block" id="sw-new">${icon('plus')} Neues Konto</button>
      <p class="note">Neue Challenge gekauft oder Phase 2 erreicht? Leg ein neues Konto an. Die alten Trades bleiben für die Analyse.</p></div>`,
  });
  sheet.body.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-id]');
    if (row) {
      await saveSettings({ activeAccount: row.dataset.id });
      haptic();
      sheet.close();
      app.refresh({ animate: true });
      return;
    }
    if (e.target.closest('#sw-edit')) {
      sheet.close();
      setTimeout(() => openAccount({ id: activeAccount()?.id }), 200);
    }
    if (e.target.closest('#sw-new')) {
      sheet.close();
      setTimeout(() => openAccount(), 200);
    }
  });
}
act('acc-switch', () => openSwitcher());

/* ---------- Einstellungen ---------- */
const sw = (id, on, attrs) => switchHTML(id, on, attrs);
function listEditor(key, items, ph) {
  return `<div class="tag-edit" data-key="${key}">${items
    .map((x, i) => `<span class="chip tag">${esc(x)}<button type="button" data-act="set-tag-del" data-key="${key}" data-i="${i}" aria-label="${esc(x)} entfernen">${icon('close')}</button></span>`)
    .join('')}</div>
    <div class="habit-add li"><input class="field" id="add-${key}" placeholder="${ph}" maxlength="40" enterkeyhint="done"><button type="button" class="btn btn-soft btn-sm" data-act="set-tag-add" data-key="${key}">Hinzufügen</button></div>`;
}
function settingsHTML() {
  const st = S.settings;
  const acc = activeAccount();
  const lockOpts = [
    [0, 'Sofort'],
    [60, 'Nach 1 Minute'],
    [300, 'Nach 5 Minuten'],
    [900, 'Nach 15 Minuten'],
  ];
  return `<div class="form">
    <div class="group-label">Konto</div>
    <div class="group">
      ${
        acc
          ? `<button type="button" class="li" data-act="acc-edit"><span class="li-ic">${icon('wallet')}</span><span class="li-main"><span class="li-title">${esc(acc.name)}</span><span class="li-sub">${fmtMoney(acc.size, acc.currency, { dec: 0 })} · Ziel ${acc.target || 0} % · Tag ${acc.dailyLoss || 0} % · Gesamt ${acc.maxLoss || 0} %</span></span><span class="li-end">${icon('chevR')}</span></button>`
          : ''
      }
      <button type="button" class="li" data-act="acc-switch-s"><span class="li-ic">${icon('layers')}</span><span class="li-title li-main">${S.accounts.size > 1 ? `Konten (${S.accounts.size})` : 'Neues Konto'}</span><span class="li-end">${icon('chevR')}</span></button>
    </div>

    <div class="group-label">Profil</div>
    <div class="group"><label class="li" for="set-name"><span class="li-title">Dein Name</span><input class="li-input" id="set-name" style="text-align:right" placeholder="optional" value="${esc(st.name)}" data-input="set-name" maxlength="30"></label></div>

    <div class="group-label" id="set-limits">Deine Grenzen pro Tag</div>
    <div class="group">
      <div class="li"><span class="li-main"><span class="li-title">Höchstens Trades</span><span class="li-sub">0 = keine Grenze</span></span><div class="stepper"><button type="button" data-act="set-lim" data-k="maxTrades" data-d="-1" aria-label="Weniger">${icon('minus')}</button><output id="lim-maxTrades">${st.limits.maxTrades || 0}</output><button type="button" data-act="set-lim" data-k="maxTrades" data-d="1" aria-label="Mehr">${icon('plus')}</button></div></div>
      <div class="li"><span class="li-main"><span class="li-title">Stopp nach Verlusten in Folge</span><span class="li-sub">0 = keine Grenze</span></span><div class="stepper"><button type="button" data-act="set-lim" data-k="stopAfterLosses" data-d="-1" aria-label="Weniger">${icon('minus')}</button><output id="lim-stopAfterLosses">${st.limits.stopAfterLosses || 0}</output><button type="button" data-act="set-lim" data-k="stopAfterLosses" data-d="1" aria-label="Mehr">${icon('plus')}</button></div></div>
      <div class="li"><span class="li-main"><span class="li-title">Pause nach einem Verlust</span><span class="li-sub">so lange zeigt der Check Rot</span></span><div class="stepper"><button type="button" data-act="set-cool" data-d="-15" aria-label="Kürzer">${icon('minus')}</button><output id="lim-cooldown">${coolText(st.limits.cooldown ?? 30)}</output><button type="button" data-act="set-cool" data-d="15" aria-label="Länger">${icon('plus')}</button></div></div>
      <label class="li" for="set-risk"><span class="li-title">Standard-Risiko pro Trade</span><span class="unit-in"><input class="num-in" id="set-risk" type="text" inputmode="decimal" value="${String(st.risk).replace('.', ',')}" data-input="set-risk"><small>%</small></span></label>
    </div>

    <div class="group-label" id="set-rules">Checkliste vor jedem Trade</div>
    <div class="group pad">${listEditor('rules', st.rules.map((r) => r.text), 'Neue Regel')}</div>
    <div class="group-label">Setups</div>
    <div class="group pad">${listEditor('setups', st.setups, 'Neues Setup')}</div>
    <div class="group-label">Fehler</div>
    <div class="group pad">${listEditor('mistakes', st.mistakes, 'Neuer Fehler')}</div>
    <div class="group-label">Lieblings-Symbole</div>
    <div class="group pad">${listEditor('symbols', st.symbols, 'z. B. AUDUSD')}</div>

    <div class="group-label">Für Lot-Rechner und Risiko</div>
    <div class="group">
      ${['NAS100', 'US30', 'GER40', 'XAUUSD']
        .map(
          (s) =>
            `<label class="li" for="set-c-${s}"><span class="li-main"><span class="li-title">${s}</span><span class="li-sub">Kontraktgröße pro Lot</span></span><input class="num-in" id="set-c-${s}" type="text" inputmode="decimal" value="${st.contracts[s] ?? ''}" data-input="set-contract" data-s="${s}"></label>`,
        )
        .join('')}
      ${['EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD']
        .map(
          (c) =>
            `<label class="li" for="set-r-${c}"><span class="li-main"><span class="li-title">1 ${c} in USD</span><span class="li-sub">ungefährer Kurs</span></span><input class="num-in" id="set-r-${c}" type="text" inputmode="decimal" value="${String(st.rates[c] ?? '').replace('.', ',')}" data-input="set-rate" data-c="${c}"></label>`,
        )
        .join('')}
    </div>
    <p class="note group-note">Bei Indizes ist die Kontraktgröße je nach Broker anders. Sie steht in MT5 unter Symbol → Spezifikation.</p>

    <div class="group-label">MT5 automatisch</div>
    <div class="group">
      <button type="button" class="li" data-act="mt5-setup"><span class="li-ic">${icon('repeat')}</span><span class="li-main"><span class="li-title">Trades automatisch aus MT5</span><span class="li-sub">${esc(syncSummary())}</span></span><span class="li-end">${icon('chevR')}</span></button>
    </div>
    <div class="group-label">Screenshots aus MT5</div>
    <div class="group">
      <button type="button" class="li" data-act="set-key"><span class="li-ic">${icon('camera')}</span><span class="li-main"><span class="li-title">Gemini-Schlüssel</span><span class="li-sub">${st.geminiKey ? `Verbunden${st.geminiModel ? ` · ${esc(st.geminiModel)}` : ''}` : 'Nicht eingerichtet'}</span></span><span class="li-end">${icon('chevR')}</span></button>
      <div class="li"><span class="li-main"><span class="li-title">MT5-Serverzeit</span><span class="li-sub">Stunden vor deiner Uhr</span></span><div class="stepper"><button type="button" data-act="set-off" data-d="-1" aria-label="Weniger">${icon('minus')}</button><output id="set-off">${(st.serverOffset ?? 1) > 0 ? '+' : ''}${st.serverOffset ?? 1} h</output><button type="button" data-act="set-off" data-d="1" aria-label="Mehr">${icon('plus')}</button></div></div>
    </div>

    <div class="group-label">Aussehen</div>
    <div class="group">
      <div class="li"><span class="li-title">Design</span><div class="look-seg">${segHTML('set-look', [
        ['light', 'Hell'],
        ['dark', 'Dunkel'],
        ['auto', 'Automatisch'],
      ], st.look || 'light', 'sm')}</div></div>
      <div class="li"><span class="li-main"><span class="li-title">Akzentfarbe</span></span>
        <div class="accent-row">${ACCENTS.map(([k, c, name]) => `<button type="button" class="color ${st.accent === k ? 'on' : ''}" style="--c:${c}" data-act="set-accent" data-v="${k}" aria-label="${name}"></button>`).join('')}</div></div>
      <label class="li" for="set-haptics"><span class="li-title li-main">Haptisches Feedback</span>${sw('set-haptics', st.haptics, 'data-change="set-flag" data-key="haptics"')}</label>
      <label class="li" for="set-calm"><span class="li-title li-main">Weniger Animationen</span>${sw('set-calm', st.reduceMotion, 'data-change="set-flag" data-key="reduceMotion"')}</label>
    </div>

    <div class="group-label" id="set-lock">Sperre</div>
    <div class="group">
      <label class="li" for="set-pin"><span class="li-ic">${icon('lock')}</span><span class="li-title li-main">PIN-Sperre</span>${sw('set-pin', !!st.pinHash, 'data-change="set-pin"')}</label>
      ${
        st.pinHash
          ? `<label class="li" for="set-lock-after"><span class="li-title li-main">Sperren</span><select id="set-lock-after" data-change="set-lock-after">${lockOpts
              .map(([v, l]) => `<option value="${v}" ${st.lockAfter === v ? 'selected' : ''}>${l}</option>`)
              .join('')}</select></label>
             <button type="button" class="li" data-act="pin-change"><span class="li-title" style="color:var(--accent-2)">PIN ändern</span></button>`
          : ''
      }
    </div>

    <div class="group-label" id="set-data">Daten</div>
    <div class="group">
      <button type="button" class="li" data-act="backup"><span class="li-ic">${icon('download')}</span><span class="li-main"><span class="li-title">Backup erstellen</span><span class="li-sub">${
        st.lastBackup ? `Zuletzt am ${new Date(st.lastBackup).toLocaleDateString('de-DE')}` : 'Noch nie gesichert'
      }</span></span><span class="li-end">${icon('chevR')}</span></button>
      <label class="li"><span class="li-ic">${icon('upload')}</span><span class="li-main"><span class="li-title">Backup wiederherstellen</span><span class="li-sub">Edge-Backup (.json) auswählen</span></span><span class="li-end">${icon('chevR')}</span><input type="file" accept="application/json,.json" data-change="backup-import" class="sr"></label>
      ${
        hasDemo()
          ? `<button type="button" class="li" data-act="demo-remove"><span class="li-ic">${icon('sparkle')}</span><span class="li-main"><span class="li-title">Beispieldaten entfernen</span><span class="li-sub">Deine eigenen Konten und Trades bleiben</span></span></button>`
          : `<button type="button" class="li" data-act="demo-load"><span class="li-ic">${icon('sparkle')}</span><span class="li-main"><span class="li-title">Beispieldaten laden</span><span class="li-sub">Zum Ausprobieren, lassen sich wieder entfernen</span></span></button>`
      }
      <button type="button" class="li danger" data-act="wipe"><span class="li-ic" style="color:inherit">${icon('trash')}</span><span class="li-title">Alle Daten löschen</span></button>
    </div>
    ${S.memoryOnly ? '<div class="group-note" style="color:var(--loss-t)">Dieser Browser erlaubt keine dauerhafte Speicherung. Einträge gehen beim Schließen verloren.</div>' : ''}

    <div class="group-label">Als App installieren</div>
    <div class="group pad"><ol class="steps">
      <li><span>Öffne Edge in <b>Safari</b>.</span></li>
      <li><span>Tippe auf ${icon('share', 'inline-ic')} <b>Teilen</b>.</span></li>
      <li><span>Wähle <b>„Zum Home-Bildschirm“</b> und tippe auf <b>Hinzufügen</b>.</span></li>
    </ol></div>

    <div class="about">${logoSVG('')}<b>Edge</b><span>Version ${VERSION} · Deine Daten bleiben auf diesem Gerät.</span></div>
  </div>`;
}

let settingsSheet = null;
export function openSettings(section) {
  settingsSheet = openSheet({
    title: 'Einstellungen',
    cls: 'tall',
    body: settingsHTML(),
    onClose: () => {
      settingsSheet = null;
      app.refresh();
    },
  });
  if (section) setTimeout(() => settingsSheet?.body.querySelector(`#set-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 420);
}
function rerender() {
  if (!settingsSheet || settingsSheet.closed) return;
  const top = settingsSheet.body.scrollTop;
  settingsSheet.body.innerHTML = settingsHTML();
  settingsSheet.body.scrollTop = top;
}
act('settings', (el) => openSettings(el.dataset.section));
act('acc-edit', () => openAccount({ id: activeAccount()?.id, onDone: rerender }));
act('acc-switch-s', () => (S.accounts.size > 1 ? openSwitcher() : openAccount({ onDone: rerender })));
act('set-key', () => openKeySheet(rerender));
const saveName = debounce((v) => saveSettings({ name: v }), 300);
onInput('set-name', (el) => saveName(el.value.trim()));
const saveRisk = debounce((v) => v > 0 && v <= 10 && saveSettings({ risk: v }), 300);
onInput('set-risk', (el) => saveRisk(num(el.value)));
const saveContract = debounce((s, v) => saveSettings({ contracts: { ...S.settings.contracts, [s]: v } }), 300);
onInput('set-contract', (el) => {
  const v = num(el.value);
  if (v > 0) saveContract(el.dataset.s, v);
});
const saveRate = debounce((c, v) => saveSettings({ rates: { ...S.settings.rates, [c]: v } }), 300);
onInput('set-rate', (el) => {
  const v = num(el.value);
  if (v > 0) saveRate(el.dataset.c, v);
});
act('set-lim', (el) => {
  const k = el.dataset.k;
  const v = clamp((S.settings.limits[k] || 0) + Number(el.dataset.d), 0, 20);
  saveSettings({ limits: { ...S.settings.limits, [k]: v } });
  document.getElementById(`lim-${k}`).textContent = v;
  haptic();
});
const coolText = (v) => (v ? `${v} min` : 'aus');
act('set-cool', (el) => {
  const v = clamp((S.settings.limits.cooldown ?? 30) + Number(el.dataset.d), 0, 120);
  saveSettings({ limits: { ...S.settings.limits, cooldown: v } });
  document.getElementById('lim-cooldown').textContent = coolText(v);
  haptic();
});
act('set-off', (el) => {
  const v = clamp((S.settings.serverOffset ?? 1) + Number(el.dataset.d), -12, 12);
  saveSettings({ serverOffset: v });
  document.getElementById('set-off').textContent = `${v > 0 ? '+' : ''}${v} h`;
  haptic();
});
act('set-tag-del', async (el) => {
  const key = el.dataset.key;
  const i = Number(el.dataset.i);
  const list = [...S.settings[key]];
  list.splice(i, 1);
  await saveSettings({ [key]: list });
  haptic();
  rerender();
});
act('set-tag-add', async (el) => {
  const key = el.dataset.key;
  const inp = document.getElementById(`add-${key}`);
  let v = inp.value.trim();
  if (!v) {
    inp.focus();
    return;
  }
  if (key === 'symbols') v = cleanSymbol(v);
  const item = key === 'rules' ? { id: uid(), text: v } : v;
  const exists = key === 'rules' ? S.settings.rules.some((r) => r.text === v) : S.settings[key].includes(v);
  if (!exists) await saveSettings({ [key]: [...S.settings[key], item] });
  haptic('success');
  rerender();
});
act('set-look', (el) => {
  saveSettings({ look: el.dataset.v });
  setSeg(el);
  applySettings();
  haptic();
});
act('set-accent', (el) => {
  saveSettings({ accent: el.dataset.v });
  applySettings();
  el.parentElement.querySelectorAll('.color').forEach((c) => c.classList.toggle('on', c === el));
  haptic();
});
onChange('set-flag', (el) => {
  saveSettings({ [el.dataset.key]: el.checked });
  applySettings();
  haptic();
});
onChange('set-lock-after', (el) => saveSettings({ lockAfter: Number(el.value) }));

/* ---------- Backup ---------- */
export async function exportBackup() {
  const sheet = openSheet({ title: 'Backup', body: '<div class="success"><div class="spinner"></div><p class="muted">Backup wird vorbereitet …</p></div>' });
  let blob;
  let data;
  try {
    data = await buildBackup();
    blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  } catch (e) {
    console.error(e);
    sheet.body.innerHTML = '<p class="muted center">Das Backup konnte nicht erstellt werden.</p>';
    return;
  }
  const name = `edge-backup-${today()}.json`;
  sheet.body.innerHTML = `<div class="success">
    <div class="tip-ic" style="width:64px;height:64px;border-radius:20px">${icon('download', 'lg')}</div>
    <h3>Dein Backup ist bereit</h3>
    <p class="muted">${plural(data.accounts.length, 'Konto', 'Konten')} · ${plural(data.trades.length, 'Trade', 'Trades')} · ${plural(data.days.length, 'Tag', 'Tage')} · ${plural(data.pics.length, 'Bild', 'Bilder')} · ${fmtBytes(blob.size)}</p>
    <button type="button" class="btn btn-primary btn-lg" id="bk-save">${icon('share')} Sichern</button>
    <p class="note">Wähle im nächsten Schritt „In Dateien sichern“, am besten in iCloud Drive.</p>
  </div>`;
  sheet.body.querySelector('#bk-save').addEventListener('click', async () => {
    try {
      await saveFile(blob, name);
      await saveSettings({ lastBackup: Date.now() });
      toast('Backup gesichert', { icon: icon('check') });
      sheet.close();
      rerender();
    } catch (e) {
      if (e?.name === 'AbortError' || e?.code === 'declined') return;
      console.error(e);
      toast('Sichern hat nicht geklappt. Versuch es noch einmal.');
    }
  });
}
act('backup', () => exportBackup());
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
onChange('backup-import', async (el) => {
  const file = el.files?.[0];
  el.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei ließ sich nicht lesen.');
    return;
  }
  if (data?.app !== 'edge') {
    toast('Das ist kein Edge-Backup.');
    return;
  }
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('de-DE') : 'unbekannt';
  const ok = await confirmDialog({
    title: 'Backup wiederherstellen?',
    text: `${plural(data.accounts?.length || 0, 'Konto', 'Konten')}, ${plural(data.trades?.length || 0, 'Trade', 'Trades')} und ${plural(data.days?.length || 0, 'Journal-Tag', 'Journal-Tage')} vom ${when}. Gleiche Einträge werden ersetzt.${hasDemo() ? ' Die Beispieldaten werden dabei entfernt.' : ''}`,
    ok: 'Wiederherstellen',
  });
  if (!ok) return;
  try {
    if (hasDemo()) await removeDemo();
    const r = await restoreBackup(data);
    applySettings();
    toast(`Wiederhergestellt: ${plural(r.trades, 'Trade', 'Trades')}, ${plural(r.accounts, 'Konto', 'Konten')}`, { icon: icon('check') });
    rerender();
    app.refresh();
  } catch (e) {
    toast(e?.message || 'Wiederherstellen hat nicht geklappt.');
  }
});
act('demo-load', async () => {
  await loadDemo();
  toast('Beispieldaten geladen', { icon: icon('sparkle') });
  rerender();
});
act('demo-remove', async () => {
  const ok = await confirmDialog({ title: 'Beispieldaten entfernen?', text: 'Deine eigenen Konten und Trades bleiben erhalten.', ok: 'Entfernen' });
  if (!ok) return;
  await removeDemo();
  toast('Beispieldaten entfernt');
  rerender();
});
act('wipe', async () => {
  const ok = await confirmDialog({ title: 'Alle Daten löschen?', text: 'Konten, Trades, Journal, Bilder und Einstellungen werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.', ok: 'Alles löschen', danger: true });
  if (!ok) return;
  const sure = await confirmDialog({ title: 'Wirklich alles?', text: 'Hast du vorher ein Backup gemacht?', ok: 'Ja, löschen', danger: true });
  if (!sure) return;
  await wipeAll();
  location.reload();
});

/* ---------- PIN ---------- */
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (const b of data) h = Math.imul(h ^ b, 16777619);
  return `fnv${(h >>> 0).toString(16)}`;
}
const checkPin = async (pin) => (await hashPin(pin, S.settings.pinSalt)) === S.settings.pinHash;
function pinSheet(title, message, onPin) {
  const sheet = openSheet({ title, body: `<div class="lock-in" style="margin:0 auto;padding:6px 0 4px">${icon('lock', 'lg')}<p class="pin-msg">${esc(message)}</p>${pinDotsHTML()}${keypadHTML()}</div>` });
  const msg = sheet.body.querySelector('.pin-msg');
  pinPad(sheet.body, { onComplete: (v, p) => onPin(v, p, msg, sheet) });
  return sheet;
}
function openPinSetup() {
  let first = null;
  pinSheet('PIN festlegen', 'Wähle eine 4-stellige PIN', async (v, p, msg, sheet) => {
    if (!first) {
      first = v;
      msg.textContent = 'Gib die PIN noch einmal ein';
      p.reset();
      return;
    }
    if (v !== first) {
      first = null;
      msg.textContent = 'Die PINs stimmen nicht überein. Noch mal von vorn.';
      p.shake();
      p.reset();
      return;
    }
    const salt = uid();
    await saveSettings({ pinHash: await hashPin(v, salt), pinSalt: salt });
    sheet.body.querySelector('.pin-dots').classList.add('ok');
    haptic('success');
    setTimeout(() => {
      sheet.close();
      toast('PIN-Sperre ist an', { icon: icon('lock') });
      rerender();
    }, 450);
  });
}
function openPinVerify(onOk) {
  pinSheet('Aktuelle PIN', 'Gib deine aktuelle PIN ein', async (v, p, msg, sheet) => {
    if (await checkPin(v)) {
      sheet.close();
      onOk();
    } else {
      msg.textContent = 'Falsche PIN';
      p.shake();
      p.reset();
    }
  });
}
onChange('set-pin', (el) => {
  const wants = el.checked;
  el.checked = !!S.settings.pinHash;
  if (wants) openPinSetup();
  else {
    openPinVerify(async () => {
      await saveSettings({ pinHash: null, pinSalt: null });
      toast('PIN-Sperre ist aus');
      rerender();
    });
  }
});
act('pin-change', () => openPinVerify(() => openPinSetup()));

/* ---------- Sperrbildschirm ---------- */
let lockEl = null;
export function showLock() {
  if (lockEl || !S.settings.pinHash) return;
  stopDictation();
  document.activeElement?.blur?.();
  lockEl = document.createElement('div');
  lockEl.className = 'lock';
  lockEl.innerHTML = `<div class="lock-in">${logoSVG('logo')}<h2>Edge ist gesperrt</h2><p class="pin-msg" id="lock-msg">Gib deine PIN ein</p>${pinDotsHTML()}${keypadHTML()}<button type="button" class="link small" id="lock-forgot">PIN vergessen?</button></div>`;
  document.body.appendChild(lockEl);
  lockScroll();
  const el = lockEl;
  const msg = el.querySelector('#lock-msg');
  let fails = 0;
  let until = 0;
  const pad = pinPad(el, {
    onComplete: async (v, p) => {
      if (Date.now() < until) {
        p.reset();
        return;
      }
      if (await checkPin(v)) {
        el.querySelector('.pin-dots').classList.add('ok');
        haptic('success');
        document.removeEventListener('keydown', onKey);
        lockEl = null;
        setTimeout(() => {
          el.classList.add('out');
          unlockScroll();
          setTimeout(() => el.remove(), 520);
        }, 180);
        return;
      }
      fails++;
      p.shake();
      p.reset();
      if (fails >= 5) {
        until = Date.now() + 30000;
        fails = 0;
        msg.textContent = 'Zu viele Versuche. Warte 30 Sekunden.';
        setTimeout(() => {
          msg.textContent = 'Gib deine PIN ein';
        }, 30000);
      } else msg.textContent = 'Falsche PIN';
    },
  });
  const onKey = (e) => {
    if (/^\d$/.test(e.key)) pad.press(e.key);
    else if (e.key === 'Backspace') pad.press('del');
  };
  document.addEventListener('keydown', onKey);
  el.querySelector('#lock-forgot').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Edge zurücksetzen?', text: 'Ohne PIN kommst du nicht mehr an deine Einträge. Beim Zurücksetzen werden alle Daten auf diesem Gerät gelöscht.', ok: 'Alles löschen', danger: true });
    if (!ok) return;
    await wipeAll();
    location.reload();
  });
}

/* ---------- Willkommen ---------- */
export function showOnboarding() {
  const el = document.createElement('div');
  el.className = 'onb';
  el.innerHTML = `<div class="onb-in">
    ${logoSVG('logo')}
    <h1>Willkommen bei <em>Edge</em></h1>
    <p class="lead">Dein Trading-Journal für die Prop-Firm-Challenge: jeder Trade festgehalten, deine Regeln im Blick und klare Antworten, wo dein Geld hingeht.</p>
    <div class="feats">
      <div class="feat"><span class="fi">${icon('shield')}</span><p><b>Challenge im Griff</b>Wie viel du heute noch verlieren darfst und wie weit dein Ziel ist.</p></div>
      <div class="feat"><span class="fi">${icon('camera')}</span><p><b>Schnell eintragen</b>Von Hand oder per Screenshot aus dem MT5-Verlauf.</p></div>
      <div class="feat"><span class="fi">${icon('sparkle')}</span><p><b>Deinen Edge finden</b>Welche Setups, Zeiten und Gewohnheiten dich Geld kosten.</p></div>
    </div>
    <label class="lbl" for="onb-name">Wie heißt du?<input class="field" id="onb-name" placeholder="Dein Vorname (optional)" maxlength="30" enterkeyhint="done"></label>
    <div class="onb-actions">
      <button type="button" class="btn btn-primary btn-lg" id="onb-go">Konto anlegen</button>
      <button type="button" class="btn btn-ghost" id="onb-demo">Erst mal mit Beispieldaten ansehen</button>
      ${IS_IOS && !IS_STANDALONE ? `<p class="note center">Tipp: In Safari auf ${icon('share', 'inline-ic')} Teilen und dann „Zum Home-Bildschirm“, dann startet Edge wie eine App.</p>` : ''}
    </div>
  </div>`;
  document.body.appendChild(el);
  lockScroll();
  const finish = async (demo) => {
    const name = el.querySelector('#onb-name').value.trim();
    el.querySelectorAll('button').forEach((b) => (b.disabled = true));
    await saveSettings({ name, onboarded: true });
    if (demo) await loadDemo();
    haptic('success');
    el.classList.add('out');
    unlockScroll();
    setTimeout(() => el.remove(), 460);
    app.refresh({ animate: true });
    if (demo) toast('Beispieldaten geladen. Entfernen kannst du sie in den Einstellungen.', { ms: 4500 });
    else setTimeout(() => openAccount(), 500);
  };
  el.querySelector('#onb-go').addEventListener('click', () => finish(false));
  el.querySelector('#onb-demo').addEventListener('click', () => finish(true));
}
