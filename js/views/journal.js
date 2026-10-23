// Edge · Journal: Marktplan vor dem Handel, Rückblick danach, Wochenblick
import { S, saveDay, saveDaySoon, savePic, picURL, deletePic, activeAccount, tradesOn } from '../store.js';
import { kpis, fmtMoney, tone, symInfo } from '../edge.js';
import { tradeRow, viewer } from './trades.js';
import { prepareChart } from '../img.js';
import { icon, facesHTML, segHTML, setSeg } from '../ui.js';
import { $, esc, today, fromISO, addDays, relDay, WD_LONG, MONTHS, fmtNum, fmtDayMonth, haptic, toast, autosize } from '../util.js';
import { act, onChange, app } from '../app.js';
import { toggleDictation } from '../speech.js';

let date = today();
export function enter(opts = {}) {
  date = opts.date || today();
}

const MOODS = ['Frustriert', 'Unzufrieden', 'Okay', 'Zufrieden', 'Stolz'];
const FOLLOW = [
  ['ja', 'Ja'],
  ['teils', 'Teilweise'],
  ['nein', 'Nein'],
];

export function render() {
  const d = fromISO(date);
  const day = S.days.get(date) || {};
  const acc = activeAccount();
  const ts = acc ? tradesOn(date, acc.id) : [];
  const rel = relDay(date);
  return `
  <header class="jhead" id="jhead">
    <button type="button" class="icon-btn" data-act="j-shift" data-d="-1" aria-label="Vorheriger Tag">${icon('chevL')}</button>
    <div class="jdate">
      <div class="eyebrow">${rel ? esc(rel) : 'Journal'}</div>
      <div class="jdate-t">${WD_LONG[d.getDay()]},<em>${d.getDate()}. ${MONTHS[d.getMonth()]}</em></div>
      <input type="date" class="jdate-in" value="${date}" data-change="j-date" aria-label="Datum wählen">
    </div>
    <button type="button" class="icon-btn" data-act="j-shift" data-d="1" ${date >= addDays(today(), 1) ? 'disabled' : ''} aria-label="Nächster Tag">${icon('chevR')}</button>
  </header>
  ${planHTML(day)}
  ${reviewHTML(day, ts, acc)}
  ${weekHTML(acc)}`;
}

function planHTML(day) {
  const syms = [...new Set([...Object.keys(day.bias || {}), ...S.settings.symbols.slice(0, 4)])].slice(0, 8);
  return `<section class="card jcard">
    <div class="card-h"><h2 class="card-t">${icon('sun')} Marktplan</h2><span class="faint small">vor dem Handel</span></div>
    <div class="sub-h" style="margin-top:2px">Richtung</div>
    <div class="bias-list">${syms
      .map(
        (s) => `<div class="bias-row"><span class="bias-sym">${esc(symInfo(s).sym)}</span>${segHTML('j-bias', [
          ['bull', '▲ Long'],
          ['flat', '–'],
          ['bear', '▼ Short'],
        ], day.bias?.[s] || 'flat', `sm bias-seg" data-sym="${esc(s)}`)}</div>`,
      )
      .join('')}</div>
    ${textBox('levels', 'Wichtige Level', 'z. B. EURUSD 1,0850 Widerstand, 1,0790 Unterstützung', day.levels)}
    ${textBox('news', 'News heute', 'z. B. 14:30 US-Arbeitsmarkt, keine Trades 15 Minuten davor', day.news)}
    ${textBox('plan', 'Mein Plan', 'Wann steige ich ein, wann lasse ich es? Was ist heute tabu?', day.plan)}
    <div class="sub-h">TradingView-Screenshot</div>
    <div id="j-pic">${picHTML()}</div>
  </section>`;
}
const picId = () => `plan:${date}`;
function picHTML() {
  return S.pics.has(picId())
    ? `<div class="pic-box"><img data-pic="${picId()}" alt="Chart"><button type="button" class="icon-btn sm" data-act="j-pic-x" aria-label="Bild entfernen">${icon('close')}</button></div>`
    : `<label class="btn btn-soft btn-block pic-add">${icon('image')} Chart hinzufügen<input type="file" accept="image/*" data-change="j-pic" class="sr"></label>`;
}
function textBox(key, label, ph, v) {
  return `<div class="sub-h">${label}</div><div class="write card"><textarea class="jtext" data-field="${key}" rows="2" placeholder="${esc(ph)}">${esc(v || '')}</textarea>
    <button type="button" class="mic" data-mic="${key}" aria-label="Diktieren" aria-pressed="false">${icon('mic')}</button></div>`;
}

function reviewHTML(day, ts, acc) {
  const k = kpis(ts);
  const broken = ts.filter((t) => t.rulesOk === false).length;
  return `<section class="card jcard">
    <div class="card-h"><h2 class="card-t">${icon('moon')} Rückblick</h2><span class="faint small">nach dem Handel</span></div>
    ${
      ts.length
        ? `<div class="j-sum"><b class="${tone(k.net)}">${fmtMoney(k.net, acc?.currency, { sign: true })}</b><span>${k.n} ${k.n === 1 ? 'Trade' : 'Trades'} · ${fmtNum((k.winRate || 0) * 100, 0)}&nbsp;% Treffer${broken ? ` · <span class="loss">${broken}× Regeln gebrochen</span>` : ''}</span></div>
          <div class="tlist">${ts.map((t) => tradeRow(t)).join('')}</div>`
        : '<p class="empty">An diesem Tag kein Trade. Auch nicht traden kann die beste Entscheidung sein.</p>'
    }
    <div class="sub-h">Wie zufrieden bist du mit deinem Handelstag?</div>
    <div class="j-mood">${facesHTML('mood', day.mood, { label: 'Zufriedenheit', labels: MOODS })}</div>
    <div class="sub-h">Plan befolgt?</div>
    ${segHTML('j-follow', FOLLOW, day.follow || '', `sm ${day.follow ? '' : 'none'}`)}
    ${textBox('good', 'Was lief gut?', 'z. B. Geduldig auf mein Setup gewartet', day.good)}
    ${textBox('better', 'Was mache ich morgen besser?', 'z. B. Nach einem Verlust 30 Minuten Pause', day.better)}
  </section>`;
}

function weekHTML(acc) {
  if (!acc) return '';
  const d = fromISO(date);
  const mon = addDays(date, -((d.getDay() + 6) % 7));
  const days = Array.from({ length: 5 }, (_, i) => addDays(mon, i));
  const ts = days.flatMap((x) => tradesOn(x, acc.id));
  if (!ts.length) return '';
  const k = kpis(ts);
  const max = Math.max(1, ...days.map((x) => Math.abs(tradesOn(x, acc.id).reduce((s, t) => s + t.pnl, 0))));
  const lessons = [...new Set(days.map((x) => S.days.get(x)?.better?.trim()).filter(Boolean))];
  return `<section class="card">
    <div class="card-h"><h2 class="card-t">${icon('calendar')} Woche ab ${fmtDayMonth(mon)}</h2><b class="${tone(k.net)} small">${fmtMoney(k.net, acc.currency, { sign: true })}</b></div>
    <div class="wk-bars">${days
      .map((x) => {
        const v = tradesOn(x, acc.id).reduce((s, t) => s + t.pnl, 0);
        const n = tradesOn(x, acc.id).length;
        return `<button type="button" class="wk-day ${x === date ? 'on' : ''}" data-act="j-goto" data-date="${x}"><span class="wk-col"><i class="${tone(v)}" style="--h:${n ? Math.max(6, (Math.abs(v) / max) * 100).toFixed(1) : 0}%"></i></span><small>${WD_LONG[fromISO(x).getDay()].slice(0, 2)}</small></button>`;
      })
      .join('')}</div>
    <div class="debt"><span>${k.n} ${k.n === 1 ? 'Trade' : 'Trades'} · ${fmtNum((k.winRate || 0) * 100, 0)}&nbsp;% Treffer</span><b>${k.wins && k.losses ? `Profit-Faktor ${fmtNum(k.pf, 2)}` : ''}</b></div>
    ${lessons.length ? `<div class="sub-h">Deine Vorsätze diese Woche</div><ul class="lessons">${lessons.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

const bound = new WeakSet();
export function mount(root) {
  root.querySelectorAll('textarea.jtext').forEach((ta) => {
    autosize(ta);
    ta.addEventListener('input', () => {
      autosize(ta);
      saveDaySoon(date, { [ta.dataset.field]: ta.value });
    });
  });
  root.querySelectorAll('[data-mic]').forEach((b) =>
    b.addEventListener('click', () => {
      const ta = root.querySelector(`textarea[data-field="${b.dataset.mic}"]`);
      toggleDictation(b, ta, (v) => saveDaySoon(date, { [ta.dataset.field]: v }));
    }),
  );
  hydratePic(root);
  // #view bleibt dasselbe Element: den Klick-Handler nur einmal anhängen, sonst schaltet jeder weitere ihn wieder aus
  if (bound.has(root)) return;
  bound.add(root);
  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-face="mood"]');
    if (f) {
      const v = Number(f.dataset.v);
      const cur = S.days.get(date)?.mood;
      saveDay(date, { mood: cur === v ? null : v });
      f.parentElement.querySelectorAll('.face-b').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === (cur === v ? null : v)));
      f.parentElement.classList.toggle('sel', cur !== v);
      haptic();
    }
  });
}
async function hydratePic(root) {
  const img = root.querySelector('img[data-pic]');
  if (!img) return;
  const url = await picURL(img.dataset.pic);
  if (url) {
    img.src = url;
    img.addEventListener('click', () => viewer(url, 'Marktplan'));
  }
}

act('j-bias', (el) => {
  setSeg(el);
  const sym = el.closest('.seg').dataset.sym;
  const bias = { ...(S.days.get(date)?.bias || {}), [sym]: el.dataset.v === 'flat' ? null : el.dataset.v };
  saveDay(date, { bias });
  haptic();
});
act('j-follow', (el) => {
  const cur = S.days.get(date)?.follow;
  const v = cur === el.dataset.v ? null : el.dataset.v;
  saveDay(date, { follow: v });
  setSeg(el);
  if (!v) el.classList.remove('on');
  el.closest('.seg').classList.toggle('none', !v);
  haptic();
});
act('j-shift', (el) => {
  const nd = addDays(date, Number(el.dataset.d));
  if (nd > addDays(today(), 1)) return;
  date = nd;
  haptic();
  app.refresh({ animate: true });
});
act('j-goto', (el) => {
  date = el.dataset.date;
  haptic();
  app.refresh({ animate: true });
});
onChange('j-date', (el) => {
  if (!el.value) return;
  date = el.value;
  app.refresh({ animate: true });
});
onChange('j-pic', async (el) => {
  const file = el.files?.[0];
  el.value = '';
  if (!file) return;
  try {
    await savePic(picId(), await prepareChart(file));
    $('#j-pic').innerHTML = picHTML();
    hydratePic($('#j-pic'));
    haptic('success');
  } catch {
    toast('Das Bild ließ sich nicht öffnen.');
  }
});
act('j-pic-x', async () => {
  await deletePic(picId());
  $('#j-pic').innerHTML = picHTML();
  haptic();
});
