'use strict';
/* Ayarlar paneli ve dünya saatleri. Ayarlar Chrome hesabıyla senkronlanır (ext.storage.sync → "settings").
   newtab.js ve widgets.js'ten sonra yüklenir ($, el, syncStore, toggleBgPanel onlardan gelir). */

/* ---------------------------------------------------------
   Bölge tahmini: ilk açılışta tarayıcı dilinin ülkesinden (örn. en-US → US, de-DE → DE, tr → TR)
   ana para birimi, tatil ülkesi ve birimler önerilir; hepsi ayarlardan değiştirilebilir.
   --------------------------------------------------------- */
const EURO_AREA = 'AT BE BG CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
const REGION_CURRENCY = {
  US: 'usd', GB: 'gbp', TR: 'try', JP: 'jpy', CN: 'cny', IN: 'inr', CA: 'cad', AU: 'aud', NZ: 'nzd', CH: 'chf', LI: 'chf',
  SE: 'sek', NO: 'nok', DK: 'dkk', IS: 'isk', PL: 'pln', CZ: 'czk', HU: 'huf', RO: 'ron', RS: 'rsd', UA: 'uah', RU: 'rub',
  BR: 'brl', MX: 'mxn', AR: 'ars', CL: 'clp', CO: 'cop', PE: 'pen', ZA: 'zar', EG: 'egp', NG: 'ngn', KE: 'kes', MA: 'mad',
  SA: 'sar', AE: 'aed', QA: 'qar', KW: 'kwd', IL: 'ils', KR: 'krw', SG: 'sgd', HK: 'hkd', TW: 'twd', TH: 'thb', ID: 'idr',
  MY: 'myr', PH: 'php', VN: 'vnd', PK: 'pkr', BD: 'bdt', KZ: 'kzt', AZ: 'azn', GE: 'gel',
};
function guessRegion() {
  let cc = '';
  try { cc = new Intl.Locale(navigator.language || 'en-US').maximize().region || ''; } catch { /* geçersiz dil etiketi */ }
  const base = EURO_AREA.includes(cc) ? 'eur' : REGION_CURRENCY[cc] || 'usd';
  return {
    base, holidays: cc,
    temp: ['US', 'LR', 'BS', 'KY', 'PW', 'FM', 'MH'].includes(cc) ? 'F' : 'C',
    wind: ['US', 'GB'].includes(cc) ? 'mph' : 'kmh',
  };
}
const GUESS = guessRegion();
const FX_DEFAULT = ['usd', 'eur', 'gbp', 'jpy', 'chf'].filter((c) => c !== GUESS.base).slice(0, 4);

const DEFAULT_SETTINGS = {
  cards: { todo: true, notes: true, markets: true, pomo: true },
  order: ['todo', 'notes', 'markets', 'pomo'], // kartların görünüm sırası (hava durumu hariç)
  seconds: true, quote: true, focus: true, weather: true, sidebar: true,
  accent: 'blue',
  clocks: [],
  region: GUESS,
  // Piyasalar kartı (markets.js). fx/metals/crypto: currency-api kodları (küçük harf).
  // stocks: Finnhub sembolleri (kullanıcının kendi anahtarıyla). funds: TEFAS fonları (bölgesel kaynak, varsayılan kapalı).
  markets: {
    fx: FX_DEFAULT, metals: ['xau', 'xag'], metalUnit: 'oz', crypto: ['btc', 'eth'],
    stocks: [], finnhubKey: '', funds: [], tefas: false,
  },
};
const ACCENTS = { blue: '#2f6fed', green: '#1a8f5a', purple: '#7c4dff', orange: '#e8710a', pink: '#d63384' };
let settings = structuredClone(DEFAULT_SETTINGS);

const NESTED = new Set(['cards', 'region', 'markets']);
function mergeSettings(saved) {
  const s = structuredClone(DEFAULT_SETTINGS);
  if (!saved) return s;
  if (!saved.region) saved = migrateV2(saved);
  for (const k of Object.keys(s)) if (saved[k] !== undefined) s[k] = NESTED.has(k) ? { ...s[k], ...saved[k] } : saved[k];
  s.order = sanitizeOrder(s.order);
  return s;
}
// 2.x ayarlarından geçiş (yalnızca eklentinin ilk sahibinin kurulumu): 2.x Türkiye'ye göre çalışıyordu,
// bu yüzden bölge TR olarak korunur. Yahoo'ya bağlı hisse/emtia listeleri 3.0'da kaynakları kalktığı için atılır.
function migrateV2(saved) {
  const m = saved.markets || {};
  const funds = (m.funds || []).filter((f) => f.src === 'tefas').map(({ s: code, n }) => ({ s: code, n, src: 'tefas' }));
  return {
    ...saved,
    region: { base: 'try', holidays: 'TR', temp: 'C', wind: 'kmh' },
    markets: { fx: ['usd', 'eur', 'gbp'], metals: ['xau', 'xag'], metalUnit: 'g', crypto: ['btc', 'eth'], stocks: [], finnhubKey: '', funds, tefas: funds.length > 0 },
  };
}
const CARD_IDS = ['todo', 'notes', 'markets', 'pomo'];
const CARD_EL = { todo: 'wTodo', notes: 'wNotes', markets: 'wMarkets', pomo: 'wPomo' };
function sanitizeOrder(o) { // yalnızca bilinen kimlikler, tekrarsız; eksikler sona eklenir
  const seen = (Array.isArray(o) ? o : []).filter((id, i, a) => CARD_IDS.includes(id) && a.indexOf(id) === i);
  return seen.concat(CARD_IDS.filter((id) => !seen.includes(id)));
}
function saveSettings() { syncStore.set('settings', settings); applySettings(); }

function applySettings() {
  const c = settings.cards;
  $('wTodo').hidden = !c.todo; $('wNotes').hidden = !c.notes; $('wMarkets').hidden = !c.markets; $('wPomo').hidden = !c.pomo;
  const wrap = document.querySelector('.widgets');
  // Kartlar yalnızca sıra gerçekten değiştiyse taşınır: taşımak not kutusundaki odağı ve kaydırmayı sıfırlar
  // (başka cihazdan senkron gelen bir ayar değişikliği yazarken odağı kaçırmasın). Hava durumu yerinde kalır.
  const now = [...wrap.children].map((n) => n.id).filter((id) => Object.values(CARD_EL).includes(id));
  if (now.join() !== settings.order.map((id) => CARD_EL[id]).join()) {
    for (const id of settings.order) wrap.insertBefore($(CARD_EL[id]), $('weather'));
  }
  document.querySelector('.widgets').hidden = !(c.todo || c.notes || c.markets || c.pomo || settings.weather);
  $('sec').hidden = !settings.seconds;
  $('quote').hidden = !settings.quote;
  $('focus').hidden = !settings.focus;
  $('weather').hidden = !settings.weather;
  document.body.classList.toggle('no-side', !settings.sidebar);
  document.documentElement.dataset.accent = settings.accent;
  renderClocks();
  onRegionChange();
  if (typeof onMarketSettings === 'function') onMarketSettings(); // markets.js
  if (!$('settingsPanel').hidden) renderSettingsPanel();
}

// Birim ya da tatil ülkesi değişince hava durumunu ve takvimi yenile (başka cihazdan senkron gelince de).
let lastRegion = null;
function onRegionChange() {
  const r = settings.region, prev = lastRegion;
  lastRegion = { ...r };
  if (!prev) { if (r.temp !== 'C' || r.wind !== 'kmh') loadWeather(true); return; } // ilk yüklemede hava °C/km/h ile başlamış olabilir
  if (prev.temp !== r.temp || prev.wind !== r.wind) loadWeather(true);
  if (prev.holidays !== r.holidays && typeof refreshCalendar === 'function') refreshCalendar();
}

/* ---------------------------------------------------------
   Dünya saatleri: saatin altında küçük satır; yerel tarihten farklı günse +1 / −1 gösterir.
   --------------------------------------------------------- */
const dayKeyFmt = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
function renderClocks() {
  const box = $('clocks');
  box.hidden = !settings.clocks.length;
  const now = new Date();
  const localDay = dayKeyFmt(undefined).format(now);
  box.replaceChildren(...settings.clocks.map((c) => {
    let time = '—', diff = '';
    try {
      time = new Intl.DateTimeFormat(LOCALE, { timeZone: c.tz, hour: '2-digit', minute: '2-digit' }).format(now);
      const d = dayKeyFmt(c.tz).format(now);
      if (d > localDay) diff = '+1'; else if (d < localDay) diff = '−1';
    } catch { /* geçersiz saat dilimi */ }
    return el('span', { class: 'clock-chip', title: c.tz }, el('span', { class: 'clock-name', text: c.name }), el('b', { text: time }), diff ? el('sup', { text: diff }) : null);
  }));
}
setInterval(renderClocks, 15e3);

/* ---------------------------------------------------------
   Ayarlar paneli
   --------------------------------------------------------- */
const TOGGLES = [
  ['seconds', t('set.t.seconds')], ['quote', t('set.t.quote')], ['focus', t('set.t.focus')], ['weather', t('set.t.weather')],
  ['sidebar', t('set.t.sidebar')],
];
const CARD_LABELS = { todo: t('set.t.todo'), notes: t('set.t.notes'), markets: t('set.t.markets'), pomo: t('set.t.pomo') };
const getPath = (k) => k.split('.').reduce((o, p) => o[p], settings);
function setPath(k, v) { const ps = k.split('.'); const last = ps.pop(); ps.reduce((o, p) => o[p], settings)[last] = v; }

function toggleRow(k, label) {
  const cb = el('input', { type: 'checkbox' });
  cb.checked = !!getPath(k);
  cb.addEventListener('change', () => { setPath(k, cb.checked); saveSettings(); });
  return el('label', { class: 'set-toggle' }, cb, el('span', { text: label }));
}
function moveCard(i, d) {
  const o = settings.order, j = i + d;
  if (j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]];
  saveSettings();
}
function renderSettingsPanel() {
  const cardRows = settings.order.map((id, i, o) => {
    const name = CARD_LABELS[id];
    const mv = (d, sym, key) => {
      if (i + d < 0 || i + d >= o.length) return el('span', { class: 'mv-spacer' });
      const b = el('button', { class: 'mv-btn', type: 'button', title: t(key, { name }), 'aria-label': t(key, { name }), text: sym });
      b.addEventListener('click', () => moveCard(i, d));
      return b;
    };
    return el('div', { class: 'set-toggle-row' }, toggleRow('cards.' + id, name), mv(-1, '↑', 'common.moveUpX'), mv(1, '↓', 'common.moveDownX'));
  });
  $('setToggles').replaceChildren(...TOGGLES.map(([k, label]) => toggleRow(k, label)), el('div', { class: 'set-order' }, ...cardRows));
  $('setAccents').replaceChildren(...Object.entries(ACCENTS).map(([name, color]) => {
    const b = el('button', { class: 'swatch' + (settings.accent === name ? ' active' : ''), title: t('accent.' + name), 'aria-label': t('accent.aria', { name: t('accent.' + name) }), 'aria-pressed': String(settings.accent === name) });
    b.style.background = color;
    b.addEventListener('click', () => { settings.accent = name; saveSettings(); });
    return b;
  }));
  $('clockList').replaceChildren(...settings.clocks.map((c, i) => {
    const del = el('button', { class: 'link-btn', title: t('common.remove'), 'aria-label': t('common.removeX', { name: c.name }), text: '✕' });
    del.addEventListener('click', () => { settings.clocks.splice(i, 1); saveSettings(); });
    return el('li', {}, el('span', { text: c.name }), el('small', { text: c.tz }), del);
  }));
  if (!settings.clocks.length) $('clockList').replaceChildren(el('li', { class: 'muted', text: t('set.noClocks') }));
  renderRegion();
  if (typeof renderWatchlist === 'function') renderWatchlist(); // markets.js
}
/* ---- Bölge ve birimler ---- */
const regionNames = new Intl.DisplayNames([LANG], { type: 'region' });
const currencyNames = new Intl.DisplayNames([LANG], { type: 'currency' });
function currencyCodes() { // tarayıcının bildiği ISO para birimleri; currency-api çoğunu kapsıyor
  try { return Intl.supportedValuesOf('currency').map((c) => c.toLowerCase()); } catch { return Object.values(REGION_CURRENCY).concat('eur'); }
}
const currencyLabel = (c) => `${c.toUpperCase()} — ${currencyNames.of(c.toUpperCase()) || c}`;
async function holidayCountries() { // Nager.Date'in desteklediği ülkeler (30 gün önbellek)
  let c = await store.get('holidayCountries', null);
  if (!c || Date.now() - c.at > 30 * 864e5) {
    try {
      const r = await fetch('https://date.nager.at/api/v3/AvailableCountries');
      c = { at: Date.now(), list: (await r.json()).map((x) => x.countryCode) };
      store.set('holidayCountries', c);
    } catch { if (!c) return settings.region.holidays ? [settings.region.holidays] : []; }
  }
  return c.list;
}
function selectRow(label, id, options, value, onChange) {
  const sel = el('select', { id });
  sel.replaceChildren(...options.map(([v, t]) => el('option', { value: v, text: t })));
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return el('label', { class: 'set-field' }, el('span', { text: label }), sel);
}
async function renderRegion() {
  const r = settings.region;
  const setR = (k) => (v) => { settings.region[k] = v; saveSettings(); };
  const cur = [...new Set(currencyCodes().concat(r.base))].sort().map((c) => [c, currencyLabel(c)]);
  const countries = await holidayCountries();
  const hol = [['', t('common.none')]].concat(countries.map((cc) => [cc, regionNames.of(cc) || cc]).sort((a, b) => a[1].localeCompare(b[1], LANG)));
  if (countries.length && r.holidays && !countries.includes(r.holidays)) hol.push([r.holidays, regionNames.of(r.holidays) + t('set.noData')]);
  $('setRegion').replaceChildren(
    // Dil cihaza özeldir (localStorage), ayarlarla senkronlanmaz; seçince sayfa yenilenir (i18n.js).
    selectRow(t('set.language'), 'setLang', [['auto', t('lang.auto')], ['en', 'English'], ['tr', 'Türkçe']], getLangPref(), setLang),
    selectRow(t('set.currency'), 'setBase', cur, r.base, (v) => {
      // Ana para birimi değişince eskisi izleme listesine geçer (yenisi listede varsa onun yerine).
      const fx = settings.markets.fx, old = settings.region.base, i = fx.indexOf(v);
      if (i >= 0) fx[i] = old; else if (!fx.includes(old)) fx.unshift(old);
      settings.region.base = v; saveSettings();
    }),
    selectRow(t('set.holidays'), 'setHol', hol, r.holidays, setR('holidays')),
    selectRow(t('set.temperature'), 'setTemp', [['C', '°C'], ['F', '°F']], r.temp, setR('temp')),
    selectRow(t('set.wind'), 'setWind', [['kmh', 'km/h'], ['mph', 'mph'], ['ms', 'm/s']], r.wind, setR('wind')));
}

function toggleSettings(force) {
  const p = $('settingsPanel');
  p.hidden = force === undefined ? !p.hidden : !force;
  if (!p.hidden) { $('bgPanel').hidden = true; renderSettingsPanel(); }
}
$('setOpen').addEventListener('click', () => toggleSettings());
$('setClose').addEventListener('click', () => toggleSettings(false));
$('setBg').addEventListener('click', () => { toggleSettings(false); toggleBgPanel(); });

// Şehir ekleme: Open-Meteo şehir araması saat dilimini de verir.
$('clockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('clockInput').value.trim();
  if (!name) return;
  $('clockState').textContent = t('common.searching');
  try {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=' + LANG + '&name=' + encodeURIComponent(name));
    const g = ((await r.json()).results || [])[0];
    if (!g || !g.timezone) { $('clockState').textContent = t('set.cityNotFound'); return; }
    settings.clocks.push({ name: g.name, tz: g.timezone });
    $('clockInput').value = '';
    $('clockState').textContent = t('set.added', { name: g.name + (g.country ? ', ' + g.country : '') });
    saveSettings();
  } catch { $('clockState').textContent = t('set.connError'); }
});

/* ---------------------------------------------------------
   Sade mod: yalnızca arka plan, selamlama, saat ve tarih kalır. Tercih bu cihazda localStorage "zen" anahtarında
   tutulur; eşzamanlı okunabildiği için newtab.js sayfa çizilmeden sınıfı ekler (tam sayfa bir an görünüp kaybolmaz).
   --------------------------------------------------------- */
function toggleZen(force) {
  const on = force === undefined ? !document.body.classList.contains('zen') : !!force;
  document.body.classList.toggle('zen', on);
  if (on) { $('settingsPanel').hidden = true; $('bgPanel').hidden = true; }
  try { if (on) localStorage.setItem('zen', '1'); else localStorage.removeItem('zen'); } catch { /* depolama kapalı */ }
}
$('zenBtn').addEventListener('click', () => toggleZen(true));
$('zenExit').addEventListener('click', () => toggleZen(false));

/* ---------------------------------------------------------
   Yedek: ayarları ve verileri JSON dosyasına aktar / dosyadan içe aktar.
   Önbellekler, Finnhub anahtarı ve duvar kâğıtları dışarıda kalır.
   --------------------------------------------------------- */
const BK_SYNC = ['settings', 'focus', 'todos', 'feeds'];
const BK_LOCAL = ['note', 'clicks', 'loc', 'bgMode', 'newsFilter'];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
// Her anahtarın beklenen türü: elle düzenlenmiş bir dosya yanlış türde değer yazıp bütün senkron cihazlarda
// sayfayı her açılışta bozmasın. Türü tutmayan anahtar atlanır.
const BK_TYPE = {
  settings: isObj, focus: isObj, todos: Array.isArray, feeds: Array.isArray,
  note: (v) => typeof v === 'string', clicks: isObj, loc: isObj,
  bgMode: (v) => ['potd', 'own', 'off'].includes(v), newsFilter: (v) => typeof v === 'string',
};
// Ayarların üst düzey alanlarından türü varsayılanla uyuşmayanları atar (ör. clocks: "x").
function cleanSettings(s) {
  const kind = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
  const out = {};
  for (const [k, v] of Object.entries(s)) if (k in DEFAULT_SETTINGS && kind(v) === kind(DEFAULT_SETTINGS[k])) out[k] = v;
  return out;
}
// Yedek dosyasını doğrular; yalnızca bilinen ve türü doğru anahtarları döndürür. Geçersizse null.
function parseBackup(data) {
  if (!isObj(data) || data.app !== 'kotilo-newtab' || data.format !== 1 || !isObj(data.sync) || !isObj(data.local)) return null;
  const sync = {}, local = {};
  for (const k of BK_SYNC) if (data.sync[k] !== undefined && BK_TYPE[k](data.sync[k])) sync[k] = data.sync[k];
  for (const k of BK_LOCAL) if (data.local[k] !== undefined && BK_TYPE[k](data.local[k])) local[k] = data.local[k];
  if (sync.settings) sync.settings = cleanSettings(sync.settings);
  const lang = ['en', 'tr', 'auto'].includes(data.local.lang) ? data.local.lang : null;
  return { sync, local, lang };
}
async function exportBackup() {
  const s = structuredClone(settings);
  s.markets.finnhubKey = ''; // API anahtarı dışarı verilmez
  const sync = { settings: s }, local = {};
  for (const k of ['focus', 'todos', 'feeds']) sync[k] = await syncStore.get(k, null);
  for (const k of BK_LOCAL) local[k] = await store.get(k, null);
  try { local.lang = getLangPref(); } catch { /* yok say */ }
  for (const o of [sync, local]) for (const k of Object.keys(o)) if (o[k] === null) delete o[k];
  let version = '3.2.0';
  try { version = ext.runtime.getManifest().version; } catch { /* önizleme */ }
  const out = { app: 'kotilo-newtab', format: 1, version, exportedAt: new Date().toISOString(), sync, local };
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })), download: `kotilo-newtab-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5e3);
  $('bkState').textContent = t('set.exported');
}
async function importBackup(file) {
  const state = $('bkState');
  let b = null;
  try { b = parseBackup(JSON.parse(await file.text())); } catch { /* geçersiz JSON */ }
  if (!b) { state.textContent = t('set.importBad'); return; }
  const ok = await openDialog({ title: t('set.importTitle'), message: t('set.importMsg'), okText: t('set.importOk'), danger: true });
  if (!ok) { state.textContent = ''; return; }
  const failed = [];
  if (b.sync.settings !== undefined) {
    const m = mergeSettings(isObj(b.sync.settings) ? b.sync.settings : null);
    if (!m.markets.finnhubKey) m.markets.finnhubKey = settings.markets.finnhubKey; // mevcut anahtar korunur
    b.sync.settings = m;
  }
  for (const [k, v] of Object.entries(b.sync)) if (!(await syncStore.set(k, v))) failed.push(k);
  for (const [k, v] of Object.entries(b.local)) await store.set(k, v);
  if (b.lang) {
    try { localStorage.setItem('lang', b.lang); } catch { /* yok say */ }
    // background.js bildirim dilini storage.local "lang" değerinden okur. Önizlemede store da localStorage'a
    // (JSON olarak) yazdığı için düz "lang" değerini bozmasın diye yalnızca eklentide yazılır.
    if (isExt) await store.set('lang', b.lang);
  }
  // Kısmi hatada da yeniden yüklenir: yerel anahtarlar yazıldı, ekrandaki eski not bir sonraki tuşta onları ezmesin.
  state.textContent = failed.length ? t('set.importPartial', { keys: failed.join(', ') }) : t('set.imported');
  setTimeout(() => location.reload(), failed.length ? 4000 : 800);
}
$('bkExport').addEventListener('click', () => exportBackup().catch(() => { $('bkState').textContent = t('set.connError'); }));
$('bkImport').addEventListener('click', () => $('bkFile').click());
$('bkFile').addEventListener('change', () => { const f = $('bkFile').files[0]; $('bkFile').value = ''; if (f) importBackup(f); });

// Kenar çubuğunu gizle / göster
$('sideHide').addEventListener('click', () => { settings.sidebar = false; saveSettings(); });
$('sideShow').addEventListener('click', () => { settings.sidebar = true; saveSettings(); });

// Esc açık paneli kapatır (yakalama aşamasında, kenar çubuğunun "geri" kısayolundan önce).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  const open = ['settingsPanel', 'bgPanel'].map($).find((p) => !p.hidden);
  if (open) { open.hidden = true; e.stopPropagation(); }
}, true);

(async function initSettings() {
  settings = mergeSettings(await syncStore.get('settings', null));
  applySettings();
  if (isExt) ext.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync' && ch.settings) { settings = mergeSettings(ch.settings.newValue); applySettings(); }
  });
})();
