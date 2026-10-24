// Edge · MT5 automatisch: Ein GitHub-Rechner holt etwa alle 30 Minuten die Trades aus MT5 und legt sie verschlüsselt
// im Zweig „mt5-data“ ab. Hier werden sie abgeholt, auf dem Gerät entschlüsselt und als Trades eingetragen.
import { S, saveSettings, saveTrade, accountTrades, activeAccount, removeOpen } from './store.js';
import { symInfo, tradingDay } from './edge.js';
import { uid } from './util.js';

// Repository aus der Adresse ablesen: name.github.io/REPO/ → name/REPO
export function repoInfo() {
  const host = location.hostname;
  if (!host.endsWith('.github.io')) return null;
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return repo ? { owner: host.split('.')[0], repo } : null;
}
export function dataURL() {
  if (S.settings.mt5?.url) return S.settings.mt5.url;
  const r = repoInfo();
  return r ? `https://raw.githubusercontent.com/${r.owner}/${r.repo}/mt5-data/sync.json` : null;
}
export const secretsURL = () => {
  const r = repoInfo();
  return r ? `https://github.com/${r.owner}/${r.repo}/settings/secrets/actions` : null;
};

// Gut lesbarer Zufallsschlüssel, etwa 100 Bit
export function newKey() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(20));
  return [...b]
    .map((x) => A[x % 32])
    .join('')
    .match(/.{4}/g)
    .join('-');
}

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function decrypt(enc, pass) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: 150000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

// MT5 liefert Serverzeit. Mit erkannter Zeitzone exakt umrechnen, sonst über die Einstellung „MT5-Serverzeit“.
export function realTime(sec, offsetH) {
  if (offsetH != null) return sec * 1000 - offsetH * 3600e3;
  const d = new Date(sec * 1000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getTime() - (S.settings.serverOffset ?? 1) * 3600e3;
}

function remember(info) {
  const cfg = { ...S.settings.mt5, last: { ...info, checked: Date.now() } };
  if (info.offsetH != null) cfg.offsetH = info.offsetH;
  if (info.login) cfg.login = info.login;
  saveSettings({ mt5: cfg });
  return info;
}

let pulling = null;
export const syncOn = () => !!S.settings.mt5?.key;
export function pullSync() {
  pulling ||= doPull().finally(() => {
    pulling = null;
  });
  return pulling;
}

async function doPull() {
  const cfg = S.settings.mt5;
  if (!cfg?.key) return { state: 'off' };
  const url = dataURL();
  if (!url) return { state: 'nourl' };
  let res;
  try {
    res = await fetch(`${url}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
  } catch {
    return { state: 'offline' };
  }
  if (res.status === 404) return remember({ state: 'waiting' });
  if (!res.ok) return remember({ state: 'http', code: res.status });
  let st;
  try {
    st = await res.json();
  } catch {
    return remember({ state: 'error', error: 'other' });
  }
  if (!st.ok) return remember({ state: 'error', error: st.error || 'other', at: (st.at || 0) * 1000 });
  let p;
  try {
    p = await decrypt(st.enc, cfg.key);
  } catch {
    return remember({ state: 'key', at: (st.at || 0) * 1000 });
  }
  const acc = S.accounts.get(cfg.accountId) || activeAccount();
  if (!acc) return remember({ state: 'noacc' });
  const off = p.offsetH ?? cfg.offsetH ?? null;
  const known = new Set([...S.trades.values()].map((t) => t.mt5).filter(Boolean));
  const used = new Set();
  let added = 0;
  let linked = 0;
  for (const x of p.trades || []) {
    const mid = `${p.login}:${x.position}`;
    if (known.has(mid)) continue;
    const sym = symInfo(x.symbol).sym;
    const closeAt = realTime(x.close, off);
    const openAt = realTime(x.open, off);
    const pnl = Math.round((x.profit + x.fees) * 100) / 100;
    // Schon per Screenshot oder von Hand eingetragen? Dann nur verknüpfen und Lücken füllen.
    const dup = accountTrades(acc.id).find((t) => !t.mt5 && symInfo(t.symbol).sym === sym && Math.abs((t.lots || 0) - x.lots) < 0.005 && Math.abs(t.pnl - pnl) < 0.05 && Math.abs(t.closeAt - closeAt) < 10 * 60e3);
    if (dup) {
      saveTrade({ ...dup, mt5: mid, entry: dup.entry || x.entry, exit: dup.exit || x.exit, sl: dup.sl || x.sl, tp: dup.tp || x.tp, openAt: dup.openAt || openAt, exitReason: dup.exitReason || x.reason || null });
      known.add(mid);
      continue;
    }
    // Vorher im Check geprüft? Dann wandern Ampel, Setup, Gefühl und Regeln mit.
    const o = S.open.find((c) => !used.has(c.id) && c.accountId === acc.id && c.symbol === sym && c.side === x.side && Math.abs((c.lots || 0) - x.lots) < 0.005 && Math.abs(c.openAt - openAt) < 3 * 3600e3);
    if (o) {
      used.add(o.id);
      linked++;
    }
    saveTrade({
      id: uid(),
      accountId: acc.id,
      mt5: mid,
      symbol: sym,
      side: x.side,
      lots: x.lots,
      entry: x.entry,
      exit: x.exit,
      sl: x.sl || o?.sl || null,
      tp: x.tp || o?.tp || null,
      pnl,
      openAt,
      closeAt,
      day: tradingDay(closeAt, acc.resetHour),
      setup: o?.setup || null,
      feelBefore: o?.feelBefore || null,
      mistakes: [],
      checks: o?.checks || {},
      rulesOk: o ? o.rulesOk : null,
      check: o?.check || null,
      exitReason: x.reason || null,
      source: 'mt5',
    });
    if (o) await removeOpen(o.id);
    known.add(mid);
    added++;
  }
  const positions = (p.positions || []).map((x) => ({ ...x, symbol: symInfo(x.symbol).sym, openAt: realTime(x.open, off) }));
  return remember({ state: 'ok', at: p.at * 1000, added, linked, n: (p.trades || []).length, login: p.login, server: p.server, currency: p.currency, balance: p.balance, equity: p.equity, positions, offsetH: p.offsetH });
}

// Klartext für den Zustand des Abrufs
export function syncText(last) {
  if (!last) return 'Noch nicht abgefragt.';
  const E = {
    secrets: 'Auf GitHub fehlt noch ein Secret (MT5_LOGIN, MT5_PASSWORD, MT5_SERVER oder SYNC_KEY).',
    'login-format': 'MT5_LOGIN darf nur die Kontonummer enthalten, also nur Ziffern.',
    login: 'MT5 hat die Anmeldung abgelehnt. Stimmen Kontonummer, Investor-Passwort und Server?',
    server: 'MT5 hat deinen Server nicht gefunden. Schreib MT5_SERVER genau wie in der MT5-App (z. B. FTMO-Server). Hilft das nicht, leg zusätzlich MT5_COMPANY mit dem Namen deiner Firma an.',
    search: 'MT5 hat deinen Server nicht gefunden. Schreib MT5_SERVER genau wie in der MT5-App (z. B. FTMO-Server). Hilft das nicht, leg zusätzlich MT5_COMPANY mit dem Namen deiner Firma an.',
    connect: 'Der MT5-Server hat nicht geantwortet. Beim nächsten Abruf geht es meist wieder.',
    ipc: 'MT5 ist auf dem GitHub-Rechner nicht richtig gestartet. Beim nächsten Abruf geht es meist wieder.',
    other: 'Beim Abruf ist etwas schiefgelaufen. Beim nächsten Abruf geht es meist wieder.',
  };
  switch (last.state) {
    case 'ok':
      return null;
    case 'waiting':
      return 'Noch kein Abruf da. Der erste kommt etwa 30 Minuten, nachdem alle vier Secrets eingetragen sind (Sonntagabend bis Freitag).';
    case 'error':
      return E[last.error] || E.other;
    case 'key':
      return 'Der Schlüssel passt nicht. SYNC_KEY auf GitHub muss genau der Schlüssel aus Edge sein.';
    case 'http':
      return `GitHub antwortet gerade nicht (${last.code}).`;
    case 'offline':
      return 'Keine Internetverbindung.';
    case 'noacc':
      return 'Lege zuerst ein Konto in Edge an.';
    default:
      return '';
  }
}
