// Backup als Datei: Trades, Screenshots, Einstellungen, Rückblicke
import { state, saveSettings, wipe, putImage, migrate, setReviews } from './store.js';
import { db } from './db.js';
import { toast, confirmSheet } from './ui.js';

const blobToB64 = (b) =>
  new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(b);
  });

export async function exportBackup() {
  const images = await db.all('images');
  const data = {
    app: 'vanta',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    trades: state.trades,
    reviews: state.reviews,
    images: await Promise.all(images.map(async (i) => ({ id: i.id, data: await blobToB64(i.blob) }))),
  };
  const name = `vanta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Vanta Backup' });
      await saveSettings({ lastBackup: Date.now() });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  await saveSettings({ lastBackup: Date.now() });
  return true;
}

export async function importBackup(file) {
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
  await setReviews(data.reviews);
  toast('Backup geladen');
  return true;
}

