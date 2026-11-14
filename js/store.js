// App-Zustand im Speicher, gespiegelt in IndexedDB.
import { db } from './db.js';
import { uid } from './model.js';

export const state = {
  trades: [],
  settings: { name: '', accounts: [], active: null },
};

export function newAccount(patch = {}) {
  return { id: uid(), name: 'Mein Konto', size: null, riskPct: 1, targetPct: null, maxLossPct: null, createdAt: Date.now(), ...patch };
}

// Ältere Daten (Kontogröße direkt in den Einstellungen, Trades ohne Konto) übernehmen
export async function migrate() {
  const s = state.settings;
  let dirty = false;
  if (!Array.isArray(s.accounts) || !s.accounts.length) {
    s.accounts = [newAccount({ size: s.account ?? null, riskPct: s.riskPct ?? 1 })];
    dirty = true;
  }
  if ('account' in s || 'riskPct' in s) {
    delete s.account;
    delete s.riskPct;
    dirty = true;
  }
  if (!s.accounts.some((a) => a.id === s.active)) {
    s.active = s.accounts[0].id;
    dirty = true;
  }
  if (dirty) await db.put('meta', { k: 'settings', v: s });
  const ids = new Set(s.accounts.map((a) => a.id));
  const orphans = state.trades.filter((t) => !ids.has(t.accountId));
  if (orphans.length) {
    orphans.forEach((t) => (t.accountId = s.active));
    await db.putMany('trades', orphans);
  }
}

export async function load() {
  const [trades, meta] = await Promise.all([db.all('trades'), db.get('meta', 'settings')]);
  state.trades = trades;
  if (meta) state.settings = { ...state.settings, ...meta.v };
  await migrate();
}

export const activeAccount = () => state.settings.accounts.find((a) => a.id === state.settings.active);
export const accTrades = (id = state.settings.active) => state.trades.filter((t) => t.accountId === id);

export async function saveTrade(t) {
  t.updatedAt = Date.now();
  t.accountId ||= state.settings.active;
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

export async function saveAccount(acc) {
  const list = [...state.settings.accounts];
  const i = list.findIndex((a) => a.id === acc.id);
  if (i >= 0) list[i] = acc;
  else list.push(acc);
  await saveSettings({ accounts: list });
}

export async function setActive(id) {
  await saveSettings({ active: id });
}

// Konto samt seiner Trades löschen. Das letzte Konto bleibt immer stehen.
export async function deleteAccount(id) {
  const list = state.settings.accounts.filter((a) => a.id !== id);
  if (!list.length) return;
  for (const t of accTrades(id)) await deleteTrade(t.id);
  await saveSettings({ accounts: list, active: state.settings.active === id ? list[0].id : state.settings.active });
}

export const getTrade = (id) => state.trades.find((t) => t.id === id);

export async function putImage(id, blob) {
  await db.put('images', { id, blob });
}

export async function getImage(id) {
  return (await db.get('images', id))?.blob || null;
}

export const delImage = (id) => db.del('images', id);

export function defaultRisk(acc = activeAccount()) {
  return acc?.size > 0 ? Math.round(acc.size * (acc.riskPct || 1)) / 100 : null;
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
