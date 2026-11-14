// Einstellungen: Konto, Backup, Daten
import { state, saveSettings, saveTrade, wipe, putImage, migrate, accTrades, saveAccount, setActive, deleteAccount, newAccount } from '../store.js';
import { accountState } from '../model.js';
import { editAccount } from '../accounts.js';
import { db } from '../db.js';
import { esc, icon, toast, confirmSheet, topbar, fmtEur } from '../ui.js';
import { demoTrades } from '../demo.js';

const blobToB64 = (b) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(b);
  });

async function exportBackup() {
  const images = await db.all('images');
  const data = {
    app: 'vanta',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    trades: state.trades,
    images: await Promise.all(images.map(async (i) => ({ id: i.id, data: await blobToB64(i.blob) }))),
  };
  const name = `vanta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Vanta Backup' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return toast('Datei ist kein Vanta-Backup');
  }
  if (data?.app !== 'vanta' || !Array.isArray(data.trades)) return toast('Datei ist kein Vanta-Backup');
  const ok = await confirmSheet({
    title: 'Backup laden?',
    text: `${data.trades.length} Trades aus dem Backup ersetzen alle Trades auf diesem Gerät.`,
    ok: 'Ersetzen',
    danger: true,
  });
  if (!ok) return;
  await wipe();
  for (const i of data.images || []) {
    const blob = await (await fetch(i.data)).blob();
    await putImage(i.id, blob);
  }
  await db.putMany('trades', data.trades);
  state.trades = data.trades;
  state.settings = { name: '', accounts: [], active: null, ...(data.settings || {}) };
  await migrate();
  await saveSettings({});
  toast('Backup geladen');
}

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
      <p class="hint center">Alles bleibt nur auf diesem Gerät. ${state.trades.length} Trades gespeichert.<br>Vanta 1.1</p>
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
