// Einstellungen: Konto, Backup, Daten
import { state, saveSettings, saveTrade, wipe, putImage, defaultRisk } from '../store.js';
import { db } from '../db.js';
import { esc, icon, parseNum, toast, confirmSheet, topbar, fmtEur } from '../ui.js';
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
  if (data.settings) await saveSettings(data.settings);
  toast('Backup geladen');
}

export function settingsView(root) {
  const { account, riskPct } = state.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const hasDemo = state.trades.some((t) => t.demo);

  root.innerHTML = `${topbar({ title: 'Mehr' })}
    <main class="page">
      ${standalone ? '' : `<section class="card install">
        <b>Als App installieren</b>
        <p class="muted">In Safari auf <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>. Danach startet Vanta wie eine App und läuft offline.</p>
      </section>`}

      <div class="sec-title"><h2>Konto</h2></div>
      <section class="card">
        <label class="field"><span>Kontogröße</span>
          <div class="input-unit"><input data-account inputmode="decimal" placeholder="z. B. 10000" value="${account ?? ''}"><em>€</em></div>
        </label>
        <label class="field"><span>Risiko pro Trade</span>
          <div class="input-unit"><input data-risk inputmode="decimal" value="${String(riskPct ?? 1).replace('.', ',')}"><em>%</em></div>
        </label>
        <p class="hint" data-risk-hint>${defaultRisk() ? `1 R = ${fmtEur(defaultRisk(), false)}. Wird beim Abschließen vorgeschlagen und lässt sich pro Trade ändern.` : 'Daraus rechnet Vanta dein Ergebnis in R.'}</p>
      </section>

      <div class="sec-title"><h2>Daten</h2></div>
      <section class="card list-card">
        <button class="list-btn" data-export>${icon('up')}<span>Backup erstellen<small>Alles als Datei sichern, z. B. in iCloud Drive</small></span></button>
        <label class="list-btn">${icon('down')}<span>Backup laden<small>Ersetzt die Trades auf diesem Gerät</small></span><input type="file" accept="application/json,.json" data-import hidden></label>
        ${hasDemo
          ? `<button class="list-btn" data-demo-del>${icon('trash')}<span>Beispieldaten entfernen</span></button>`
          : `<button class="list-btn" data-demo>${icon('stats')}<span>Beispieldaten laden<small>48 erfundene Trades, um die Statistik zu sehen</small></span></button>`}
        <button class="list-btn danger" data-wipe>${icon('trash')}<span>Alle Trades löschen</span></button>
      </section>
      <p class="hint center">Alles bleibt nur auf diesem Gerät. ${state.trades.length} Trades gespeichert.<br>Vanta 1.0</p>
    </main>`;

  const acc = root.querySelector('[data-account]');
  const risk = root.querySelector('[data-risk]');
  const hint = root.querySelector('[data-risk-hint]');
  const saveAcc = async () => {
    await saveSettings({ account: parseNum(acc.value), riskPct: parseNum(risk.value) || 1 });
    hint.textContent = defaultRisk() ? `1 R = ${fmtEur(defaultRisk(), false)}. Wird beim Abschließen vorgeschlagen und lässt sich pro Trade ändern.` : 'Daraus rechnet Vanta dein Ergebnis in R.';
  };
  acc.onchange = saveAcc;
  risk.onchange = saveAcc;

  root.querySelector('[data-export]').onclick = () => exportBackup().catch(() => toast('Backup fehlgeschlagen'));
  root.querySelector('[data-import]').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) {
      await importBackup(f);
      settingsView(root);
    }
  };
  root.querySelector('[data-demo]')?.addEventListener('click', async () => {
    for (const t of demoTrades(defaultRisk() || 100)) await saveTrade(t);
    toast('Beispieldaten geladen');
    settingsView(root);
  });
  root.querySelector('[data-demo-del]')?.addEventListener('click', async () => {
    const demo = state.trades.filter((t) => t.demo);
    for (const t of demo) await db.del('trades', t.id);
    state.trades = state.trades.filter((t) => !t.demo);
    toast('Beispieldaten entfernt');
    settingsView(root);
  });
  root.querySelector('[data-wipe]').onclick = async () => {
    if (!(await confirmSheet({ title: 'Alle Trades löschen?', text: 'Das lässt sich nicht rückgängig machen. Mach vorher ein Backup.', ok: 'Alles löschen', danger: true }))) return;
    await wipe();
    toast('Alles gelöscht');
    settingsView(root);
  };
}
