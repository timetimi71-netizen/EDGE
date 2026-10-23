// Edge · Diktieren: Sprache wird live in das Textfeld geschrieben (Web Speech API, Deutsch).
import { toast, haptic, autosize } from './util.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let active = null;

function hint(field) {
  toast('Tipp: Nutze das Mikrofon unten auf deiner Tastatur zum Diktieren.', { ms: 4200 });
  field.focus();
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function join(base, spoken) {
  if (!spoken) return base;
  if (!base.trim()) return cap(spoken);
  const sep = /\s$/.test(base) ? '' : ' ';
  return base + sep + (/[.!?]\s*$/.test(base) ? cap(spoken) : spoken);
}

export function toggleDictation(btn, field, onText) {
  if (active && active.btn === btn) {
    stopDictation();
    return;
  }
  if (active) stopDictation();
  if (!SR) {
    hint(field);
    return;
  }
  const rec = new SR();
  rec.lang = 'de-DE';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  const st = { rec, btn, field, onText, base: field.value, user: false, err: null, restarts: 0 };
  active = st;

  rec.onresult = (e) => {
    // Immer aus allen Ergebnissen neu zusammensetzen – Safari schickt Zwischenstände mehrfach.
    const parts = [];
    for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript.trim());
    field.value = join(st.base, parts.filter(Boolean).join(' '));
    autosize(field);
    onText?.(field.value);
  };
  rec.onerror = (e) => {
    st.err = e.error;
    if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) st.user = true;
  };
  rec.onend = () => {
    if (active !== st) return;
    // iOS beendet die Erkennung nach Sprechpausen – solange niemand gestoppt hat, geht es weiter.
    if (!st.user && (!st.err || st.err === 'no-speech') && st.restarts < 40) {
      st.restarts++;
      st.err = null;
      st.base = field.value;
      try {
        rec.start();
        return;
      } catch {
        /* fällt durch zu finish */
      }
    }
    finish(st);
  };
  try {
    rec.start();
  } catch {
    active = null;
    hint(field);
    return;
  }
  btn.classList.add('live');
  btn.setAttribute('aria-pressed', 'true');
  btn.closest('.write')?.classList.add('live');
  haptic();
}

function finish(st) {
  if (active === st) active = null;
  st.btn.classList.remove('live');
  st.btn.setAttribute('aria-pressed', 'false');
  st.btn.closest('.write')?.classList.remove('live');
  st.onText?.(st.field.value, true);
  if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(st.err)) {
    toast('Kein Zugriff aufs Mikrofon. Nutze das Mikrofon auf deiner Tastatur oder erlaube es in den Einstellungen.', { ms: 5000 });
  } else if (st.err && st.err !== 'no-speech' && st.err !== 'aborted') {
    hint(st.field);
  }
}

export function stopDictation() {
  if (!active) return;
  const st = active;
  st.user = true;
  try {
    st.rec.stop();
  } catch {
    finish(st);
  }
  // Falls onend ausbleibt, trotzdem aufräumen.
  setTimeout(() => {
    if (active === st) finish(st);
  }, 1500);
  haptic();
}
