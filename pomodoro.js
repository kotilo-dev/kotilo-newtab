'use strict';
/* Pomodoro kartı. Durum chrome.storage.local → "pomo": { mode, running, endsAt, remaining, round, durations }.
   - Bütün açık yeni sekmeler aynı durumu okur (storage.onChanged); bitişi arka plan (background.js) bir alarmla yakalar,
     bildirimi gösterir ve sonraki aşamaya geçirir. Arka plan yoksa (önizleme) sayfa kendisi geçirir.
   - 4 odak turundan sonra uzun mola. Süre bitince görünür sekmede kısa bir ses çalar; çalışırken sekme başlığında kalan süre yazar.
   newtab.js'ten sonra yüklenir ($, el, ext, isExt, store). */

const POMO_DEFAULT_MIN = { focus: 25, short: 5, long: 15 };
const POMO_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
let pomo = null;
const baseTitle = document.title;

const pomoDur = (m) => ((pomo && pomo.durations && pomo.durations[m]) || POMO_DEFAULT_MIN[m]) * 60e3;
const remainingMs = () => (pomo.running ? Math.max(0, pomo.endsAt - Date.now()) : pomo.remaining);
const fmtClock = (ms) => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

async function savePomo(next) {
  pomo = next;
  await store.set('pomo', pomo);
  renderPomo();
}
function setAlarm() {
  if (!isExt || !ext.alarms) return;
  if (pomo.running) ext.alarms.create('pomodoro', { when: pomo.endsAt });
  else ext.alarms.clear('pomodoro');
}
function pomoNext(st) { // background.js'teki nextState ile aynı kural
  const round = st.mode === 'focus' ? (st.round || 0) + 1 : (st.round || 0);
  const mode = st.mode === 'focus' ? (round % 4 === 0 ? 'long' : 'short') : 'focus';
  return { ...st, mode, round, running: false, endsAt: null, remaining: pomoDur(mode), finishedAt: Date.now(), finishedMode: st.mode };
}

async function pomoStartPause() {
  if (pomo.running) await savePomo({ ...pomo, running: false, remaining: remainingMs(), endsAt: null });
  else await savePomo({ ...pomo, running: true, endsAt: Date.now() + pomo.remaining });
  setAlarm();
}
async function pomoReset() { await savePomo({ ...pomo, running: false, endsAt: null, remaining: pomoDur(pomo.mode) }); setAlarm(); }
async function pomoSkip() { await savePomo({ ...pomoNext(pomo), finishedAt: null }); setAlarm(); }
async function pomoSetMode(mode) { await savePomo({ ...pomo, mode, running: false, endsAt: null, remaining: pomoDur(mode) }); setAlarm(); }

// Kısa, yumuşak bir zil sesi (dosya gerektirmez).
function chime() {
  try {
    const ac = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = [880, 660, 990][i];
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.4);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.45);
    });
    setTimeout(() => ac.close(), 1500);
  } catch { /* ses çalınamazsa sessiz geç */ }
}

function renderPomo() {
  if (!pomo) return;
  const ms = remainingMs();
  $('pomoTime').textContent = fmtClock(ms);
  $('pomoStart').textContent = pomo.running ? 'Pause' : (pomo.remaining < pomoDur(pomo.mode) ? 'Resume' : 'Start');
  $('wPomo').classList.toggle('running', !!pomo.running);
  $('wPomo').dataset.mode = pomo.mode;
  document.querySelectorAll('#pomoModes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === pomo.mode)));
  // Tur noktaları: mevcut 4'lü döngüde tamamlanan odaklar
  const done = (pomo.round || 0) % 4;
  $('pomoDots').replaceChildren(...[0, 1, 2, 3].map((i) => el('span', { class: 'pomo-dot' + (i < done ? ' on' : '') })));
  $('pomoDots').title = `${pomo.round || 0} focus sessions completed`;
  const total = pomoDur(pomo.mode);
  $('pomoBar').style.width = (100 * (1 - ms / total)).toFixed(2) + '%';
  $('pomoMsg').textContent = pomo.finishedAt && Date.now() - pomo.finishedAt < 10 * 60e3 && !pomo.running
    ? `${POMO_LABEL[pomo.finishedMode]} finished — start your ${POMO_LABEL[pomo.mode].toLowerCase()}.` : POMO_LABEL[pomo.mode];
  document.title = pomo.running ? `${fmtClock(ms)} · ${POMO_LABEL[pomo.mode]}` : baseTitle;
}

// Her saniye: geri sayım; süre bittiyse arka planın geçirmesini kısa bir süre bekle, olmazsa (önizleme) kendin geçir.
setInterval(() => {
  if (!pomo) return;
  if (pomo.running && Date.now() >= pomo.endsAt + (isExt && ext.alarms ? 4000 : 0)) {
    // Başka bir sekme ya da arka plan bu arada geçirdiyse tekrar geçirme (çift tur sayılmasın).
    store.get('pomo', null).then((cur) => {
      if (!cur || !cur.running || cur.endsAt !== pomo.endsAt) { if (cur) { pomo = cur; renderPomo(); } return; }
      chime();
      savePomo(pomoNext(cur));
    });
    return;
  }
  renderPomo();
}, 1000);

$('pomoStart').addEventListener('click', pomoStartPause);
$('pomoReset').addEventListener('click', pomoReset);
$('pomoSkip').addEventListener('click', pomoSkip);
document.querySelectorAll('#pomoModes button').forEach((b) => b.addEventListener('click', () => pomoSetMode(b.dataset.mode)));

(async function initPomo() {
  const saved = await store.get('pomo', null);
  pomo = saved || { mode: 'focus', running: false, endsAt: null, remaining: POMO_DEFAULT_MIN.focus * 60e3, round: 0 };
  renderPomo();
  if (isExt) ext.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.pomo) return;
    const prev = pomo; pomo = ch.pomo.newValue;
    // Arka plan aşamayı geçirdiyse (çalışıyordu → bitti) görünür sekmede zil çal.
    if (prev && prev.running && pomo && !pomo.running && pomo.finishedAt && document.visibilityState === 'visible') chime();
    renderPomo();
  });
})();
