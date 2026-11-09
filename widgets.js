'use strict';
/* Orta alandaki parçalar: günün sözü, odak, yapılacaklar, not, son sekmeler, arka plan.
   newtab.js'teki yardımcıları ($, el, store, isExt, favImg, hostOf) kullanır; ondan sonra yüklenir. */

// Chrome hesabıyla senkronlanan depolama (odak ve yapılacaklar). Önizlemede localStorage.
const syncStore = {
  async get(key, def) {
    try {
      if (isExt) { const r = await ext.storage.sync.get(key); return r[key] ?? def; }
      const v = localStorage.getItem('sync:' + key); return v == null ? def : JSON.parse(v);
    } catch { return def; }
  },
  async set(key, val) {
    try {
      if (isExt) await ext.storage.sync.set({ [key]: val });
      else localStorage.setItem('sync:' + key, JSON.stringify(val));
      return true;
    } catch (e) { console.warn('[new-tab] sync save', e); return false; }
  },
};
const todayKey = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD (yerel saat)
const fmtTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/* =========================================================
   Günün sözü — BrainyQuote'un resmî günün sözü RSS akışı; ulaşılamazsa aşağıdaki yerel liste.
   Günde bir kez alınır; tıklayınca sıradaki söz gelir (önce akıştaki diğer sözler, sonra yerel liste).
   Yerel liste: yazarı kesin, telif süresi dolmuş evrensel sözler.
   ========================================================= */
const QUOTES = [
  ['We suffer more often in imagination than in reality.', 'Seneca'], ['While we wait for life, life passes.', 'Seneca'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['The happiness of your life depends upon the quality of your thoughts.', 'Marcus Aurelius'], ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
  ['You have power over your mind, not outside events. Realize this, and you will find strength.', 'Marcus Aurelius'],
  ['Real knowledge is to know the extent of one’s ignorance.', 'Confucius'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'], ['Knowing others is intelligence; knowing yourself is true wisdom.', 'Lao Tzu'],
  ['We are what we repeatedly do.', 'Will Durant, on Aristotle'], ['Well begun is half done.', 'Aristotle'],
  ['The unexamined life is not worth living.', 'Socrates'], ['No man ever steps in the same river twice.', 'Heraclitus'],
  ['First say to yourself what you would be; and then do what you have to do.', 'Epictetus'], ['Wealth consists not in having great possessions, but in having few wants.', 'Epictetus'],
  ['Lost time is never found again.', 'Benjamin Franklin'], ['Well done is better than well said.', 'Benjamin Franklin'],
  ['Our life is frittered away by detail. Simplify, simplify.', 'Henry David Thoreau'],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
  ['Genius is one percent inspiration and ninety-nine percent perspiration.', 'Thomas Edison'], ['Imagination is more important than knowledge.', 'Albert Einstein'],
  ['Life is like riding a bicycle. To keep your balance you must keep moving.', 'Albert Einstein'], ['Make it work, make it right, make it fast.', 'Kent Beck'],
  ['Premature optimization is the root of all evil.', 'Donald Knuth'], ['Talk is cheap. Show me the code.', 'Linus Torvalds'],
  ['Simple things should be simple, complex things should be possible.', 'Alan Kay'], ['The best way to predict the future is to invent it.', 'Alan Kay'],
];
const QUOTE_RETRY_MIN = 60; // kaynaklara ulaşılamazsa en erken bu kadar dakika sonra yeniden denenir
const cleanQuote = (t) => String(t || '').replace(/\s+/g, ' ').trim().replace(/^["“”]+|["“”]+$/g, '').trim();

async function fetchBrainyQuotes() {
  const r = await fetch('https://www.brainyquote.com/link/quotebr.rss');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
  const items = [...xml.querySelectorAll('item')].map((it) => ({
    text: cleanQuote(it.querySelector('description')?.textContent),
    who: (it.querySelector('title')?.textContent || '').trim(),
  })).filter((q) => q.text);
  if (!items.length) throw new Error('empty feed');
  return items;
}
const QUOTE_SOURCES = [['BrainyQuote', 'https://www.brainyquote.com/quote_of_the_day', fetchBrainyQuotes]];

let quoteList = QUOTES.map(([text, who]) => ({ text, who })), quoteSrc = null, quoteOffset = 0;
function localStart() { // yerel listede güne göre başlangıç noktası (internet yokken her gün farklı söz)
  const start = new Date(new Date().getFullYear(), 0, 0);
  return Math.floor((Date.now() - start) / 864e5);
}
function renderQuote() {
  const local = QUOTES.map(([text, who]) => ({ text, who }));
  const day = localStart();
  const rotated = local.slice(day % local.length).concat(local.slice(0, day % local.length));
  const list = quoteSrc ? quoteList.concat(rotated) : rotated;
  const q = list[quoteOffset % list.length];
  const remote = quoteSrc && quoteOffset % list.length < quoteList.length;
  $('quote').replaceChildren('“' + q.text + '”', q.who ? el('cite', { text: '— ' + q.who }) : '');
  $('quote').title = (remote ? (quoteOffset % list.length === 0 ? 'Quote of the day · ' : '') + quoteSrc.name : 'Offline quote list') + ' — click for another';
}
async function loadQuote() {
  const cache = await store.get('qotd', null);
  if (cache && cache.date === todayKey() && cache.items?.length) {
    quoteList = cache.items; quoteSrc = { name: cache.src, link: cache.link };
  } else if (!cache?.failAt || Date.now() - cache.failAt > QUOTE_RETRY_MIN * 60e3) {
    for (const [name, link, fetcher] of QUOTE_SOURCES) {
      try {
        const items = await fetcher();
        quoteList = items; quoteSrc = { name, link };
        store.set('qotd', { date: todayKey(), src: name, link, items });
        break;
      } catch (e) { console.warn('[new-tab] quote', name, e); }
    }
    if (!quoteSrc) store.set('qotd', { date: null, items: [], failAt: Date.now() }); // bugün yerel liste; bir saat sonra yeniden dener
  }
  renderQuote();
}
$('quote').addEventListener('click', () => { quoteOffset++; renderQuote(); });
renderQuote();
loadQuote();

/* =========================================================
   Günün odağı — her gün sıfırlanır.
   ========================================================= */
let focus = null; // {date, text, done}
function renderFocus() {
  const has = focus && focus.date === todayKey() && focus.text;
  $('focusForm').hidden = !!has;
  $('focusShow').hidden = !has;
  if (has) {
    $('focusText').textContent = focus.text;
    $('focusDone').checked = !!focus.done;
    $('focusText').parentElement.classList.toggle('done', !!focus.done);
  }
}
$('focusForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('focusInput').value.trim();
  if (!text) return;
  focus = { date: todayKey(), text, done: false };
  syncStore.set('focus', focus); renderFocus();
});
$('focusDone').addEventListener('change', () => {
  focus.done = $('focusDone').checked; syncStore.set('focus', focus); renderFocus();
});
$('focusEdit').addEventListener('click', () => {
  $('focusInput').value = focus ? focus.text : '';
  focus = null; renderFocus(); $('focusInput').focus();
});
// Odağı sil: kayıttan da kaldırılır, soru alanı boş olarak geri gelir.
$('focusDel').addEventListener('click', () => {
  focus = null;
  syncStore.set('focus', null);
  $('focusInput').value = '';
  renderFocus();
});

/* =========================================================
   Yapılacaklar
   ========================================================= */
let todos = []; // [{id, text, done}]
function saveTodos() { syncStore.set('todos', todos); renderTodos(); }
function renderTodos() {
  const ul = $('todos');
  if (!todos.length) { ul.replaceChildren(el('li', { class: 'empty', text: 'Nothing here yet. Type below and press Enter.' })); }
  else {
    ul.replaceChildren(...todos.map((t) => {
      const cb = el('input', { type: 'checkbox', 'aria-label': 'Done' });
      cb.checked = t.done;
      cb.addEventListener('change', () => { t.done = cb.checked; saveTodos(); });
      const del = el('button', { title: 'Delete', 'aria-label': 'Delete', text: '✕' });
      del.addEventListener('click', () => { todos = todos.filter((x) => x !== t); saveTodos(); });
      return el('li', { class: t.done ? 'done' : null }, cb, el('span', { text: t.text }), del);
    }));
  }
  $('todoClear').hidden = !todos.some((t) => t.done);
}
$('todoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('todoInput').value.trim();
  if (!text) return;
  todos.push({ id: Date.now(), text, done: false });
  $('todoInput').value = '';
  saveTodos();
});
$('todoClear').addEventListener('click', () => { todos = todos.filter((t) => !t.done); saveTodos(); });

/* =========================================================
   Not — ext.storage.local'da tutulur (senkron alanın öğe başına 8 KB sınırı uzun notlara yetmez).
   ========================================================= */
let noteTimer;
$('note').addEventListener('input', () => {
  $('noteState').textContent = 'Typing…';
  clearTimeout(noteTimer);
  noteTimer = setTimeout(async () => {
    await store.set('note', $('note').value);
    $('noteState').textContent = 'Saved ' + fmtTime.format(new Date());
  }, 500);
});

/* Piyasalar kartı 3.0'dan beri tamamen markets.js'te. */

/* =========================================================
   Kenar çubuğu sekmeleri: Bookmarks / Recent (son kapatılanlar) / Top sites (en çok ziyaret edilenler)
   ========================================================= */
let sideTab = 'bm';
const SIDE_PANES = { bm: 'paneBm', closed: 'paneClosed', top: 'paneTop', news: 'paneNews' };
function emptyRow(text) { return el('div', { class: 'side-empty', text }); }

function setSideTab(tab) {
  sideTab = SIDE_PANES[tab] ? tab : 'bm';
  for (const [k, id] of Object.entries(SIDE_PANES)) {
    $(id).hidden = k !== sideTab;
    const b = document.querySelector(`.side-tab[data-tab="${k}"]`);
    b.setAttribute('aria-selected', String(k === sideTab));
    b.tabIndex = k === sideTab ? 0 : -1;
  }
  // ＋: yer imlerinde yer imi/klasör, haberlerde RSS kaynağı ekler; diğer sekmelerde gizli.
  $('sideAdd').style.visibility = sideTab === 'bm' || sideTab === 'news' ? '' : 'hidden';
  $('sideAdd').title = sideTab === 'news' ? 'Add RSS feed' : 'Add bookmark or folder';
  $('side').scrollTop = 0;
  if (sideTab === 'closed') renderClosed();
  if (sideTab === 'top') renderTop();
  if (sideTab === 'news' && typeof openNews === 'function') openNews();
}
document.querySelectorAll('.side-tab').forEach((b) => b.addEventListener('click', () => { setSideTab(b.dataset.tab); store.set('sideTab', sideTab); }));
// Sekme çubuğunda ←/→ ile sekmeler arasında geçiş (erişilebilir sekme deseni).
$('sideTabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const keys = Object.keys(SIDE_PANES);
  const next = keys[(keys.indexOf(sideTab) + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length];
  e.preventDefault(); e.stopPropagation();
  setSideTab(next); store.set('sideTab', next);
  document.querySelector(`.side-tab[data-tab="${next}"]`).focus();
});

async function renderClosed() {
  const box = $('closedList');
  if (!isExt || !ext.sessions) { box.replaceChildren(emptyRow('This section only works inside the extension.')); return; }
  const list = await ext.sessions.getRecentlyClosed({ maxResults: 25 });
  if (!list.length) { box.replaceChildren(emptyRow('No recently closed tabs.')); return; }
  // "tabs" izni yoksa Chrome başlık ve adres vermez; kullanıcıya nasıl düzelteceğini söyle.
  const hasTabs = ext.permissions ? await ext.permissions.contains({ permissions: ['tabs'] }) : true;
  const hint = hasTabs ? null : el('div', { class: 'side-empty hint', text: 'Titles need the “tabs” permission: open chrome://extensions and press ↻ (reload) on this extension.' });
  const label = (t) => (t && (t.title || (t.url && hostOf(t.url)))) || 'Closed tab';
  const icon = (t) => (t && t.url ? favImg(t.url) : el('span', { class: 'fav', text: '🗋' }));
  box.replaceChildren(...[hint].filter(Boolean), ...list.map((s) => {
    const ms = s.lastModified > 1e12 ? s.lastModified : s.lastModified * 1000; // Firefox: milisaniye, Chrome: saniye
    const ago = s.lastModified ? fmtTime.format(new Date(ms)) : '';
    let btn;
    if (s.tab) {
      btn = el('button', { class: 'side-item', title: [s.tab.title, s.tab.url].filter(Boolean).join('\n') || 'Restore tab' },
        icon(s.tab), el('span', { class: 'name', text: label(s.tab) }), el('small', { text: ago }));
    } else if (s.window) {
      const tabs = s.window.tabs || [];
      const n = tabs.length;
      // Satırda ilk sekmenin adı, sağda sekme sayısı; tüm sekmeler fareyle üzerine gelince görünür.
      btn = el('button', { class: 'side-item', title: 'Restore window:\n' + tabs.map(label).join('\n') },
        el('span', { class: 'fav', text: '🗗' }), el('span', { class: 'name', text: label(tabs[0]) }),
        el('small', { text: `${n} ${n === 1 ? 'tab' : 'tabs'} · ${ago}` }));
    } else return null;
    const id = (s.tab || s.window).sessionId;
    btn.addEventListener('click', () => ext.sessions.restore(id));
    return btn;
  }).filter(Boolean));
}

async function renderTop() {
  const box = $('topList');
  if (!isExt || !ext.topSites) { box.replaceChildren(emptyRow('This section only works inside the extension.')); return; }
  const sites = (await ext.topSites.get()).slice(0, 20);
  if (!sites.length) { box.replaceChildren(emptyRow('Not enough browsing history yet.')); return; }
  box.replaceChildren(...sites.map((s) => el('a', { class: 'side-item', href: s.url, title: s.url },
    favImg(s.url), el('span', { class: 'name', text: s.title || hostOf(s.url) }))));
}
if (isExt && ext.sessions && ext.sessions.onChanged) ext.sessions.onChanged.addListener(() => { if (sideTab === 'closed') renderClosed(); });

/* =========================================================
   Arka plan: kendi fotoğrafların/videoların ya da kapalı.
   Kendi fotoğrafların IndexedDB'de tutulur (ext.storage büyük dosyalar için uygun değil).
   ========================================================= */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('yeni-sekme', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('wallpapers', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function wpTx(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('wallpapers', mode);
    const req = fn(tx.objectStore('wallpapers'));
    tx.oncomplete = () => res(req.result);
    tx.onerror = () => rej(tx.error);
  });
}
const wpAll = () => wpTx('readonly', (st) => st.getAll());
// Kayıt: { blob, kind: 'image' | 'video', poster? (video için küçük resim), added }. Eski kayıtlarda kind yok → resim.
const wpAdd = (rec) => wpTx('readwrite', (st) => st.add({ ...rec, added: Date.now() }));
const wpDel = (id) => wpTx('readwrite', (st) => st.delete(id));

// Büyük fotoğrafları en fazla 2560 piksele küçültüp JPEG olarak sakla: hem yer kaplamaz hem hızlı açılır.
async function prepImage(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
}

// Canlı duvar kâğıdı (video) için bir kare yakala: galeride küçük resim ve "hareketi azalt" açıkken sabit arka plan olarak kullanılır.
function videoPoster(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = url;
    const done = (res) => { URL.revokeObjectURL(url); resolve(res); };
    v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); }, { once: true });
    v.addEventListener('seeked', () => {
      const w = Math.min(1280, v.videoWidth || 1280), h = Math.round(w * (v.videoHeight || 720) / (v.videoWidth || 1280));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      c.toBlob((b) => done(b), 'image/jpeg', 0.85);
    }, { once: true });
    v.addEventListener('error', () => done(null), { once: true });
  });
}
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let shownBlobUrl = null; // ekrandaki kendi fotoğrafın geçici adresi; yenisi görünene kadar silinmez
function releaseShown(next = null) {
  if (shownBlobUrl && shownBlobUrl !== next) URL.revokeObjectURL(shownBlobUrl);
  shownBlobUrl = next && next.startsWith('blob:') ? next : null;
}
// Her loadPhoto çağrısı bir sıra numarası alır; geç biten eski bir yükleme (örn. büyük bir video) yenisinin üzerine yazmasın.
let bgGen = 0;
function showBg(url, gen) {
  const pre = new Image();
  pre.onload = () => { // önce yükle, sonra göster: yarım yüklenmiş fotoğraf görünmesin
    if (gen !== bgGen) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
    removeVideo();
    $('bg').style.backgroundImage = `url("${url}")`;
    releaseShown(url);
    document.body.classList.add('has-photo');
  };
  pre.src = url;
}
// Video arka plan: sessiz, döngüde; oynamaya hazır olunca gösterilir. Sekme görünmezken duraklar (işlemciyi yormasın).
function showVideo(url, gen) {
  const v = document.createElement('video');
  Object.assign(v, { muted: true, loop: true, autoplay: true, playsInline: true, src: url });
  v.className = 'bg-video';
  v.setAttribute('aria-hidden', 'true');
  v.addEventListener('canplay', () => {
    if (gen !== bgGen) { URL.revokeObjectURL(url); return; }
    const old = $('bg').querySelector('video');
    if (old && old !== v) old.remove();
    $('bg').style.backgroundImage = '';
    releaseShown(url);
    document.body.classList.add('has-photo');
    if (!document.hidden) v.play().catch(() => {});
  }, { once: true });
  v.addEventListener('error', () => { if (gen === bgGen) v.remove(); }, { once: true });
  $('bg').append(v);
}
function removeVideo() { const v = $('bg').querySelector('video'); if (v) { v.pause(); v.remove(); } }
document.addEventListener('visibilitychange', () => {
  const v = $('bg').querySelector('video');
  if (!v) return;
  if (document.hidden) v.pause(); else v.play().catch(() => {});
});
function hideBg() {
  document.body.classList.remove('has-photo');
  $('bg').style.backgroundImage = '';
  removeVideo();
  releaseShown();
}

async function getBgMode() {
  // 3.0'da Bing günün fotoğrafı kaldırıldı: yalnızca kendi duvar kâğıtları ya da düz arka plan.
  return (await store.get('bgMode', null)) === 'own' ? 'own' : 'off';
}

async function loadPhoto() {
  const gen = ++bgGen;
  const mode = await getBgMode();
  if (gen !== bgGen) return;
  const credit = $('credit');
  const btn = el('button', { text: '🖼 Background' });
  btn.addEventListener('click', toggleBgPanel);

  if (mode === 'off') { hideBg(); credit.replaceChildren(btn); return; }

  if (mode === 'own') {
    const list = await wpAll().catch(() => []);
    const pin = await store.get('bgPick', null);
    if (gen !== bgGen) return;
    if (!list.length) { hideBg(); credit.replaceChildren(el('span', { text: 'No wallpapers added yet.' }), btn); return; }
    let pick = list.find((w) => w.id === pin);
    if (!pick) { // sabit seçim yoksa her yeni sekmede farklı bir fotoğraf (bir öncekinin aynısı gelmez)
      const last = await store.get('bgLast', null);
      const pool = list.length > 1 ? list.filter((w) => w.id !== last) : list;
      pick = pool[Math.floor(Math.random() * pool.length)];
      store.set('bgLast', pick.id);
    }
    if (pick.kind === 'video' && !reduceMotion.matches) showVideo(URL.createObjectURL(pick.blob), gen);
    else if (pick.kind === 'video') { if (pick.poster) showBg(URL.createObjectURL(pick.poster), gen); } // hareketi azalt: sabit kare
    else showBg(URL.createObjectURL(pick.blob), gen);
    credit.replaceChildren(btn);
    return;
  }

  hideBg(); credit.replaceChildren(btn); // beklenmeyen kip: düz arka plan
}

/* ---- Arka plan ayar paneli ---- */
let thumbUrls = [];
async function renderBgPanel() {
  const mode = await getBgMode();
  document.querySelectorAll('#bgPanel .seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('ownBox').hidden = mode !== 'own';
  if (mode !== 'own') return;

  thumbUrls.forEach((u) => URL.revokeObjectURL(u)); thumbUrls = [];
  const [list, pin] = await Promise.all([wpAll().catch(() => []), store.get('bgPick', null)]);
  const validPin = list.some((w) => w.id === pin) ? pin : null;
  $('wpGrid').replaceChildren(...list.map((w) => {
    const isVideo = w.kind === 'video';
    const thumb = isVideo ? w.poster : w.blob; // video için yakalanan kare
    const u = thumb ? URL.createObjectURL(thumb) : ''; if (u) thumbUrls.push(u);
    const del = el('span', { class: 'wp-del', role: 'button', title: 'Delete', 'aria-label': 'Delete', text: '✕' });
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await wpDel(w.id);
      if (validPin === w.id) await store.set('bgPick', null);
      renderBgPanel(); loadPhoto();
    });
    const tile = el('button', { class: 'wp' + (validPin === w.id ? ' active' : '') + (isVideo ? ' is-video' : ''), title: (validPin === w.id ? 'Pinned — click again to unpin' : 'Pin this wallpaper') + (isVideo ? ' (live)' : '') },
      u ? el('img', { src: u, alt: '' }) : null, isVideo ? el('span', { class: 'wp-badge', text: '▶ Live' }) : null, del);
    tile.addEventListener('click', async () => {
      await store.set('bgPick', validPin === w.id ? null : w.id); // aynı fotoğrafa tekrar tıklamak sabitlemeyi kaldırır
      renderBgPanel(); loadPhoto();
    });
    return tile;
  }));
  $('wpState').textContent = !list.length ? 'Add photos or videos (MP4/WebM), or drag and drop them onto the page.'
    : validPin ? 'The selected wallpaper is pinned. Click it again to rotate on every new tab.'
    : `${list.length} ${list.length === 1 ? 'wallpaper' : 'wallpapers'} · changes on every new tab. Click one to pin it.`;
}
function toggleBgPanel() {
  const p = $('bgPanel'); p.hidden = !p.hidden;
  if (!p.hidden) renderBgPanel();
}
$('bgClose').addEventListener('click', () => { $('bgPanel').hidden = true; });
document.querySelectorAll('#bgPanel .seg button').forEach((b) => b.addEventListener('click', async () => {
  await store.set('bgMode', b.dataset.mode);
  renderBgPanel(); loadPhoto();
}));

const MAX_VIDEO_MB = 200;
async function addWallpapers(files) {
  const all = [...files].filter((f) => /^(image|video)\//.test(f.type));
  if (!all.length) return;
  $('bgPanel').hidden = false;
  $('wpState').textContent = 'Adding…';
  const skipped = [];
  let lastId = null;
  for (const f of all) {
    try {
      if (f.type.startsWith('video/')) {
        // Video yeniden kodlanmaz, olduğu gibi saklanır; tarayıcının oynatamadığı biçimler (örn. bazı MKV/HEVC) eklenmez.
        if (f.size > MAX_VIDEO_MB * 1048576) { skipped.push(`${f.name} (over ${MAX_VIDEO_MB} MB)`); continue; }
        if (!document.createElement('video').canPlayType(f.type)) { skipped.push(`${f.name} (format not supported)`); continue; }
        const poster = await videoPoster(f);
        if (!poster) { skipped.push(`${f.name} (could not be decoded)`); continue; }
        lastId = await wpAdd({ blob: f, kind: 'video', poster });
      } else {
        lastId = await wpAdd({ blob: await prepImage(f), kind: 'image' });
      }
    } catch (e) { console.warn('[new-tab] could not add wallpaper', f.name, e); skipped.push(f.name); }
  }
  // Tek dosya eklendiyse hemen onu göster (sabitle); birden fazlaysa sırayla değişsin.
  if (all.length === 1 && lastId != null) await store.set('bgPick', lastId);
  await store.set('bgMode', 'own');
  await renderBgPanel(); loadPhoto();
  if (skipped.length) $('wpState').textContent = 'Not added: ' + skipped.join(', ');
}
$('wpFile').addEventListener('change', (e) => { addWallpapers(e.target.files); e.target.value = ''; });

// Sayfaya fotoğraf sürükleyip bırakınca doğrudan duvar kâğıdı olarak eklenir.
document.addEventListener('dragover', (e) => {
  if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) { e.preventDefault(); document.body.classList.add('dropping'); }
});
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
document.addEventListener('drop', (e) => {
  document.body.classList.remove('dropping');
  if (!e.dataTransfer.files.length) return;
  e.preventDefault();
  addWallpapers(e.dataTransfer.files);
});

/* =========================================================
   Başlatma
   ========================================================= */
(async function initWidgets() {
  loadPhoto();
  let tab;
  [focus, todos, tab] = await Promise.all([syncStore.get('focus', null), syncStore.get('todos', []), store.get('sideTab', 'bm')]);
  $('note').value = await store.get('note', '');
  renderFocus();
  renderTodos();
  setSideTab(tab);

  // Başka bir sekmede ya da cihazda değişirse güncelle.
  if (isExt) {
    ext.storage.onChanged.addListener((ch, area) => {
      if (area === 'sync' && ch.todos) { todos = ch.todos.newValue || []; renderTodos(); }
      if (area === 'sync' && ch.focus) { focus = ch.focus.newValue || null; renderFocus(); }
    });
  }
})();
