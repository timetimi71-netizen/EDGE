// Edge · Datenhaltung. Alles liegt in IndexedDB auf dem Gerät und wird beim Start in den Arbeitsspeicher geladen.
import { uid, iso, blobToDataURL, dataURLToBlob } from './util.js';

export const S = {
  accounts: new Map(), // id -> Konto bzw. Challenge
  trades: new Map(), // id -> Trade
  days: new Map(), // Datum -> Marktplan und Rückblick
  pics: new Set(), // ids der gespeicherten Bilder (Trade-id oder plan:Datum)
  settings: null,
  memoryOnly: false,
};

export const DEFAULTS = {
  name: '',
  look: 'light',
  accent: 'kobalt',
  haptics: true,
  reduceMotion: false,
  activeAccount: null,
  risk: 1, // Standard-Risiko pro Trade in %
  symbols: ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'NAS100', 'US30', 'GER40', 'GBPJPY'],
  // Kontraktgröße pro 1,0 Lot: wie viele Einheiten der Basiswährung bzw. wie viel pro Punkt
  contracts: { XAUUSD: 100, XAGUSD: 5000, NAS100: 1, US100: 1, US30: 1, US500: 1, SPX500: 1, GER40: 1, DE40: 1, UK100: 1, BTCUSD: 1, ETHUSD: 1, USOIL: 1000, WTI: 1000 },
  // ungefähre Kurse in USD, nur für Risiko- und Lotberechnung bei Kreuzpaaren
  rates: { EUR: 1.08, GBP: 1.27, CHF: 1.13, JPY: 0.0066, CAD: 0.73, AUD: 0.66, NZD: 0.6 },
  setups: ['Breakout', 'Pullback', 'Trendfolge', 'Range', 'Reversal', 'Liquidity Sweep'],
  mistakes: ['FOMO', 'Zu früh raus', 'SL verschoben', 'Kein SL', 'Revenge', 'Zu großes Risiko', 'Gegen den Trend', 'Overtrading', 'News ignoriert', 'Plan nicht befolgt'],
  rules: [
    { id: 'plan', text: 'Der Trade steht in meinem Marktplan' },
    { id: 'sl', text: 'Stop-Loss ist gesetzt, bevor ich einsteige' },
    { id: 'risk', text: 'Risiko höchstens 1 % vom Konto' },
    { id: 'rr', text: 'Chance mindestens doppelt so groß wie das Risiko' },
    { id: 'news', text: 'Keine wichtigen News in den nächsten 30 Minuten' },
  ],
  limits: { maxTrades: 3, stopAfterLosses: 2 },
  geminiKey: '',
  geminiModel: '',
  pinHash: null,
  pinSalt: null,
  lockAfter: 60,
  onboarded: false,
  lastBackup: null,
  demoLoaded: false,
  installHintDismissed: false,
};

export const hooks = { onError: null };

/* ---------- IndexedDB ---------- */
let db = null;
const memPics = new Map();
const wrap = (r) =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('edge', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const [name, keyPath] of [
        ['accounts', 'id'],
        ['trades', 'id'],
        ['days', 'date'],
        ['pics', 'id'],
        ['meta', 'key'],
      ]) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath });
      }
    };
    r.onsuccess = () => {
      const d = r.result;
      d.onversionchange = () => {
        d.close();
        if (db === d) db = null;
      };
      d.onclose = () => {
        if (db === d) db = null;
      };
      res(d);
    };
    r.onerror = () => rej(r.error);
    r.onblocked = () => console.warn('IndexedDB wartet auf ältere Edge-Seite');
  });
}
// Verbindung holen. iOS trennt sie manchmal, während die App im Hintergrund liegt – dann einmal neu öffnen.
let reopening = null;
function getDB() {
  if (db || S.memoryOnly) return Promise.resolve(db);
  reopening ||= openDB()
    .then((d) => (db = d))
    .finally(() => {
      reopening = null;
    });
  return reopening;
}
const lost = (e) => ['InvalidStateError', 'UnknownError', 'TransactionInactiveError'].includes(e?.name);
async function run(name, mode, fn) {
  for (let i = 0; ; i++) {
    const d = await getDB();
    if (!d) return undefined;
    try {
      return await fn(d.transaction(name, mode));
    } catch (e) {
      if (i || !lost(e)) throw e;
      if (db === d) db = null;
    }
  }
}
const req = (name, mode, fn) => run(name, mode, (tx) => wrap(fn(tx.objectStore(name))));
const getAll = (name) => req(name, 'readonly', (s) => s.getAll()).then((r) => r || []);
const getAllKeys = (name) => req(name, 'readonly', (s) => s.getAllKeys()).then((r) => r || []);
const getOne = (name, key) => req(name, 'readonly', (s) => s.get(key));

let errorShown = false;
function report(e) {
  console.error(e);
  if (!errorShown) {
    errorShown = true;
    hooks.onError?.(e);
  }
}
const put = (name, value) => req(name, 'readwrite', (s) => s.put(value)).catch(report);
const remove = (name, key) => req(name, 'readwrite', (s) => s.delete(key)).catch(report);
const clear = (name) => req(name, 'readwrite', (s) => s.clear()).catch(report);
export async function putMany(name, values) {
  if (!values.length) return;
  await run(
    name,
    'readwrite',
    (tx) =>
      new Promise((res, rej) => {
        const os = tx.objectStore(name);
        values.forEach((v) => os.put(v));
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      }),
  );
}

export async function loadAll() {
  try {
    db = await openDB();
  } catch (e) {
    console.warn('IndexedDB nicht verfügbar – Daten nur im Arbeitsspeicher', e);
    db = null;
    S.memoryOnly = true;
  }
  try {
    const [ac, tr, dy, pk, meta] = await Promise.all([getAll('accounts'), getAll('trades'), getAll('days'), getAllKeys('pics'), getAll('meta')]);
    ac.forEach((a) => S.accounts.set(a.id, a));
    tr.forEach((t) => S.trades.set(t.id, t));
    dy.forEach((d) => S.days.set(d.date, d));
    pk.forEach((k) => S.pics.add(k));
    S.settings = mergeSettings(meta.find((m) => m.key === 'settings')?.value);
  } catch (e) {
    console.error(e);
    S.settings = mergeSettings();
  }
  reindex();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

export function mergeSettings(st = {}) {
  return {
    ...DEFAULTS,
    ...st,
    contracts: { ...DEFAULTS.contracts, ...st.contracts },
    rates: { ...DEFAULTS.rates, ...st.rates },
    limits: { ...DEFAULTS.limits, ...st.limits },
    rules: Array.isArray(st.rules) ? st.rules : DEFAULTS.rules.map((r) => ({ ...r })),
    setups: Array.isArray(st.setups) ? st.setups : [...DEFAULTS.setups],
    mistakes: Array.isArray(st.mistakes) ? st.mistakes : [...DEFAULTS.mistakes],
    symbols: Array.isArray(st.symbols) ? st.symbols : [...DEFAULTS.symbols],
  };
}
export function saveSettings(patch) {
  S.settings = { ...S.settings, ...patch };
  return put('meta', { key: 'settings', value: S.settings });
}

/* ---------- Konten ---------- */
export const activeAccount = () => S.accounts.get(S.settings.activeAccount) || [...S.accounts.values()].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
export function saveAccount(a) {
  const e = { createdAt: Date.now(), status: 'aktiv', ...a, id: a.id || uid(), updatedAt: Date.now() };
  S.accounts.set(e.id, e);
  put('accounts', e);
  return e;
}
export async function deleteAccount(id) {
  const trades = [...S.trades.values()].filter((t) => t.accountId === id);
  for (const t of trades) await deleteTrade(t.id);
  S.accounts.delete(id);
  await remove('accounts', id);
  if (S.settings.activeAccount === id) await saveSettings({ activeAccount: activeAccount()?.id || null });
}

/* ---------- Trades ----------
   Index: Handelstag -> Trades (nach Schließzeit). Der Handelstag hängt am Tageswechsel des Kontos. */
export const byDay = new Map();
export function reindex() {
  byDay.clear();
  for (const t of S.trades.values()) {
    if (!byDay.has(t.day)) byDay.set(t.day, []);
    byDay.get(t.day).push(t);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.closeAt - b.closeAt);
}
export const tradesOn = (day, accountId = null) => (byDay.get(day) || []).filter((t) => !accountId || t.accountId === accountId);
export const accountTrades = (accountId) => [...S.trades.values()].filter((t) => t.accountId === accountId).sort((a, b) => a.closeAt - b.closeAt);
export function saveTrade(t) {
  const e = { createdAt: Date.now(), ...t, id: t.id || uid(), updatedAt: Date.now() };
  S.trades.set(e.id, e);
  reindex();
  put('trades', e);
  return e;
}
export async function deleteTrade(id) {
  S.trades.delete(id);
  reindex();
  await remove('trades', id);
  if (S.pics.has(id)) await deletePic(id);
}

/* ---------- Tage: Marktplan und Rückblick ---------- */
// Was du selbst schreibst, ist kein Beispiel mehr und bleibt beim Entfernen der Beispieldaten erhalten
const ownDay = (date) => {
  const { demo, ...prev } = S.days.get(date) || {};
  return prev;
};
export function saveDay(date, patch) {
  const e = { date, ...ownDay(date), ...patch, updatedAt: Date.now() };
  S.days.set(date, e);
  put('days', e);
  return e;
}
const pending = new Map();
// Beim Tippen verzögert speichern, immer den aktuellen Stand aus dem Arbeitsspeicher
export function saveDaySoon(date, patch) {
  const e = { date, ...ownDay(date), ...patch, updatedAt: Date.now() };
  S.days.set(date, e);
  clearTimeout(pending.get(date));
  pending.set(
    date,
    setTimeout(() => {
      pending.delete(date);
      put('days', S.days.get(date));
    }, 400),
  );
}
export function flushWrites() {
  for (const [date, t] of pending) {
    clearTimeout(t);
    put('days', S.days.get(date));
  }
  pending.clear();
}

/* ---------- Bilder ----------
   Als ArrayBuffer gespeichert: Blobs in IndexedDB machen auf älteren iPhones Ärger. */
const urls = new Map();
export async function savePic(id, blob) {
  const rec = { id, data: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' };
  if (!S.memoryOnly) await put('pics', rec);
  else memPics.set(id, rec);
  S.pics.add(id);
  dropURL(id);
}
const picRecord = (id) => (S.memoryOnly ? memPics.get(id) : getOne('pics', id));
export async function picURL(id) {
  if (!S.pics.has(id)) return null;
  if (urls.has(id)) return urls.get(id);
  const rec = await picRecord(id);
  if (!rec) return null;
  const url = URL.createObjectURL(new Blob([rec.data], { type: rec.type }));
  urls.set(id, url);
  return url;
}
function dropURL(id) {
  const u = urls.get(id);
  if (u) {
    URL.revokeObjectURL(u);
    urls.delete(id);
  }
}
export async function deletePic(id) {
  S.pics.delete(id);
  memPics.delete(id);
  dropURL(id);
  await remove('pics', id);
}

/* ---------- Alles löschen, Beispieldaten ---------- */
export async function wipeAll() {
  S.accounts.clear();
  S.trades.clear();
  S.days.clear();
  S.pics.clear();
  memPics.clear();
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  reindex();
  await Promise.all(['accounts', 'trades', 'days', 'pics', 'meta'].map(clear));
  S.settings = mergeSettings();
}
export async function removeDemo() {
  // Eigene Trades in einem Beispielkonto: das Konto bleibt, damit nichts verloren geht
  for (const t of S.trades.values()) {
    const a = S.accounts.get(t.accountId);
    if (!t.demo && a?.demo) {
      const { demo, ...keep } = a;
      S.accounts.set(a.id, keep);
      await put('accounts', keep);
    }
  }
  for (const [name, map] of [
    ['accounts', S.accounts],
    ['trades', S.trades],
    ['days', S.days],
  ]) {
    for (const [k, v] of [...map]) {
      if (!v.demo) continue;
      map.delete(k);
      await remove(name, k);
      if (name === 'trades' && S.pics.has(k)) await deletePic(k);
    }
  }
  reindex();
  const a = activeAccount();
  await saveSettings({ demoLoaded: false, activeAccount: a?.id || null });
}
export const hasDemo = () => [S.accounts, S.trades, S.days].some((m) => [...m.values()].some((e) => e.demo));

/* ---------- Backup ---------- */
export async function buildBackup() {
  const pics = [];
  for (const id of S.pics) {
    const rec = await picRecord(id);
    if (rec) pics.push({ id, data: await blobToDataURL(new Blob([rec.data], { type: rec.type })) });
  }
  const { pinHash, pinSalt, ...settings } = S.settings;
  // Der Gemini-Schlüssel bleibt auf dem Gerät und landet nicht in der Backup-Datei.
  settings.geminiKey = '';
  settings.geminiModel = '';
  return {
    app: 'edge',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    accounts: [...S.accounts.values()],
    trades: [...S.trades.values()],
    days: [...S.days.values()],
    pics,
  };
}

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
// IDs landen in HTML-Attributen: aus fremden Dateien nur harmlose Formate übernehmen
const isId = (v) => typeof v === 'string' && /^[\w:-]{1,80}$/.test(v);
export async function restoreBackup(data) {
  if (!data || data.app !== 'edge') throw new Error('Diese Datei ist kein Edge-Backup.');
  const accounts = (data.accounts || []).filter((a) => a && isId(a.id) && Number.isFinite(a.size));
  const trades = (data.trades || []).filter((t) => t && isId(t.id) && isId(t.accountId) && Number.isFinite(t.pnl) && Number.isFinite(t.closeAt) && isDate(t.day));
  const days = (data.days || []).filter((d) => d && isDate(d.date));
  accounts.forEach((a) => S.accounts.set(a.id, a));
  trades.forEach((t) => S.trades.set(t.id, t));
  days.forEach((d) => S.days.set(d.date, d));
  reindex();
  await putMany('accounts', accounts);
  await putMany('trades', trades);
  await putMany('days', days);
  let pics = 0;
  for (const p of data.pics || []) {
    if (!isId(p?.id) || !p.data) continue;
    await savePic(p.id, dataURLToBlob(p.data));
    pics++;
  }
  if (data.settings) {
    const { pinHash, pinSalt, onboarded, demoLoaded, geminiKey, geminiModel, ...rest } = data.settings;
    const merged = mergeSettings({ ...S.settings, ...rest });
    merged.geminiKey = S.settings.geminiKey;
    merged.geminiModel = S.settings.geminiModel;
    if (!S.accounts.has(merged.activeAccount)) merged.activeAccount = accounts[0]?.id || S.settings.activeAccount;
    await saveSettings(merged);
  }
  return { accounts: accounts.length, trades: trades.length, days: days.length, pics };
}
export const todayISO = () => iso(new Date());
