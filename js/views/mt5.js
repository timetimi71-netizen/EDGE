// Edge · Einrichtung „MT5 automatisch“: Schlüssel erzeugen, Secrets bei GitHub eintragen, Konto wählen, Zustand ansehen
import { S, saveSettings, activeAccount } from '../store.js';
import { fmtMoney } from '../edge.js';
import { pullSync, newKey, secretsURL, syncText, repoInfo } from '../sync.js';
import { icon, openSheet, confirmDialog } from '../ui.js';
import { esc, haptic, toast, IS_PREVIEW } from '../util.js';
import { act, app } from '../app.js';

const SECRETS = [
  ['MT5_LOGIN', 'Deine MT5-Kontonummer, nur Ziffern.'],
  ['MT5_PASSWORD', 'Dein Investor-Passwort (nur lesen). Nicht das Haupt-Passwort.'],
  ['MT5_SERVER', 'Der Server genau wie in der MT5-App, z. B. FTMO-Server.'],
  ['SYNC_KEY', 'Dein Schlüssel von oben.'],
];

export function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60e3));
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `vor ${h} h` : `vor ${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? 'Tag' : 'Tagen'}`;
}

// Kurzer Zustand für die Einstellungen
export function syncSummary() {
  const cfg = S.settings.mt5;
  if (!cfg?.key) return 'Aus · Trades kommen wie bei FX Replay von selbst';
  const last = cfg.last;
  if (last?.state === 'ok') return `Verbunden${cfg.login ? ` · Konto ${cfg.login}` : ''} · ${ago(last.at)}`;
  if (last?.state === 'waiting' || !last) return 'Eingerichtet · wartet auf den ersten Abruf';
  return 'Braucht deine Hilfe';
}

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} kopiert`, { icon: icon('check') });
  } catch {
    toast('Kopieren ging nicht. Halte den Text gedrückt und kopiere ihn von Hand.');
  }
  haptic();
}

export function openMt5() {
  if (!S.settings.mt5?.key) {
    const acc = activeAccount();
    saveSettings({ mt5: { key: newKey(), accountId: acc?.id || null, createdAt: Date.now() } });
  }
  const sheet = openSheet({ title: 'MT5 automatisch', cls: 'tall', onClose: () => app.refresh() });
  const paint = () => {
    const cfg = S.settings.mt5;
    const last = cfg.last;
    const err = syncText(last);
    const good = last?.state === 'ok';
    const bad = !!last && !['ok', 'waiting'].includes(last.state);
    const url = secretsURL();
    const accs = [...S.accounts.values()].sort((a, b) => b.createdAt - a.createdAt);
    sheet.body.innerHTML = `<div class="form mt5">
      <p class="muted">Wie bei FX Replay: Ein Rechner bei GitHub meldet sich etwa alle 30 Minuten mit deinem <b>Investor-Passwort</b> bei MT5 an und holt deine Trades. Mit dem Investor-Passwort kann man nur lesen, nicht traden. Die Trades kommen verschlüsselt an, lesen kann sie nur dein iPhone.</p>
      <div class="sync-state ${good ? 'ok' : bad ? 'bad' : ''}">
        <span class="adot ${good ? 'green' : bad ? 'yellow' : ''}"></span>
        <div><b>${last?.state === 'ok' ? `Verbunden${cfg.login ? ` · Konto ${esc(cfg.login)}` : ''}` : last?.state === 'waiting' || !last ? 'Wartet auf den ersten Abruf' : 'Klappt noch nicht'}</b>
        <span>${
          last?.state === 'ok'
            ? `Letzter Abruf ${ago(last.at)} · ${last.n} Trades in MT5${last.added ? `, ${last.added} neu` : ''}${last.equity != null ? ` · Equity ${fmtMoney(last.equity, last.currency || 'USD', { dec: 2 })}` : ''}`
            : esc(err || '')
        }</span></div>
      </div>
      <button type="button" class="btn btn-soft btn-block" id="mk-check">${icon('repeat')} Jetzt nachsehen</button>

      <div class="group-label">1 · Dein Schlüssel</div>
      <div class="keybox"><code id="mk-key">${esc(cfg.key)}</code><button type="button" class="btn btn-soft btn-sm" data-copy="key">Kopieren</button></div>
      <p class="note">Bleibt auf diesem iPhone und kommt als SYNC_KEY zu GitHub. Er ist nicht im Backup.</p>

      <div class="group-label">2 · Bei GitHub eintragen</div>
      ${
        url
          ? `<a class="btn btn-primary btn-block" href="${esc(url)}" target="_blank" rel="noopener">${icon('lock')} GitHub-Secrets öffnen</a>`
          : '<p class="note">Das geht in der installierten App (Adresse …github.io).</p>'
      }
      <p class="note">In Safari bei GitHub anmelden, dann viermal auf <b>„New repository secret“</b>: oben den Namen, darunter den Wert, dann <b>„Add secret“</b>.</p>
      <div class="secret-list">${SECRETS.map(([n, d]) => `<div class="secret-row"><div><code>${n}</code><span>${d}</span></div><button type="button" class="btn btn-soft btn-sm" data-copy="${n}">Name</button></div>`).join('')}</div>
      <p class="note">Das Investor-Passwort steht meist in der Mail deiner Prop-Firma oder im Dashboard bei den Zugangsdaten (oft „Investor“ oder „Read only“). In der MT5-App selbst siehst du es nicht.</p>

      <div class="group-label">3 · Zu welchem Konto in Edge?</div>
      <div class="chips">${accs.map((a) => `<button type="button" class="chip ${a.id === cfg.accountId ? 'on' : ''}" data-acc="${esc(a.id)}">${esc(a.name)}</button>`).join('') || '<p class="note">Leg zuerst ein Konto an.</p>'}</div>

      <div class="group-label">So geht es weiter</div>
      <p class="note">Der erste Abruf kommt etwa 30 Minuten nach dem Eintragen, von Sonntagabend bis Freitag. Danach landen neue Trades von selbst in Edge, sobald du die App öffnest. Hast du vorher den Check gemacht, hängen Ampel, Setup und Regeln automatisch dran.</p>
      <p class="note">Nicht warten? In der GitHub-App bei deinem Repository auf <b>Actions → MT5 Sync → Run workflow</b> tippen. Nach etwa zwei Minuten hier auf „Jetzt nachsehen“.</p>
      <button type="button" class="btn btn-ghost btn-block danger-text" id="mk-off">MT5 automatisch ausschalten</button>
    </div>`;
  };
  paint();
  sheet.body.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      const k = c.dataset.copy;
      copy(k === 'key' ? S.settings.mt5.key : k, k === 'key' ? 'Schlüssel' : k);
      return;
    }
    const a = e.target.closest('[data-acc]');
    if (a) {
      saveSettings({ mt5: { ...S.settings.mt5, accountId: a.dataset.acc } });
      haptic();
      paint();
      return;
    }
    if (e.target.closest('#mk-check')) {
      const b = e.target.closest('#mk-check');
      b.disabled = true;
      b.innerHTML = '<span class="spinner sm"></span> Sehe nach …';
      const r = await pullSync();
      if (sheet.closed) return;
      paint();
      if (r.state === 'ok') toast(r.added ? `${r.added} ${r.added === 1 ? 'Trade' : 'Trades'} aus MT5 übernommen` : 'Alles aktuell', { icon: icon('check') });
      return;
    }
    if (e.target.closest('#mk-off')) {
      const ok = await confirmDialog({ title: 'MT5 automatisch ausschalten?', text: 'Edge holt dann keine Trades mehr ab. Lösch bei GitHub auch die vier Secrets, dann hört der Abruf dort ganz auf. Deine Trades bleiben in Edge.', ok: 'Ausschalten', danger: true });
      if (!ok) return;
      await saveSettings({ mt5: null });
      sheet.close();
      toast('MT5 automatisch ist aus');
    }
  });
}
act('mt5-setup', () => {
  if (IS_PREVIEW || !repoInfo()) {
    toast('Das geht in der installierten App.', { ms: 3200 });
    if (IS_PREVIEW) return;
  }
  openMt5();
});
