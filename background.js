'use strict';
/* Arka plan: Pomodoro süresi bittiğinde, yeni sekme açık olmasa bile bildirim gösterir ve sayacı bir sonraki aşamaya geçirir.
   Chrome'da service worker, Firefox'ta arka plan betiği olarak çalışır (build.mjs manifest'i buna göre üretir).
   Sayaç durumu chrome.storage.local → "pomo" anahtarında; sayfa (pomodoro.js) aynı mantığı kullanır. */
const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const POMO_MIN = { focus: 25, short: 5, long: 15 };
const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };

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
  const msg = st.mode === 'focus'
    ? (next.mode === 'long' ? 'Great work — time for a long break.' : 'Focus session done — take a short break.')
    : 'Break is over — ready to focus?';
  try {
    await ext.notifications.create('pomodoro-' + Date.now(), {
      type: 'basic', iconUrl: ext.runtime.getURL('icons/icon128.png'),
      title: `${LABEL[st.mode]} finished`, message: msg, priority: 2,
    });
  } catch (e) { console.warn('[new-tab] notification', e); }
});
