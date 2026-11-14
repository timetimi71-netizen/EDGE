// App-Zustand im Speicher, gespiegelt in IndexedDB.
import { db } from './db.js';

export const state = {
  trades: [],
  settings: { account: null, riskPct: 1 },
};

export async function load() {
  const [trades, meta] = await Promise.all([db.all('trades'), db.get('meta', 'settings')]);
  state.trades = trades;
  if (meta) state.settings = { ...state.settings, ...meta.v };
}

export async function saveTrade(t) {
  t.updatedAt = Date.now();
  const i = state.trades.findIndex((x) => x.id === t.id);
  if (i >= 0) state.trades[i] = t;
  else state.trades.push(t);
  await db.put('trades', t);
  persist();
}

export async function deleteTrade(id) {
  const t = state.trades.find((x) => x.id === id);
  state.trades = state.trades.filter((x) => x.id !== id);
  await db.del('trades', id);
  for (const s of t?.shots || []) await db.del('images', s);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.put('meta', { k: 'settings', v: state.settings });
}

export const getTrade = (id) => state.trades.find((t) => t.id === id);

export async function putImage(id, blob) {
  await db.put('images', { id, blob });
}

export async function getImage(id) {
  return (await db.get('images', id))?.blob || null;
}

export const delImage = (id) => db.del('images', id);

export function defaultRisk() {
  const { account, riskPct } = state.settings;
  return account > 0 ? Math.round(account * (riskPct || 1)) / 100 : null;
}

export async function wipe() {
  await Promise.all([db.clear('trades'), db.clear('images')]);
  state.trades = [];
}

// Safari löscht sonst nach längerer Nichtnutzung eventuell Daten
let persisted = false;
function persist() {
  if (persisted) return;
  persisted = true;
  navigator.storage?.persist?.().catch(() => {});
}
