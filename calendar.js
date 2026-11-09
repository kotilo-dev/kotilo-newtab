'use strict';
/* Aylık takvim: saatin altındaki tarihe tıklayınca açılır. Pazartesiyle başlar, ISO hafta numarası gösterir,
   bugünü vurgular, ayarlarda seçilen ülkenin resmî tatillerini işaretler (settings.region.holidays; boşsa tatil yok). Tatiller Nager.Date'ten (anahtar gerektirmez) yıl yıl
   alınır ve 30 gün önbellekte tutulur; dinî bayramlar her yıl değiştiği için elle yazılmadı.
   newtab.js'ten sonra yüklenir ($, el, store onlardan gelir). */

const calMonthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const calDayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', weekday: 'short' });
let calView = null;           // gösterilen ayın ilk günü
const holidayCache = {};      // 'ÜLKE-yıl' → { 'YYYY-MM-DD': [ad, ...] }

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ISO 8601 hafta numarası (haftalar pazartesi başlar; yılın ilk perşembesini içeren hafta 1. haftadır).
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 864e5 + 1) / 7);
}

const holidayCountry = () => (typeof settings !== 'undefined' && settings.region && settings.region.holidays) || '';
async function getHolidays(year) {
  const cc = holidayCountry();
  if (!cc) return {};
  const id = cc + '-' + year;
  if (holidayCache[id]) return holidayCache[id];
  const key = 'holidays-' + id;
  let c = await store.get(key, null);
  if (!c || Date.now() - c.at > 30 * 864e5) {
    try {
      const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(cc)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const map = {};
      // Yalnızca ülke genelindeki tatiller (eyalet/bölge tatilleri atlanır).
      for (const h of await r.json()) if (h.global !== false) (map[h.date] = map[h.date] || []).push(h.name);
      c = { at: Date.now(), map };
      store.set(key, c);
    } catch (e) {
      console.warn('[new-tab] holidays', e);
      if (!c) return {}; // ağ yoksa tatilsiz göster; bir sonraki açılışta yeniden denenir
    }
  }
  return (holidayCache[id] = c.map);
}

async function renderCalendar() {
  const first = calView;
  const today = ymd(new Date());
  // Ay ızgarası: ayın ilk gününün pazartesisinden başla, 6 hafta göster (aylar arası atlamada yükseklik sabit kalsın).
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const years = new Set([start.getFullYear(), first.getFullYear(), new Date(start.getTime() + 41 * 864e5).getFullYear()]);
  const hol = Object.assign({}, ...(await Promise.all([...years].map(getHolidays))));
  if (first !== calView) return; // bu sırada başka aya geçildiyse eski çizimi bırak

  $('calTitle').textContent = calMonthFmt.format(first);
  const cells = [el('div', { class: 'cal-wk cal-h', text: 'Wk' }), ...['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => el('div', { class: 'cal-h' + (i > 4 ? ' we' : ''), text: d }))];
  const monthHol = [];
  for (let w = 0; w < 6; w++) {
    const monday = new Date(start); monday.setDate(start.getDate() + w * 7);
    cells.push(el('div', { class: 'cal-wk', text: String(isoWeek(monday)) }));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const key = ymd(d);
      const names = hol[key];
      const out = d.getMonth() !== first.getMonth();
      const cls = ['cal-d', out && 'out', i > 4 && 'we', key === today && 'today', names && 'hol'].filter(Boolean).join(' ');
      cells.push(el('div', { class: cls, title: names ? names.join(' · ') : calDayFmt.format(d), text: String(d.getDate()) }));
      if (names && !out) monthHol.push([d, names]);
    }
  }
  $('calGrid').replaceChildren(...cells);
  $('calHol').replaceChildren(...monthHol.map(([d, names]) => el('li', {},
    el('span', { class: 'cal-hol-d', text: calDayFmt.format(d) }), el('span', { text: names.join(' · ') }))));
  $('calHol').hidden = !monthHol.length;
}

function showMonth(delta) {
  calView = delta === 0 ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    : new Date(calView.getFullYear(), calView.getMonth() + delta, 1);
  renderCalendar();
}
function toggleCalendar(force) {
  const c = $('cal');
  const open = force === undefined ? c.hidden : force;
  c.hidden = !open;
  $('date').setAttribute('aria-expanded', String(open));
  if (open) showMonth(0);
}

$('date').addEventListener('click', () => toggleCalendar());
$('date').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCalendar(); } });
$('calPrev').addEventListener('click', () => showMonth(-1));
$('calNext').addEventListener('click', () => showMonth(1));
$('calToday').addEventListener('click', () => showMonth(0));
// Dışarı tıklayınca kapanır; açıkken PageUp/PageDown ya da ←/→ ay değiştirir.
document.addEventListener('click', (e) => { if (!$('cal').hidden && !e.target.closest('#cal') && !e.target.closest('#date')) toggleCalendar(false); });
document.addEventListener('keydown', (e) => {
  if ($('cal').hidden) return;
  if (e.key === 'Escape') { toggleCalendar(false); e.stopPropagation(); }
  else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && !e.altKey)) { if (document.activeElement.tagName !== 'INPUT') { e.preventDefault(); showMonth(-1); } }
  else if (e.key === 'PageDown' || e.key === 'ArrowRight') { if (document.activeElement.tagName !== 'INPUT') { e.preventDefault(); showMonth(1); } }
}, true);

// Tatil ülkesi değişince (settings.js) açık takvimi yeniden çiz.
function refreshCalendar() { if (calView && !$('cal').hidden) renderCalendar(); }
