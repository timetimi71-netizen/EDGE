// Konten: wechseln, anlegen, bearbeiten
import { state, accTrades, saveAccount, setActive, deleteAccount, newAccount, defaultRisk } from './store.js';
import { accountState } from './model.js';
import { esc, icon, sheet, toast, parseNum, fmtEur, confirmSheet } from './ui.js';

const fmtIn = (v) => (v == null ? '' : String(v).replace('.', ','));

export function openAccounts(done) {
  const { accounts, active } = state.settings;
  const w = sheet(`<div class="sheet-body">
      <h3>Konten</h3>
      <div class="acc-list">
        ${accounts
          .map((a) => {
            const st = accountState(a, accTrades(a.id));
            return `<button class="acc-item ${a.id === active ? 'on' : ''}" data-pick="${a.id}">
              <span class="acc-radio"></span>
              <span class="acc-item-main"><b>${esc(a.name)}</b><small>${a.size ? fmtEur(st.bal, false) : 'Startkapital fehlt'} · ${st.closed.length} Trades</small></span>
              <span class="acc-edit" data-edit="${a.id}" role="button" aria-label="Bearbeiten">${icon('edit')}</span>
            </button>`;
          })
          .join('')}
      </div>
      <div class="sheet-actions"><button class="btn ghost block" data-add>${icon('plus')} Neues Konto</button></div>
    </div>`);
  w.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      e.stopPropagation();
      w.close();
      setTimeout(() => editAccount(ed.dataset.edit, done), 200);
      return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      await setActive(pick.dataset.pick);
      w.close();
      done?.();
      return;
    }
    if (e.target.closest('[data-add]')) {
      w.close();
      setTimeout(() => editAccount(null, done), 200);
    }
  });
}

export function editAccount(id, done) {
  const existing = id ? state.settings.accounts.find((a) => a.id === id) : null;
  const a = existing ? { ...existing } : newAccount({ name: '' });
  const canDelete = existing && state.settings.accounts.length > 1;
  const w = sheet(`<div class="sheet-body">
      <h3>${existing ? 'Konto bearbeiten' : 'Neues Konto'}</h3>
      <div class="form-list">
        <label class="field"><span>Name</span><input data-f="name" value="${esc(a.name)}" placeholder="z. B. FTMO 100k" autocomplete="off"></label>
        <label class="field"><span>Startkapital</span><div class="input-unit"><input data-f="size" inputmode="decimal" value="${fmtIn(a.size)}" placeholder="10000"><em>€</em></div></label>
        <label class="field"><span>Risiko pro Trade</span><div class="input-unit"><input data-f="riskPct" inputmode="decimal" value="${fmtIn(a.riskPct)}"><em>%</em></div></label>
        <label class="field"><span>Profitziel <small>optional</small></span><div class="input-unit"><input data-f="targetPct" inputmode="decimal" value="${fmtIn(a.targetPct)}" placeholder="z. B. 10"><em>%</em></div></label>
        <label class="field"><span>Max. Verlust <small>optional</small></span><div class="input-unit"><input data-f="maxLossPct" inputmode="decimal" value="${fmtIn(a.maxLossPct)}" placeholder="z. B. 10"><em>%</em></div></label>
      </div>
      <p class="hint" data-hint></p>
      <div class="sheet-actions">
        <button class="btn primary block" data-save>Speichern</button>
        ${canDelete ? `<button class="btn danger-ghost block" data-del>${icon('trash')} Konto löschen</button>` : ''}
      </div>
    </div>`);
  const hint = w.querySelector('[data-hint]');
  const read = () => {
    const v = (k) => w.querySelector(`[data-f="${k}"]`).value;
    a.name = v('name').trim();
    a.size = parseNum(v('size'));
    a.riskPct = parseNum(v('riskPct')) || 1;
    a.targetPct = parseNum(v('targetPct'));
    a.maxLossPct = parseNum(v('maxLossPct'));
    const r = defaultRisk(a);
    const parts = [];
    if (r) parts.push(`1 R = ${fmtEur(r, false)}`);
    if (a.size && a.targetPct) parts.push(`Ziel ${fmtEur((a.size * a.targetPct) / 100, false)}`);
    if (a.size && a.maxLossPct) parts.push(`Grenze bei ${fmtEur(a.size * (1 - a.maxLossPct / 100), false)}`);
    hint.textContent = parts.join(' · ') || 'Aus Startkapital und Risiko rechnet Vanta dein Ergebnis in R.';
  };
  w.addEventListener('input', read);
  read();
  if (!existing) setTimeout(() => w.querySelector('[data-f="name"]').focus(), 300);
  w.querySelector('[data-save]').onclick = async () => {
    read();
    a.name ||= 'Mein Konto';
    await saveAccount(a);
    if (!existing) await setActive(a.id);
    w.close();
    toast(existing ? 'Konto gespeichert' : 'Konto angelegt');
    done?.();
  };
  w.querySelector('[data-del]')?.addEventListener('click', async () => {
    const n = accTrades(a.id).length;
    w.close();
    const ok = await confirmSheet({
      title: `„${existing.name}“ löschen?`,
      text: n ? `Die ${n} Trades in diesem Konto werden mitgelöscht.` : 'Das Konto ist leer.',
      ok: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteAccount(a.id);
    toast('Konto gelöscht');
    done?.();
  });
}
