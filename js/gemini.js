// Edge · Trades aus Screenshots lesen (MT5-Verlauf) über die Gemini-API.
// Der Schlüssel liegt nur in den Einstellungen auf dem Gerät; Anfragen gehen direkt vom iPhone an Google.
import { S, saveSettings } from './store.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // key | quota | busy | offline | blocked | model | parse | unknown
  }
}

const MESSAGES = {
  key: 'Der Gemini-Schlüssel stimmt nicht. Prüf ihn in den Einstellungen.',
  quota: 'Das kostenlose Gemini-Kontingent ist gerade aufgebraucht. Versuch es später noch einmal oder trag den Trade von Hand ein.',
  busy: 'Gemini ist gerade überlastet. Versuch es gleich noch einmal.',
  offline: 'Keine Verbindung. Ohne Internet geht das Auslesen nicht, von Hand eintragen klappt aber.',
  blocked: 'Gemini hat das Bild nicht ausgewertet. Versuch einen anderen Screenshot.',
  model: 'Kein passendes Gemini-Modell gefunden. Prüf den Schlüssel in den Einstellungen.',
  parse: 'Die Antwort war unvollständig. Versuch es noch einmal.',
  timeout: 'Gemini hat zu lange gebraucht. Vielleicht ist das Netz gerade schwach, versuch es noch einmal.',
  cancel: 'Abgebrochen.',
  unknown: 'Das Auslesen hat nicht geklappt. Versuch es noch einmal.',
};
export const errorText = (e) => (e instanceof GeminiError ? e.message : MESSAGES.unknown);
const fail = (kind) => new GeminiError(kind, MESSAGES[kind]);

// Mit Zeitlimit; signal bricht ab, wenn das Sheet geschlossen wird
async function call(url, opts, key, { signal = null, timeout = 45000 } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeout);
  const cancel = () => ctrl.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel);
  let res;
  let body;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, ...(opts.headers || {}) } });
    body = await res.json().catch(() => null);
    if (ctrl.signal.aborted) throw new Error('abgebrochen');
  } catch {
    throw fail(timedOut ? 'timeout' : ctrl.signal.aborted ? 'cancel' : 'offline');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
  if (res.ok) {
    if (!body) throw fail('parse');
    return body;
  }
  const msg = body?.error?.message || '';
  if (res.status === 400 && /api key/i.test(msg)) throw fail('key');
  if (res.status === 401 || res.status === 403) throw fail('key');
  if (res.status === 404) throw fail('model');
  if (res.status === 429) throw fail('quota');
  if (res.status >= 500) throw fail('busy');
  console.warn('Gemini', res.status, msg);
  throw fail('unknown');
}

/* Bestes verfügbares Flash-Modell aussuchen: „flash-latest“ wenn vorhanden, sonst die höchste stabile Flash-Version. */
export async function findModel(key, signal = null) {
  const data = await call(`${BASE}/models?pageSize=1000`, { method: 'GET' }, key, { signal, timeout: 20000 });
  const models = (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /flash/.test(n) && !/(lite|tts|image|live|audio|embed|thinking|8b|exp|computer)/.test(n));
  if (!models.length) throw fail('model');
  if (models.includes('gemini-flash-latest')) return 'gemini-flash-latest';
  const score = (n) => {
    const v = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
    return v * 10 - (/preview/.test(n) ? 1 : 0) - (/-\d{3}$/.test(n) ? 0.5 : 0);
  };
  return models.sort((a, b) => score(b) - score(a))[0];
}

export async function connect(key) {
  const model = await findModel(key.trim());
  await saveSettings({ geminiKey: key.trim(), geminiModel: model });
  return model;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    trades: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          symbol: { type: 'STRING', description: 'Symbol genau wie angezeigt, z. B. EURUSD, XAUUSD, US100.cash' },
          side: { type: 'STRING', enum: ['buy', 'sell'] },
          lots: { type: 'NUMBER' },
          open_price: { type: 'NUMBER' },
          close_price: { type: 'NUMBER' },
          sl: { type: 'NUMBER', description: '0 wenn nicht sichtbar' },
          tp: { type: 'NUMBER', description: '0 wenn nicht sichtbar' },
          profit: { type: 'NUMBER', description: 'Gewinn oder Verlust mit Vorzeichen, ohne Kommission und Swap' },
          commission: { type: 'NUMBER', description: 'mit Vorzeichen, 0 wenn nicht sichtbar' },
          swap: { type: 'NUMBER', description: 'mit Vorzeichen, 0 wenn nicht sichtbar' },
          open_time: { type: 'STRING', description: 'YYYY-MM-DD HH:MM:SS, leer wenn nicht sichtbar' },
          close_time: { type: 'STRING', description: 'YYYY-MM-DD HH:MM:SS, leer wenn nicht sichtbar' },
        },
        required: ['symbol', 'side', 'lots', 'profit'],
      },
    },
    hint: { type: 'STRING', description: 'kurzer Hinweis auf Deutsch, z. B. was unleserlich war; leer wenn nichts' },
  },
  required: ['trades'],
};

const PROMPT = [
  'Das Bild ist ein Screenshot aus MetaTrader 5 (meistens die iPhone-App, Reiter Verlauf/History mit Positionen) oder aus dem Dashboard einer Prop-Firm.',
  'Lies alle abgeschlossenen Positionen aus. Ignoriere offene Positionen, Einzahlungen, Auszahlungen und die Zusammenfassung (Gewinn, Kredit, Einzahlung, Saldo).',
  'Pro Position: Symbol wie angezeigt, Richtung (buy oder sell), Volumen in Lots, Eröffnungs- und Schließkurs (in MT5 steht oft „1.08123 → 1.08345“), Gewinn mit Vorzeichen, Kommission und Swap falls sichtbar, Eröffnungs- und Schließzeit.',
  'MT5 schreibt Datumsangaben als „2026.10.22 14:35:10“. Gib sie als „2026-10-22 14:35:10“ zurück. Fehlt das Datum bei einer Zeile, nimm das Datum der Gruppe darüber.',
  'Erfinde nichts. Was nicht zu sehen ist, lässt du leer oder 0. Ist kein Trading-Verlauf zu sehen, gib eine leere Liste zurück und erkläre es im Hinweis.',
].join('\n');

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const time = (s) => {
  const m = /(\d{4})[-.](\d{2})[-.](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ''));
  return m ? { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0) } : null;
};

/* Liefert Trades mit Zeiten als Serverzeit-Teile; die Umrechnung auf die eigene Uhr macht die Ansicht. */
export async function extractTrades({ image, mime = 'image/jpeg', signal = null }) {
  const st = S.settings;
  if (!st.geminiKey) throw fail('key');
  let model = st.geminiModel || (await findModel(st.geminiKey, signal));
  const body = {
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: image } }, { text: PROMPT }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: SCHEMA },
  };
  const send = (m) => call(`${BASE}/models/${m}:generateContent`, { method: 'POST', body: JSON.stringify(body) }, st.geminiKey, { signal, timeout: 60000 });
  let data;
  try {
    data = await send(model);
  } catch (e) {
    if (!(e instanceof GeminiError) || e.kind !== 'model') throw e;
    model = await findModel(st.geminiKey, signal);
    await saveSettings({ geminiModel: model });
    data = await send(model);
  }
  if (!st.geminiModel) saveSettings({ geminiModel: model });
  if (data?.promptFeedback?.blockReason) throw fail('blocked');
  const raw = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  let out;
  try {
    out = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw fail('parse');
  }
  const trades = (Array.isArray(out.trades) ? out.trades : [])
    .map((t) => ({
      symbol: String(t.symbol || '').slice(0, 20).trim(),
      side: t.side === 'sell' ? 'short' : 'long',
      lots: Math.abs(num(t.lots)),
      entry: num(t.open_price) || null,
      exit: num(t.close_price) || null,
      sl: num(t.sl) || null,
      tp: num(t.tp) || null,
      profit: num(t.profit),
      fees: num(t.commission) + num(t.swap),
      open: time(t.open_time),
      close: time(t.close_time),
    }))
    .filter((t) => t.symbol && t.lots > 0);
  return { trades, hint: String(out.hint || '').slice(0, 200), model };
}
