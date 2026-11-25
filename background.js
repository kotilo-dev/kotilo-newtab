'use strict';
/* Arka plan: Pomodoro süresi bittiğinde, yeni sekme açık olmasa bile bildirim gösterir ve sayacı bir sonraki aşamaya geçirir.
   Chrome'da service worker, Firefox'ta arka plan betiği olarak çalışır (build.mjs manifest'i buna göre üretir).
   Sayaç durumu chrome.storage.local → "pomo" anahtarında; sayfa (pomodoro.js) aynı mantığı kullanır. */
const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const POMO_MIN = { focus: 25, short: 5, long: 15 };
// Arka plan localStorage'a erişemez: dil, i18n.js'in setLang ile storage.local'a yazdığı "lang" değerinden okunur
// ('auto' ya da hiç yoksa tarayıcının arayüz dili). Sayfa metinleri i18n.js'te; burada yalnızca bildirimler var.
const TEXT = {
  en: {
    focus: 'Focus', short: 'Short break', long: 'Long break',
    finished: (label) => `${label} finished`,
    longBreak: 'Great work — time for a long break.', shortBreak: 'Focus session done — take a short break.', backToFocus: 'Break is over — ready to focus?',
  },
  tr: {
    focus: 'Odak', short: 'Kısa mola', long: 'Uzun mola',
    finished: (label) => `${label} bitti`,
    longBreak: 'Harika iş — uzun bir mola zamanı.', shortBreak: 'Odak oturumu bitti — kısa bir mola ver.', backToFocus: 'Mola bitti — odaklanmaya hazır mısın?',
  },
};
async function notifyText() {
  let lang = 'auto';
  try { lang = (await ext.storage.local.get('lang')).lang || 'auto'; } catch { /* okunamazsa otomatik */ }
  if (lang !== 'en' && lang !== 'tr') {
    let ui = '';
    try { ui = (ext.i18n && ext.i18n.getUILanguage()) || ''; } catch { /* yok */ }
    lang = /^tr\b/i.test(ui) ? 'tr' : 'en';
  }
  return TEXT[lang];
}

function nextState(st) {
  const round = st.mode === 'focus' ? (st.round || 0) + 1 : (st.round || 0);
  const mode = st.mode === 'focus' ? (round % 4 === 0 ? 'long' : 'short') : 'focus';
  const mins = (st.durations && st.durations[mode]) || POMO_MIN[mode];
  return { ...st, mode, round, running: false, endsAt: null, remaining: mins * 60e3, finishedAt: Date.now(), finishedMode: st.mode };
}

ext.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'pomodoro') return;
  const { pomo: st } = await ext.storage.local.get('pomo');
  if (!st || !st.running) return; // sayfa duraklattıysa ya da zaten geçtiyse
  const next = nextState(st);
  await ext.storage.local.set({ pomo: next });
  const tx = await notifyText();
  const msg = st.mode === 'focus' ? (next.mode === 'long' ? tx.longBreak : tx.shortBreak) : tx.backToFocus;
  try {
    await ext.notifications.create('pomodoro-' + Date.now(), {
      type: 'basic', iconUrl: ext.runtime.getURL('icons/icon128.png'),
      title: tx.finished(tx[st.mode]), message: msg, priority: 2,
    });
  } catch (e) { console.warn('[new-tab] notification', e); }
});

// Yeni kurulumda arka plan varsayılanı: Wikimedia Commons günün resmi (var olan kullanıcıların ayarına dokunulmaz).
ext.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') ext.storage.local.get('bgMode').then((r) => { if (r.bgMode == null) ext.storage.local.set({ bgMode: 'potd' }); });
});
