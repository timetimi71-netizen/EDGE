// Neuer Trade / Bearbeiten: Basis, Bias, Entry, Sinn, Screenshots, Notiz
import { state, getTrade, saveTrade, putImage, getImage, delImage } from '../store.js';
import { BIAS, ENTRY, SENSE_LABELS, emptyChecks, groupOk, missing, isoDate, uid } from '../model.js';
import { esc, icon, toast, compressImage, viewImage, confirmSheet } from '../ui.js';
import { go } from '../main.js';
import { haptic, confetti } from '../fx.js';
import { resultHtml, bindResult, draftFrom, applyDraft } from './close.js';

function groupHtml(g, checks) {
  const ok = groupOk(g, checks);
  const badge = g.required ? `<span class="req ${ok ? 'ok' : ''}" data-badge="${g.key}">${ok ? icon('check') : 'Pflicht'}</span>` : '<span class="opt">optional</span>';
  if (g.type === 'toggle') {
    return `<button type="button" class="check-row ${checks[g.key] ? 'on' : ''}" data-toggle="${g.key}">
      <span class="box">${icon('check')}</span>
      <span class="check-label">${esc(g.label)}${g.hint ? `<small>${esc(g.hint)}</small>` : ''}</span>
      ${badge}
    </button>`;
  }
  return `<div class="group" data-group="${g.key}">
    <div class="group-head"><span>${esc(g.label)}</span>${g.required ? `<span class="req ${ok ? 'ok' : ''}" data-badge="${g.key}">${ok ? icon('check') : 'mind. 1'}</span>` : ''}</div>
    <div class="chips">${g.options
      .map(([v, l]) => `<button type="button" class="chip ${(checks[g.key] || []).includes(v) ? 'on' : ''}" data-multi="${g.key}" data-v="${v}">${esc(l)}</button>`)
      .join('')}</div>
  </div>`;
}

const recentSymbols = () => {
  const seen = new Map();
  for (const t of [...state.trades].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
    if (!seen.has(t.symbol)) seen.set(t.symbol, 1);
    if (seen.size >= 6) break;
  }
  return [...seen.keys()];
};

export async function formView(root, id) {
  const existing = id ? getTrade(id) : null;
  if (id && !existing) return go('trades', true);
  const t = existing
    ? structuredClone(existing)
    : { id: uid(), createdAt: Date.now(), date: isoDate(), symbol: '', side: 'long', checks: emptyChecks(), sense: null, shots: [], note: '', status: 'open' };
  t.checks = { ...emptyChecks(), ...t.checks };
  t.shots ||= [];
  const isClosed = t.status === 'closed';
  const draft = isClosed ? draftFrom(t) : null;
  const pending = new Map(); // neue Screenshots: id -> Blob
  const removed = new Set();
  const urls = [];

  const symbols = recentSymbols();
  const lastSetup = [...state.trades].filter((x) => x.accountId === state.settings.active).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

  root.innerHTML = `<header class="topbar sub">
      <button class="tb-text" data-cancel>Abbrechen</button>
      <h1>${existing ? 'Trade bearbeiten' : 'Neuer Trade'}</h1>
      <div class="tb-right"></div>
    </header>
    <main class="page form">
      <section class="card">
        <label class="field"><span>Symbol</span>
          <input data-symbol value="${esc(t.symbol)}" placeholder="z. B. EURUSD" autocapitalize="characters" autocomplete="off" spellcheck="false">
        </label>
        ${symbols.length ? `<div class="chips quick">${symbols.map((s) => `<button type="button" class="chip sm" data-sym="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        <div class="seg two side-seg" data-side>
          <button type="button" data-v="long" class="${t.side === 'long' ? 'on up' : ''}">${icon('up')} Long</button>
          <button type="button" data-v="short" class="${t.side === 'short' ? 'on down' : ''}">${icon('down')} Short</button>
        </div>
        <label class="field"><span>Datum</span><input type="date" data-date value="${t.date}"></label>
      </section>

      ${!existing && lastSetup ? `<button type="button" class="copy-last" data-copy-last>${icon('copy')}<span>Setup vom letzten Trade übernehmen<small>${esc(lastSetup.symbol)} · ${lastSetup.date.split('-').reverse().slice(0, 2).join('.')}.</small></span></button>` : ''}

      <div class="sec-title"><h2>Bias</h2><span data-sec-state="bias"></span></div>
      <section class="card checks" data-sec="bias">${BIAS.map((g) => groupHtml(g, t.checks)).join('')}</section>

      <div class="sec-title"><h2>Entry</h2><span data-sec-state="entry"></span></div>
      <section class="card checks" data-sec="entry">${ENTRY.map((g) => groupHtml(g, t.checks)).join('')}</section>

      <div class="sec-title"><h2>Macht der Trade Sinn?</h2></div>
      <section class="card">
        <div class="sense" data-sense>${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-v="${n}" class="${t.sense === n ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="sense-label" data-sense-label>${t.sense ? SENSE_LABELS[t.sense] : 'Dein Gefühl, zählt nicht zu den Regeln'}</div>
      </section>

      <div class="sec-title"><h2>Screenshots</h2></div>
      <section class="card">
        <div class="shots" data-shots></div>
        <label class="btn ghost block file-btn">${icon('camera')} Screenshot hinzufügen
          <input type="file" accept="image/*" multiple data-file hidden>
        </label>
      </section>

      <div class="sec-title"><h2>Notiz</h2></div>
      <section class="card">
        <textarea data-note rows="4" placeholder="Gedanken, Plan, was dir auffällt …">${esc(t.note)}</textarea>
      </section>

      ${isClosed ? `<div class="sec-title"><h2>Ergebnis</h2></div><section class="card" data-result>${resultHtml(draft, t)}</section>` : ''}
    </main>
    <div class="savebar">
      <div class="savebar-status" data-status></div>
      <button class="btn primary block" data-save>${existing ? 'Speichern' : 'Trade speichern'}</button>
    </div>`;

  const $ = (s) => root.querySelector(s);

  // Basis
  const sym = $('[data-symbol]');
  sym.oninput = () => (t.symbol = sym.value.toUpperCase().replace(/\s+/g, ''));
  root.querySelectorAll('[data-sym]').forEach((b) => {
    b.onclick = () => {
      sym.value = t.symbol = b.dataset.sym;
    };
  });
  root.querySelectorAll('[data-side] button').forEach((b) => {
    b.onclick = () => {
      t.side = b.dataset.v;
      haptic();
      root.querySelectorAll('[data-side] button').forEach((x) => (x.className = ''));
      b.className = `on ${t.side === 'long' ? 'up' : 'down'}`;
    };
  });
  $('[data-date]').onchange = (e) => e.target.value && (t.date = e.target.value);

  // Checkliste
  let prevAll = null;
  const prevSec = {};
  const refreshChecks = () => {
    const first = prevAll === null;
    for (const g of [...BIAS, ...ENTRY]) {
      const ok = groupOk(g, t.checks);
      if (g.type === 'toggle') root.querySelector(`[data-toggle="${g.key}"]`)?.classList.toggle('on', !!t.checks[g.key]);
      else root.querySelectorAll(`[data-multi="${g.key}"]`).forEach((b) => b.classList.toggle('on', t.checks[g.key].includes(b.dataset.v)));
      const badge = root.querySelector(`[data-badge="${g.key}"]`);
      if (badge && badge.classList.contains('ok') !== ok) {
        badge.classList.toggle('ok', ok);
        badge.innerHTML = ok ? icon('check') : g.type === 'toggle' ? 'Pflicht' : 'mind. 1';
      }
    }
    for (const [sec, list] of [['bias', BIAS], ['entry', ENTRY]]) {
      const ok = list.every((g) => !g.required || groupOk(g, t.checks));
      if (prevSec[sec] !== ok) {
        root.querySelector(`[data-sec-state="${sec}"]`).innerHTML = ok ? `<span class="sec-ok">${icon('check')} erfüllt</span>` : '';
        root.querySelector(`[data-sec="${sec}"]`).classList.toggle('done', ok);
        prevSec[sec] = ok;
      }
    }
    const miss = missing(t.checks);
    const all = !miss.length;
    const bar = root.querySelector('.savebar');
    $('[data-status]').innerHTML = miss.length
      ? `<span class="st bad">${icon('x')} Fehlt: ${miss.map((g) => esc(g.label)).join(', ')}</span>`
      : `<span class="st ok">${icon('check')} Alle Regeln erfüllt</span>`;
    bar.classList.toggle('all', all);
    if (!first && all && !prevAll) {
      bar.classList.remove('celebrate');
      void bar.offsetWidth;
      bar.classList.add('celebrate');
      haptic(25);
      confetti({ count: 60, y: 0.92, power: 0.85, spread: 0.8 });
    }
    prevAll = all;
    if (draft) bindResult(root.querySelector('[data-result]'), draft, t);
  };
  root.addEventListener('click', (e) => {
    const tg = e.target.closest('[data-toggle]');
    if (tg || e.target.closest('[data-multi]')) haptic();
    if (tg) {
      t.checks[tg.dataset.toggle] = !t.checks[tg.dataset.toggle];
      refreshChecks();
      return;
    }
    const m = e.target.closest('[data-multi]');
    if (m) {
      const list = t.checks[m.dataset.multi];
      const i = list.indexOf(m.dataset.v);
      if (i >= 0) list.splice(i, 1);
      else list.push(m.dataset.v);
      refreshChecks();
    }
  });

  root.querySelector('[data-copy-last]')?.addEventListener('click', (e) => {
    t.checks = { ...emptyChecks(), ...structuredClone(lastSetup.checks) };
    if (!t.symbol) sym.value = t.symbol = lastSetup.symbol;
    t.side = lastSetup.side;
    root.querySelectorAll('[data-side] button').forEach((x) => (x.className = x.dataset.v === t.side ? `on ${t.side === 'long' ? 'up' : 'down'}` : ''));
    refreshChecks();
    e.currentTarget.remove();
    toast('Setup übernommen');
  });

  // Sinn
  root.querySelectorAll('[data-sense] button').forEach((b) => {
    b.onclick = () => {
      const n = Number(b.dataset.v);
      t.sense = t.sense === n ? null : n;
      haptic();
      root.querySelectorAll('[data-sense] button').forEach((x) => x.classList.toggle('on', Number(x.dataset.v) === t.sense));
      $('[data-sense-label]').textContent = t.sense ? SENSE_LABELS[t.sense] : 'Dein Gefühl, zählt nicht zu den Regeln';
    };
  });

  // Screenshots
  const shotsEl = $('[data-shots]');
  const renderShots = async () => {
    const ids = t.shots.filter((s) => !removed.has(s));
    const items = await Promise.all(ids.map(async (s) => [s, pending.get(s) || (await getImage(s))]));
    shotsEl.innerHTML = items
      .filter(([, b]) => b)
      .map(([s, b]) => {
        const u = URL.createObjectURL(b);
        urls.push(u);
        return `<div class="shot"><img src="${u}" alt="" data-view="${u}"><button type="button" class="shot-x" data-rm="${s}" aria-label="Entfernen">${icon('x')}</button></div>`;
      })
      .join('');
  };
  shotsEl.onclick = (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const s = rm.dataset.rm;
      if (pending.has(s)) {
        pending.delete(s);
        t.shots = t.shots.filter((x) => x !== s);
      } else removed.add(s);
      renderShots();
      return;
    }
    const v = e.target.closest('[data-view]');
    if (v) viewImage(v.dataset.view);
  };
  $('[data-file]').onchange = async (e) => {
    for (const f of e.target.files) {
      const s = uid();
      pending.set(s, await compressImage(f));
      t.shots.push(s);
    }
    e.target.value = '';
    renderShots();
  };
  renderShots();

  $('[data-note]').oninput = (e) => (t.note = e.target.value);

  // Abbrechen / Speichern
  const leave = () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    if (history.length > 1) history.back();
    else go(existing ? `trade/${t.id}` : 'trades', true);
  };
  let dirty = false;
  const mark = (e) => e.target.closest('main') && (dirty = true);
  root.addEventListener('input', mark);
  root.addEventListener('change', mark);
  root.addEventListener('click', (e) => e.target.closest('main button') && (dirty = true), true);
  $('[data-cancel]').onclick = async () => {
    if (dirty && !(await confirmSheet({ title: 'Änderungen verwerfen?', ok: 'Verwerfen', danger: true }))) return;
    leave();
  };
  $('[data-save]').onclick = async () => {
    if (!t.symbol) {
      toast('Symbol fehlt');
      sym.focus();
      return;
    }
    if (draft) {
      if (draft.amount == null) {
        toast('Betrag fehlt');
        return;
      }
      applyDraft(t, draft);
    }
    for (const [s, b] of pending) await putImage(s, b);
    for (const s of removed) await delImage(s);
    t.shots = t.shots.filter((s) => !removed.has(s));
    await saveTrade(t);
    toast(existing ? 'Gespeichert' : 'Trade angelegt · offen');
    leave();
  };

  refreshChecks();
}
