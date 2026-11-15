// Einstellungen: Konto, Backup, Daten
import { state, saveSettings, saveTrade, wipe, accTrades, saveAccount, setActive, deleteAccount, newAccount } from '../store.js';
import { exportBackup, importBackup } from '../backup.js';
import { accountState } from '../model.js';
import { editAccount } from '../accounts.js';
import { esc, icon, toast, confirmSheet, topbar, fmtEur } from '../ui.js';
import { demoTrades, DEMO_REVIEWS } from '../demo.js';
import { weekKey } from '../model.js';
import { saveReview } from '../store.js';

export function settingsView(root) {
  const { accounts, active, name } = state.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const hasDemo = accounts.some((a) => a.demo);

  root.innerHTML = `${topbar({ title: 'Einstellungen', back: '#/home' })}
    <main class="page">
      ${standalone ? '' : `<section class="card install">
        <b>Als App installieren</b>
        <p class="muted">In Safari auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>. Danach startet Vanta wie eine App und läuft offline.</p>
      </section>`}

      <div class="sec-title"><h2>Profil</h2></div>
      <section class="card">
        <label class="field"><span>Dein Name</span><input data-name value="${esc(name || '')}" placeholder="für die Begrüßung" autocomplete="off"></label>
      </section>

      <div class="sec-title"><h2>Konten</h2></div>
      <section class="card list-card">
        ${accounts
          .map((a) => {
            const st = accountState(a, accTrades(a.id));
            const meta = [a.size ? `Start ${fmtEur(a.size, false)}` : 'Startkapital fehlt', `${String(a.riskPct || 1).replace('.', ',')} % Risiko`];
            if (a.targetPct) meta.push(`Ziel ${String(a.targetPct).replace('.', ',')} %`);
            if (a.maxLossPct) meta.push(`Max. ${String(a.maxLossPct).replace('.', ',')} %`);
            return `<button class="list-btn" data-acc="${a.id}">
              <span class="acc-dot ${a.id === active ? 'on' : ''}"></span>
              <span>${esc(a.name)}<small>${meta.join(' · ')} · ${st.closed.length + st.open.length} Trades</small></span>
              ${icon('chevron')}
            </button>`;
          })
          .join('')}
        <button class="list-btn" data-acc-new>${icon('plus')}<span>Neues Konto</span></button>
      </section>

      <div class="sec-title"><h2>Daten</h2></div>
      <section class="card list-card">
        <button class="list-btn" data-export>${icon('up')}<span>Backup erstellen<small>Alles als Datei sichern, z. B. in iCloud Drive</small></span></button>
        <label class="list-btn">${icon('down')}<span>Backup laden<small>Ersetzt alles auf diesem Gerät</small></span><input type="file" accept="application/json,.json" data-import hidden></label>
        ${hasDemo
          ? `<button class="list-btn" data-demo-del>${icon('trash')}<span>Demo-Konto entfernen</span></button>`
          : `<button class="list-btn" data-demo>${icon('stats')}<span>Demo-Konto anlegen<small>100k-Konto mit 48 erfundenen Trades zum Ausprobieren</small></span></button>`}
        <button class="list-btn danger" data-wipe>${icon('trash')}<span>Alle Trades löschen</span></button>
      </section>
      <p class="hint center">Alles bleibt nur auf diesem Gerät. ${state.trades.length} Trades gespeichert.<br>Vanta 1.3</p>
    </main>`;

  const rerender = () => settingsView(root);
  root.querySelector('[data-name]').onchange = (e) => saveSettings({ name: e.target.value.trim() });
  root.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => editAccount(b.dataset.acc, rerender)));
  root.querySelector('[data-acc-new]').onclick = () => editAccount(null, rerender);

  root.querySelector('[data-export]').onclick = () => exportBackup().catch(() => toast('Backup fehlgeschlagen'));
  root.querySelector('[data-import]').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) {
      await importBackup(f);
      rerender();
    }
  };
  root.querySelector('[data-demo]')?.addEventListener('click', async () => {
    const acc = newAccount({ name: 'Demo 100k', size: 100000, riskPct: 0.25, targetPct: 10, maxLossPct: 10, demo: true });
    await saveAccount(acc);
    await setActive(acc.id);
    for (const t of demoTrades(250)) await saveTrade({ ...t, accountId: acc.id });
    const wk = new Date();
    wk.setDate(wk.getDate() - 14);
    await saveReview(weekKey(wk), DEMO_REVIEWS[0], acc.id);
    wk.setDate(wk.getDate() + 7);
    await saveReview(weekKey(wk), DEMO_REVIEWS[1], acc.id);
    toast('Demo-Konto angelegt');
    location.hash = '#/home';
  });
  root.querySelector('[data-demo-del]')?.addEventListener('click', async () => {
    for (const a of state.settings.accounts.filter((x) => x.demo)) {
      if (state.settings.accounts.length === 1) await saveAccount(newAccount());
      await deleteAccount(a.id);
    }
    toast('Demo-Konto entfernt');
    rerender();
  });
  root.querySelector('[data-wipe]').onclick = async () => {
    if (!(await confirmSheet({ title: 'Alle Trades löschen?', text: 'Trades aller Konten werden gelöscht. Das lässt sich nicht rückgängig machen. Mach vorher ein Backup.', ok: 'Alles löschen', danger: true }))) return;
    await wipe();
    toast('Alles gelöscht');
    rerender();
  };
}
