'use strict';

/* =========================================================
   Küçük yardımcılar
   ========================================================= */
const $ = (id) => document.getElementById(id);
// Firefox'ta "browser" (söz veren/promise tabanlı), Chrome'da "chrome" nesnesi kullanılır; kodun geri kalanı "ext" üzerinden çalışır.
const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : (typeof chrome !== 'undefined' ? chrome : undefined);
const isExt = !!(ext && ext.runtime && ext.runtime.id);
const isFirefox = typeof browser !== 'undefined' && /Firefox\//.test(navigator.userAgent);

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) n.append(c);
  return n;
}
// Kodun içinde sabit duran SVG simgelerini öğeye çevirir (innerHTML yerine DOMParser: Firefox incelemesi bunu ister).
const svgParser = new DOMParser();
function svg(markup) {
  const doc = svgParser.parseFromString(markup.trim().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}
const CHEVRON = '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';
const FOLDER = '<svg class="folder-ic" viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

// Kalıcı ayarlar: eklentide ext.storage, önizlemede localStorage.
const store = {
  async get(key, def) {
    try {
      if (isExt) { const r = await ext.storage.local.get(key); return r[key] ?? def; }
      const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  async set(key, val) {
    try {
      if (isExt) await ext.storage.local.set({ [key]: val });
      else localStorage.setItem(key, JSON.stringify(val));
    } catch { /* depolama yoksa sessizce geç */ }
  },
};

const GLOBE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8a8f98" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>');
function favicon(url) {
  // Chrome: tarayıcının kendi simge önbelleği (dışarıya istek gitmez). Firefox'ta bu yok: DuckDuckGo simge servisi (yalnızca alan adı gider).
  if (isExt && !isFirefox) return ext.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(url) + '&size=32';
  let host = '';
  try { host = new URL(url).hostname; } catch { return GLOBE; }
  return host ? 'https://icons.duckduckgo.com/ip3/' + host + '.ico' : GLOBE;
}
function favImg(url, cls = 'fav') {
  const img = el('img', { class: cls, src: favicon(url), alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => { if (img.src !== GLOBE) img.src = GLOBE; }, { once: true });
  return img;
}

// Dilden bağımsız arama: küçük harf + aksanları sil ("musteri" → "Müşteri", "cafe" → "Café" bulur).
// Türkçe noktasız ı ve İ ayrıca düzeltilir; diğer harfler Unicode ayrıştırmasıyla sadeleşir.
function norm(s) {
  return (s || '').replace(/İ/g, 'I').toLowerCase().replace(/ı/g, 'i')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }

/* =========================================================
   Saat ve tarih
   ========================================================= */
const fmtDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function tick() {
  const d = new Date();
  const h = d.getHours();
  $('hm').textContent = String(h).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  $('sec').textContent = String(d.getSeconds()).padStart(2, '0');
  $('date').textContent = fmtDate.format(d);
  $('greet').textContent = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
}
tick();
setInterval(tick, 1000);

/* =========================================================
   Yer imleri
   ========================================================= */
let allLinks = [];   // arama dizini: {id, title, url, path}
let topFolders = []; // yer imi çubuğundaki klasörler
let rootLinks = [];  // çubukta doğrudan duran bağlantılar
let clicks = {};     // url → tıklama sayısı
let barId = '1';     // yeni öğelerin eklendiği yer imi çubuğu klasörü

async function getBarChildren() {
  if (isExt && ext.bookmarks) {
    const [root] = await ext.bookmarks.getTree();
    // Yeni Chrome sürümlerinde hem yerel hem hesap (senkron) yer imi çubuğu olabilir; ikisini birleştir.
    const bars = (root.children || []).filter((n) => n.folderType === 'bookmarks-bar' || n.id === '1' || n.id === 'toolbar_____');
    // Hesap (senkron) çubuğu varsa yeni öğeler oraya eklensin; yoksa yerel çubuğa.
    const main = bars.find((b) => b.syncing) || bars[0];
    if (main) barId = main.id;
    return stripSeparators(bars.flatMap((b) => b.children || []));
  }
  if (window.__PREVIEW_BAR__) return window.__PREVIEW_BAR__; // yalnızca tarayıcıda önizleme için
  return [];
}

// Firefox yer imlerinde ayraçlar da düğüm olarak gelir (type: 'separator'); klasör sanılmasınlar diye atılır.
function stripSeparators(nodes) {
  return nodes.filter((n) => n.type !== 'separator').map((n) => (n.children ? { ...n, children: stripSeparators(n.children) } : n));
}
function countLinks(n) { return n.url ? 1 : (n.children || []).reduce((a, c) => a + countLinks(c), 0); }

function indexLinks(nodes, path) {
  for (const n of nodes) {
    if (n.url) allLinks.push({ id: n.id, title: n.title || hostOf(n.url), url: n.url, path: path.join(' › ') });
    else indexLinks(n.children || [], [...path, n.title]);
  }
}

function trackClick(url) {
  clicks[url] = (clicks[url] || 0) + 1;
  store.set('clicks', clicks);
}

// "Project" klasöründe "Project DEV" → "DEV". Ön ek atılınca geriye bir şey kalmıyorsa tam ad kalır.
function stripPrefix(title, prefix) {
  if (!title || !prefix || !norm(title).startsWith(norm(prefix))) return title;
  const rest = title.slice(prefix.length).replace(/^[\s\-–—|:·_/]+/, '');
  return rest || title;
}

/* ---------------------------------------------------------
   Kenar çubuğu içinde klasör gezinmesi (telefondaki dosya uygulamaları gibi).
   Klasöre tıklayınca kenar çubuğu o klasörün içeriğine geçer; geri düğmesi,
   Backspace, Esc ya da Alt+← bir üst klasöre döner. navStack: açık klasörlerin id'leri.
   --------------------------------------------------------- */
let navStack = [];
let byId = new Map();    // id → klasör düğümü
let nodeById = new Map(); // id → her düğüm (klasör ya da bağlantı); yönetim menüsü ve sürükle-bırak için

function indexFolders(nodes, parentId = barId) {
  nodes.forEach((n, i) => {
    // Önizleme verisinde parentId/index yok; Chrome'un verdiği değer varsa o kullanılır.
    if (n.parentId == null) n.parentId = parentId;
    if (n.index == null) n.index = i;
    nodeById.set(n.id, n);
    if (!n.url) { byId.set(n.id, n); indexFolders(n.children || [], n.id); }
  });
}
// Kenar çubuğunda şu an açık klasör (kökteyse yer imi çubuğu).
function currentFolderId() { return navStack.length ? navStack[navStack.length - 1] : barId; }

function folderRow(f) {
  const b = el('button', { class: 'side-item', 'data-id': f.id, draggable: 'true', title: f.title || 'Untitled folder' },
    svg(FOLDER), el('span', { class: 'name', text: f.title || 'Untitled folder' }),
    el('small', { text: String(countLinks(f)) }), svg(CHEVRON));
  b.addEventListener('click', () => openFolder(f.id));
  return b;
}

function linkRow(n, prefix) {
  const a = el('a', { class: 'side-item', 'data-id': n.id, draggable: 'true', href: n.url, title: (n.title ? n.title + '\n' : '') + n.url },
    favImg(n.url), el('span', { class: 'name', text: stripPrefix(n.title, prefix) || hostOf(n.url) }));
  a.addEventListener('click', () => trackClick(n.url));
  a.addEventListener('auxclick', (e) => { if (e.button === 1) trackClick(n.url); });
  return a;
}

function openFolder(id) { navStack.push(id); renderNav('forward'); }
function goBack() { if (!navStack.length) return false; navStack.pop(); renderNav('back'); return true; }
function goTo(depth) { navStack = navStack.slice(0, depth); renderNav('back'); }
$('sideBack').addEventListener('click', goBack);

function renderNav(dir) {
  // Yer imleri değiştiyse artık olmayan klasörleri yığından at.
  while (navStack.length && !byId.has(navStack[navStack.length - 1])) navStack.pop();
  const atRoot = navStack.length === 0;
  $('sideRoot').hidden = !atRoot;
  $('sideFolder').hidden = atRoot;
  const view = atRoot ? $('sideRoot') : $('sideFolder');

  if (!atRoot) {
    const f = byId.get(navStack[navStack.length - 1]);
    const parent = navStack.length > 1 ? byId.get(navStack[navStack.length - 2]).title : 'Bookmarks';
    $('sideBackLabel').textContent = parent || 'Untitled';
    // Yol: üst klasörlere tıklayınca doğrudan oraya döner.
    const crumbs = [];
    navStack.slice(0, -1).forEach((id, i) => {
      const c = el('button', { text: byId.get(id).title || 'Untitled' });
      c.addEventListener('click', () => goTo(i + 1));
      crumbs.push(c, el('span', { text: '›' }));
    });
    $('sideCrumb').replaceChildren(...crumbs);
    $('sideCrumb').hidden = navStack.length < 2;
    $('sideTitle').textContent = f.title || 'Untitled folder';
    $('sideCount').textContent = countLinks(f) + (countLinks(f) === 1 ? ' link' : ' links');

    const kids = f.children || [];
    const folders = kids.filter((c) => !c.url);
    const links = kids.filter((c) => c.url);
    const items = [...folders.map((c) => { const r = folderRow(c); if (!countLinks(c)) r.classList.add('is-empty'); return r; }),
      ...links.map((n) => linkRow(n, f.title))];
    if (folders.length && links.length) items.splice(folders.length, 0, el('div', { class: 'side-sep' }));
    if (!items.length) items.push(el('div', { class: 'side-empty', text: 'This folder is empty. Right-click or use + to add a bookmark.' }));
    $('sideItems').replaceChildren(...items);
  }

  if (dir) {
    view.classList.remove('slide-forward', 'slide-back'); void view.offsetWidth;
    view.classList.add(dir === 'forward' ? 'slide-forward' : 'slide-back');
    $('side').scrollTop = 0;
    // Klavyeyle gezenler için odağı ilk öğeye taşı (fareyle tıklayınca odak halkası görünmez).
    const first = view.querySelector('.side-item');
    if (first) first.focus({ preventScroll: true });
  }
}

function renderSidebar() {
  $('folders').replaceChildren(...topFolders.map(folderRow));
  renderNav();
}

// Kenar çubuğunun üstü: çubukta doğrudan duran bağlantılar + en az iki kez açılan yer imleri.
function renderFrequent() {
  const known = new Map(allLinks.map((l) => [l.url, l]));
  const picked = new Map();
  for (const n of rootLinks) picked.set(n.url, { title: n.title || hostOf(n.url), url: n.url });
  Object.entries(clicks)
    .filter(([u, c]) => c >= 2 && known.has(u))
    .sort((a, b) => b[1] - a[1])
    .forEach(([u]) => { if (picked.size < 8 && !picked.has(u)) picked.set(u, known.get(u)); });

  $('frequentWrap').hidden = picked.size === 0;
  $('frequent').replaceChildren(...[...picked.values()].map((l) => {
    const a = el('a', { class: 'side-item', href: l.url, title: l.title + '\n' + l.url },
      favImg(l.url), el('span', { class: 'name', text: l.title }));
    a.addEventListener('click', () => trackClick(l.url));
    return a;
  }));
}

async function loadBookmarks() {
  const bar = await getBarChildren();
  topFolders = bar.filter((n) => !n.url);
  rootLinks = bar.filter((n) => n.url);
  allLinks = [];
  indexLinks(bar, []);
  byId = new Map();
  nodeById = new Map();
  indexFolders(bar);
  renderSidebar();
  renderFrequent();
}

/* =========================================================
   Arama
   ========================================================= */
const q = $('q');
const resultsEl = $('results');
let results = [];
let active = 0;

function score(link, terms) {
  const t = norm(link.title), u = norm(link.url), p = norm(link.path);
  let s = 0;
  for (const term of terms) {
    if (t.startsWith(term)) s += 30;
    else if (t.split(/[\s\-|·:/]+/).some((w) => w.startsWith(term))) s += 20;
    else if (t.includes(term)) s += 12;
    else if (hostOf(u).includes(term)) s += 8;
    else if (p.includes(term)) s += 5;
    else if (u.includes(term)) s += 3;
    else return 0; // her kelime bir yerde geçmeli
  }
  return s + Math.min(clicks[link.url] || 0, 10); // sık açtıkların biraz öne çıkar
}

function highlight(text, terms) {
  // Normalleştirilmiş metinde eşleşen aralıkları bulup <mark> ile sar (uzunluk korunur).
  const n = norm(text);
  if (n.length !== text.length) return document.createTextNode(text);
  const marks = new Array(text.length).fill(false);
  for (const term of terms) { let i = n.indexOf(term); if (i >= 0) for (let k = i; k < i + term.length; k++) marks[k] = true; }
  const frag = document.createDocumentFragment();
  let i = 0;
  while (i < text.length) {
    let j = i; while (j < text.length && marks[j] === marks[i]) j++;
    const part = text.slice(i, j);
    frag.append(marks[i] ? el('mark', { text: part }) : part);
    i = j;
  }
  return frag;
}

// Açık sekmeler: arama kutusuna odaklanınca alınır (başlık ve adres için "tabs" izni gerekir).
let openTabs = [];
async function refreshTabs() {
  if (!isExt || !ext.tabs) return;
  try {
    const me = await ext.tabs.getCurrent();
    openTabs = (await ext.tabs.query({}))
      .filter((t) => t.url && (!me || t.id !== me.id))
      .map((t) => ({ kind: 'tab', tabId: t.id, windowId: t.windowId, title: t.title || hostOf(t.url), url: t.url, path: '' }));
  } catch { openTabs = []; }
}
async function switchToTab(r) {
  await ext.tabs.update(r.tabId, { active: true });
  await ext.windows.update(r.windowId, { focused: true });
}

function resultRow(l, i, terms) {
  const isTab = l.kind === 'tab';
  const a = el('a', { href: l.url },
    favImg(l.url),
    el('div', { class: 'r-text' },
      el('div', { class: 'r-title' }, highlight(l.title, terms)),
      el('div', { class: 'r-path', text: (l.path ? l.path + '  ·  ' : '') + hostOf(l.url) })),
    isTab ? el('span', { class: 'r-badge', text: 'Switch to tab' }) : null);
  a.addEventListener('click', (e) => {
    if (isTab) { e.preventDefault(); switchToTab(l); } else trackClick(l.url);
  });
  const li = el('li', { role: 'option', class: i === active ? 'active' : null }, a);
  li.addEventListener('mousemove', () => setActive(i));
  return li;
}

function renderResults() {
  const raw = q.value.trim();
  if (!raw) { resultsEl.hidden = true; return; }
  const terms = norm(raw).split(/\s+/).filter(Boolean);
  const rank = (list, max) => list.map((l) => [l, score(l, terms)]).filter((x) => x[1] > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, max).map((x) => x[0]);
  const tabs = rank(openTabs, 5);
  const bms = rank(allLinks, 40).map((l) => ({ kind: 'bm', ...l }));
  results = [...tabs, ...bms];
  active = 0;
  if (!results.length) {
    resultsEl.replaceChildren(el('li', { class: 'r-empty', text: `Nothing found. Press Enter to search Google for "${raw}".` }));
  } else {
    const rows = [];
    let i = 0;
    if (tabs.length) { rows.push(el('li', { class: 'r-head', text: 'Open tabs' })); tabs.forEach((l) => rows.push(resultRow(l, i++, terms))); }
    if (bms.length) { if (tabs.length) rows.push(el('li', { class: 'r-head', text: 'Bookmarks' })); bms.forEach((l) => rows.push(resultRow(l, i++, terms))); }
    resultsEl.replaceChildren(...rows);
  }
  resultsEl.hidden = false;
}
function setActive(i) {
  const items = resultsEl.querySelectorAll('li[role=option]');
  if (!items.length) return;
  active = (i + items.length) % items.length;
  items.forEach((li, k) => li.classList.toggle('active', k === active));
  items[active].scrollIntoView({ block: 'nearest' });
}
function openUrl(url, newTab) {
  if (newTab) window.open(url, '_blank'); else location.href = url;
}

q.addEventListener('input', renderResults);
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
  else if (e.key === 'Escape') { q.value = ''; renderResults(); q.blur(); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    const newTab = e.ctrlKey || e.metaKey;
    const r = results[active];
    if (r && q.value.trim()) {
      if (r.kind === 'tab' && !newTab) switchToTab(r);
      else { trackClick(r.url); openUrl(r.url, newTab); }
    }
    else if (q.value.trim()) openUrl('https://www.google.com/search?q=' + encodeURIComponent(q.value.trim()), newTab);
  }
});
q.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== q) resultsEl.hidden = true; }, 150));
q.addEventListener('focus', async () => { await refreshTabs(); if (q.value.trim()) renderResults(); });

document.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (document.querySelector('dialog[open]')) return; // açık pencere varken kısayollar çalışmasın
  if (e.key === '/') { e.preventDefault(); q.focus(); return; }
  // Kenar çubuğunda bir üst klasöre dön.
  if ((e.key === 'Backspace' || e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft')) && navStack.length && !$('paneBm').hidden) { e.preventDefault(); goBack(); return; }
  // Kenar çubuğunda ok tuşlarıyla öğeler arasında gezin.
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && $('side').contains(document.activeElement)) {
    const items = [...$('side').querySelectorAll('button, a')].filter((x) => x.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    const next = items[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); }
    return;
  }
  // Sayfada herhangi bir harfe basınca doğrudan aramaya yaz.
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && /\S/.test(e.key)) q.focus();
});

/* =========================================================
   Hava durumu (Open-Meteo — anahtar gerektirmez)
   ========================================================= */
const WMO = {
  0: ['Clear', '☀️', '🌙'], 1: ['Mostly clear', '🌤️', '🌙'], 2: ['Partly cloudy', '⛅', '☁️'], 3: ['Overcast', '☁️', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Freezing fog', '🌫️'],
  51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'], 56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'], 85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm with hail', '⛈️'], 99: ['Thunderstorm with hail', '⛈️'],
};
function wmo(code, isDay = 1) {
  const w = WMO[code] || ['—', '🌡️'];
  return { text: w[0], icon: (!isDay && w[2]) ? w[2] : w[1] };
}
const DEFAULT_LOC = { mode: 'auto' }; // konum: tarayıcı konumu ya da kullanıcının seçtiği şehir; ikisi de yoksa şehir seçmesi istenir
const CACHE_MIN = 20;
// Birimler ayarlardan (settings.region; settings.js). Ayarlar henüz yüklenmediyse °C ve km/h.
const WIND_LABEL = { kmh: 'km/h', mph: 'mph', ms: 'm/s' };
const wxUnits = () => {
  const r = (typeof settings !== 'undefined' && settings.region) || {};
  return { temp: r.temp === 'F' ? 'F' : 'C', wind: WIND_LABEL[r.wind] ? r.wind : 'kmh' };
};

function getPosition() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => res(null), { timeout: 8000, maximumAge: 3600e3 });
  });
}
async function reverseName(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || null;
  } catch { return null; }
}

async function resolveLocation() {
  const saved = await store.get('loc', DEFAULT_LOC);
  if (saved.mode === 'city') return saved;
  const cachedAuto = await store.get('autoLocEn', null);
  if (cachedAuto && Date.now() - cachedAuto.at < 6 * 3600e3) return cachedAuto;
  const pos = await getPosition();
  if (!pos) return null; // konum izni yoksa kullanıcıdan şehir seçmesi istenir
  const loc = { mode: 'auto', ...pos, name: (await reverseName(pos.lat, pos.lon)) || 'Your location', at: Date.now() };
  store.set('autoLocEn', loc);
  return loc;
}

async function loadWeather(force = false) {
  try {
    const loc = await resolveLocation();
    $('weather').classList.toggle('no-loc', !loc);
    if (!loc) {
      $('wCityName').textContent = 'Set city';
      $('wDesc').textContent = 'Allow location access, or press 📍 to choose a city.';
      return;
    }
    $('wCityName').textContent = loc.name;
    const u = wxUnits();
    const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)},${u.temp},${u.wind}`;
    let cache = await store.get('wx', null);
    const stale = !cache || !cache.data || !cache.data.daily || !cache.data.daily.weather_code; // eski önbellekte 5 günlük veri yok
    if (force || stale || cache.key !== key || Date.now() - cache.at > CACHE_MIN * 60e3) {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
        '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m' +
        '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6' +
        (u.temp === 'F' ? '&temperature_unit=fahrenheit' : '') + (u.wind === 'mph' ? '&wind_speed_unit=mph' : u.wind === 'ms' ? '&wind_speed_unit=ms' : '');
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      cache = { key, at: Date.now(), data: await r.json() };
      store.set('wx', cache);
    }
    renderWeather(cache.data);
  } catch (err) {
    $('wDesc').textContent = 'Weather unavailable (check your network connection).';
    console.warn('[yeni-sekme] hava durumu', err);
  }
}

function renderWeather(d) {
  const c = d.current;
  const w = wmo(c.weather_code, c.is_day);
  $('wIcon').textContent = w.icon;
  $('wTemp').textContent = Math.round(c.temperature_2m) + '°';
  $('wDesc').textContent = `${w.text} · Feels like ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} ${WIND_LABEL[wxUnits().wind]}`;
  $('wRange').textContent = `Low ${Math.round(d.daily.temperature_2m_min[0])}° · High ${Math.round(d.daily.temperature_2m_max[0])}°`;

  // Sonraki 5 saat (API saatleri konumun yerel saatinde, "YYYY-MM-DDTHH:00" biçiminde).
  // 5 günlük görünümle aynı satır biçimi ve sayısı: sekme değişince kart boyu değişmesin.
  const nowKey = c.time.slice(0, 13);
  let start = d.hourly.time.findIndex((t) => t.slice(0, 13) === nowKey);
  if (start < 0) start = 0;
  const cells = [];
  for (let i = start + 1; i < Math.min(start + 6, d.hourly.time.length); i++) {
    const hw = wmo(d.hourly.weather_code[i], d.hourly.is_day[i]);
    const pp = d.hourly.precipitation_probability[i];
    cells.push(el('div', { class: 'w-day', title: hw.text },
      el('span', { class: 'w-day-name', text: d.hourly.time[i].slice(11, 16) }),
      el('span', { class: 'w-day-ic', text: hw.icon }),
      el('span', { class: 'w-day-pp', text: pp ? '💧' + pp + '%' : '' }),
      el('span', { class: 'w-day-t' }, el('b', { text: Math.round(d.hourly.temperature_2m[i]) + '°' }))));
  }
  $('wHours').replaceChildren(...cells);

  // Sonraki 5 gün (yarından itibaren). Gün adı, tarih dizesinden UTC öğlen saatiyle hesaplanır (saat dilimi kayması olmasın).
  const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
  const days = [];
  for (let i = 1; i < Math.min(6, d.daily.time.length); i++) {
    const dw = wmo(d.daily.weather_code[i]);
    const pp = d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[i] : null;
    days.push(el('div', { class: 'w-day', title: dw.text },
      el('span', { class: 'w-day-name', text: dayFmt.format(new Date(d.daily.time[i] + 'T12:00:00Z')) }),
      el('span', { class: 'w-day-ic', text: dw.icon }),
      el('span', { class: 'w-day-pp', text: pp ? '💧' + pp + '%' : '' }),
      el('span', { class: 'w-day-t' }, el('b', { text: Math.round(d.daily.temperature_2m_max[i]) + '°' }), ' ' + Math.round(d.daily.temperature_2m_min[i]) + '°')));
  }
  $('wDays').replaceChildren(...days);
}

// Hava durumu kartında "Hourly" ve "5 days" sekmeleri; seçim hatırlanır.
function setWxTab(days) {
  $('wHours').hidden = days;
  $('wDays').hidden = !days;
  $('wTabHours').setAttribute('aria-selected', String(!days));
  $('wTabDays').setAttribute('aria-selected', String(days));
}
$('wTabHours').addEventListener('click', () => { setWxTab(false); store.set('wxDaysOpen', false); });
$('wTabDays').addEventListener('click', () => { setWxTab(true); store.set('wxDaysOpen', true); });
store.get('wxDaysOpen', false).then(setWxTab);

// Şehir değiştirme
$('wCity').addEventListener('click', () => {
  const f = $('wCityForm'); f.hidden = !f.hidden;
  if (!f.hidden) { $('wCityInput').value = ''; $('wCityInput').focus(); }
});
$('wCityForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('wCityInput').value.trim();
  if (!name) return;
  try {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=' + encodeURIComponent(name));
    const j = await r.json();
    const g = j.results && j.results[0];
    if (!g) { $('wCityInput').value = ''; $('wCityInput').placeholder = 'Not found, try again'; return; }
    await store.set('loc', { mode: 'city', name: g.name, lat: g.latitude, lon: g.longitude });
    $('wCityForm').hidden = true;
    loadWeather(true);
  } catch { $('wCityInput').placeholder = 'Connection error'; }
});
$('wAuto').addEventListener('click', async () => {
  await store.set('loc', DEFAULT_LOC);
  await store.set('autoLocEn', null);
  $('wCityForm').hidden = true;
  loadWeather(true);
});

/* =========================================================
   Başlatma
   ========================================================= */
(async function init() {
  clicks = await store.get('clicks', {});
  await loadBookmarks();
  loadWeather();
  setInterval(() => loadWeather(), CACHE_MIN * 60e3);

  // Chrome'da yer imi eklenir/silinir/taşınırsa sayfayı yenilemeden güncelle.
  if (isExt && ext.bookmarks) {
    let t;
    const refresh = () => { clearTimeout(t); t = setTimeout(loadBookmarks, 200); };
    for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
      ext.bookmarks[ev] && ext.bookmarks[ev].addListener(refresh);
    }
  }
})();
