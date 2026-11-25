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
const fmtTime = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

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
  $('quote').title = (remote ? (quoteOffset % list.length === 0 ? t('quote.otd') + ' · ' : '') + quoteSrc.name : t('quote.offline')) + t('quote.more');
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
  if (!todos.length) { ul.replaceChildren(el('li', { class: 'empty', text: t('todo.empty') })); }
  else {
    ul.replaceChildren(...todos.map((td) => {
      const cb = el('input', { type: 'checkbox', 'aria-label': t('common.done') });
      cb.checked = td.done;
      cb.addEventListener('change', () => { td.done = cb.checked; saveTodos(); });
      const del = el('button', { title: t('common.delete'), 'aria-label': t('common.delete'), text: '✕' });
      del.addEventListener('click', () => { todos = todos.filter((x) => x !== td); saveTodos(); });
      return el('li', { class: td.done ? 'done' : null }, cb, el('span', { text: td.text }), del);
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
  $('noteState').textContent = t('notes.typing');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(async () => {
    await store.set('note', $('note').value);
    $('noteState').textContent = t('notes.saved', { time: fmtTime.format(new Date()) });
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
  $('sideAdd').title = sideTab === 'news' ? t('news.addFeed') : t('side.add');
  $('side').scrollTop = 0;
  if (sideTab === 'closed') { renderClosed(); renderSessions(); }
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
  if (!isExt || !ext.sessions) { box.replaceChildren(emptyRow(t('side.extOnly'))); return; }
  const list = await ext.sessions.getRecentlyClosed({ maxResults: 25 });
  if (!list.length) { box.replaceChildren(emptyRow(t('closed.none'))); return; }
  // "tabs" izni yoksa Chrome başlık ve adres vermez; kullanıcıya nasıl düzelteceğini söyle.
  const hasTabs = ext.permissions ? await ext.permissions.contains({ permissions: ['tabs'] }) : true;
  const hint = hasTabs ? null : el('div', { class: 'side-empty hint', text: t('closed.tabsPerm') });
  const label = (x) => (x && (x.title || (x.url && hostOf(x.url)))) || t('closed.tab');
  const icon = (x) => (x && x.url ? favImg(x.url) : el('span', { class: 'fav', text: '🗋' }));
  box.replaceChildren(...[hint].filter(Boolean), ...list.map((s) => {
    const ms = s.lastModified > 1e12 ? s.lastModified : s.lastModified * 1000; // Firefox: milisaniye, Chrome: saniye
    const ago = s.lastModified ? fmtTime.format(new Date(ms)) : '';
    let btn;
    if (s.tab) {
      btn = el('button', { class: 'side-item', title: [s.tab.title, s.tab.url].filter(Boolean).join('\n') || t('closed.restoreTab') },
        icon(s.tab), el('span', { class: 'name', text: label(s.tab) }), el('small', { text: ago }));
    } else if (s.window) {
      const tabs = s.window.tabs || [];
      const n = tabs.length;
      // Satırda ilk sekmenin adı, sağda sekme sayısı; tüm sekmeler fareyle üzerine gelince görünür.
      btn = el('button', { class: 'side-item', title: t('closed.restoreWindow') + '\n' + tabs.map(label).join('\n') },
        el('span', { class: 'fav', text: '🗗' }), el('span', { class: 'name', text: label(tabs[0]) }),
        el('small', { text: `${tn('closed.tabs', n)} · ${ago}` }));
    } else return null;
    const id = (s.tab || s.window).sessionId;
    btn.addEventListener('click', () => ext.sessions.restore(id));
    return btn;
  }).filter(Boolean));
}

async function renderTop() {
  const box = $('topList');
  if (!isExt || !ext.topSites) { box.replaceChildren(emptyRow(t('side.extOnly'))); return; }
  const sites = (await ext.topSites.get()).slice(0, 20);
  if (!sites.length) { box.replaceChildren(emptyRow(t('top.none'))); return; }
  box.replaceChildren(...sites.map((s) => el('a', { class: 'side-item', href: s.url, title: s.url },
    favImg(s.url), el('span', { class: 'name', text: s.title || hostOf(s.url) }))));
}
if (isExt && ext.sessions && ext.sessions.onChanged) ext.sessions.onChanged.addListener(() => { if (sideTab === 'closed') renderClosed(); });

/* ---- Kayıtlı oturumlar: "Kotilo sessions" yer imi klasörü, her oturum bir alt klasör ---- */
const SESS_FOLDER = 'Kotilo sessions';
const httpOnly = (u) => /^https?:\/\//i.test(u || '');
const sessSupported = isExt && !!ext.bookmarks;
async function sessOtherRoot() {
  const roots = ((await ext.bookmarks.getTree())[0] || {}).children || [];
  const others = roots.filter((r) => r.folderType === 'other');
  return others.find((r) => r.syncing !== false) || others[0]
    || roots.find((r) => r.id === '2' || r.id === 'unfiled_____') || null;
}
async function sessFolder(create) {
  const root = await sessOtherRoot();
  if (!root) return null;
  const found = (root.children || []).find((c) => !c.url && c.title === SESS_FOLDER);
  if (found) return found;
  return create ? ext.bookmarks.create({ parentId: root.id, title: SESS_FOLDER }) : null;
}
async function renderSessions() {
  const sec = $('sessSec');
  sec.hidden = !sessSupported;
  if (!sessSupported) return;
  const box = $('sessList');
  let kids = [];
  try {
    const f = await sessFolder(false);
    if (f) kids = (f.children || []).filter((c) => !c.url);
  } catch { /* okunamazsa boş liste */ }
  kids.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
  if (!kids.length) { box.replaceChildren(emptyRow(t('sess.empty'))); return; }
  const restore = (urls) => { if (urls.length) Promise.resolve(ext.windows.create({ url: urls })).catch((e) => console.warn('[new-tab] restore session', e)); };
  box.replaceChildren(...kids.slice(0, 10).map((k) => {
    const urls = (k.children || []).map((c) => c.url).filter(httpOnly);
    const main = el('button', { class: 'side-item', title: t('sess.restore') },
      el('span', { class: 'fav', text: '🗗' }), el('span', { class: 'name', text: k.title }),
      el('small', { text: tn('closed.tabs', urls.length) }));
    main.addEventListener('click', () => restore(urls));
    const ren = el('button', { class: 'sess-act', title: t('sess.rename'), 'aria-label': t('sess.rename'), text: '✎' });
    ren.addEventListener('click', async () => {
      const v = await openDialog({ title: t('sess.rename'), fields: [{ key: 'title', label: t('dlg.name'), value: k.title, placeholder: t('sess.namePh') }] });
      if (!v || !v.title || v.title === k.title) return;
      try { await ext.bookmarks.update(k.id, { title: v.title }); } catch { /* silinmiş olabilir */ }
      renderSessions();
    });
    const del = el('button', { class: 'sess-act sess-del',title: t('sess.delete'), 'aria-label': t('sess.delete'), text: '✕' });
    del.addEventListener('click', async () => {
      const ok = await openDialog({ title: t('sess.delete'), message: t('sess.deleteMsg', { name: k.title }), okText: t('sess.delete'), danger: true });
      if (!ok) return;
      try { await ext.bookmarks.removeTree(k.id); } catch { /* zaten silinmiş */ }
      renderSessions();
    });
    return el('div', { class: 'sess-row' }, main, ren, del);
  }));
}
async function saveSession() {
  const msg = $('sessMsg'), btn = $('sessSave');
  if (btn.disabled) return; // çift tıklama iki "Kotilo sessions" klasörü oluşturmasın
  btn.disabled = true;
  msg.textContent = '';
  try {
    const tabs = (await ext.tabs.query({ currentWindow: true })).filter((x) => httpOnly(x.url));
    if (!tabs.length) { msg.textContent = t('sess.noTabs'); return; }
    // Ad sorulur; tarih hazır gelir, Enter ile olduğu gibi kaydedilir. İptal kaydı durdurur.
    const stamp = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const v = await openDialog({ title: t('sess.save'), message: tn('closed.tabs', tabs.length),
      fields: [{ key: 'title', label: t('dlg.name'), value: stamp, placeholder: t('sess.namePh') }] });
    if (!v) return;
    const title = v.title || stamp;
    const parent = await sessFolder(true);
    const dir = await ext.bookmarks.create({ parentId: parent.id, title });
    for (const x of tabs) await ext.bookmarks.create({ parentId: dir.id, title: x.title || x.url, url: x.url });
    msg.textContent = t('sess.saved', { n: tn('closed.tabs', tabs.length) });
  } catch { msg.textContent = t('sess.fail'); }
  finally { btn.disabled = false; renderSessions(); } // erken return'lerde de düğme açılsın
}
if (sessSupported) {
  $('sessSave').addEventListener('click', saveSession);
  let sessTimer;
  const sessRefresh = () => { clearTimeout(sessTimer); sessTimer = setTimeout(() => { if (sideTab === 'closed') renderSessions(); }, 250); };
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onImportEnded']) {
    ext.bookmarks[ev] && ext.bookmarks[ev].addListener(sessRefresh);
  }
}

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
  pre.onerror = () => { if (gen === bgGen) hideBg(); }; // bozuk adres: düz arka plan
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
  // 3.0'da Bing günün fotoğrafı kaldırıldı; 3.2'de Wikimedia Commons günün resmi ('potd') geldi. Ayar yoksa düz arka plan.
  const m = await store.get('bgMode', null);
  return m === 'potd' || m === 'own' ? m : 'off';
}

/* ---- Günün resmi (Wikimedia Commons) ---- */
const POTD_API = 'https://api.wikimedia.org/feed/v1/wikipedia/en/featured/';
// Saf işlevler (test edilebilsin diye DOM'a dokunmaz). entry: API yanıtındaki .image nesnesi ya da null.
function potdOk(img) {
  if (!img || !img.image || !img.image.source) return false;
  const w = img.image.width, h = img.image.height;
  const src = String(img.image.source).split('?')[0];
  if (!/\.jpe?g$/i.test(src)) return false;
  if (!w || !h || w < 1920) return false;
  const r = w / h;
  return r >= 1.3 && r <= 2.4;
}
// entries: en yeniden eskiye .image nesneleri (boş olabilir). Uygun olan ilki; yoksa resmi olan ilk gün.
function pickPotd(entries) {
  return entries.find(potdOk) || entries.find((e) => e && e.image && e.image.source) || null;
}
function potdThumbUrl(src, width) {
  const m = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/((?:[0-9a-f]\/[0-9a-f]{2})\/([^/]+))$/.exec(String(src).split('?')[0]);
  if (!m) return null;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${width}px-${m[2]}`;
}
function potdRecord(img, day) {
  const s = (v, n) => { v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return n && v.length > n ? v.slice(0, n - 1) + '…' : v; };
  const https = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '');
  const w = img.image.width;
  const src = String(img.image.source).split('?')[0];
  if (!/\.(jpe?g|png)$/i.test(src)) return null; // SVG/TIFF/GIF/video: küçük resim adresi farklı ya da arka plana uygun değil
  const url = (w >= 1920 ? potdThumbUrl(src, 1920) : null)
    || (src.startsWith('https://upload.wikimedia.org/') ? src : null);
  if (!url) return null;
  return {
    day, url,
    title: s((img.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '), 120),
    artist: s(img.artist && img.artist.text, 80),
    license: s(img.license && img.license.type, 40),
    licenseUrl: https(img.license && img.license.url),
    page: https(img.file_page),
    desc: s(img.description && img.description.text, 120),
  };
}
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function fetchPotd() {
  const entries = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 864e5);
    const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    try {
      const r = await fetch(POTD_API + path);
      if (!r.ok) { entries.push(null); continue; }
      const j = await r.json();
      entries.push(j && j.image ? j.image : null);
    } catch { entries.push(null); }
    if (potdOk(entries[entries.length - 1])) break;
  }
  const pick = pickPotd(entries);
  return pick ? potdRecord(pick, localDay()) : null;
}
async function getPotd() {
  const cached = await store.get('potd', null);
  if (cached && cached.day === localDay() && cached.url) return cached;
  // Servis yanıt vermediyse bir saat yeniden denenmez (her yeni sekme 7 istek atmasın).
  const failedAt = await store.get('potdFail', 0);
  if (Date.now() - failedAt > 36e5) {
    const fresh = await fetchPotd();
    if (fresh) { store.set('potd', fresh); return fresh; }
    store.set('potdFail', Date.now());
  }
  return cached && cached.url ? cached : null;
}
function potdCredit(p) {
  const text = p.title || p.desc;
  const head = p.page && text ? el('a', { href: p.page, target: '_blank', rel: 'noopener noreferrer', text }) : (text ? el('span', { text }) : null);
  const rest = [p.artist, p.license].filter(Boolean).join(' · ');
  const parts = [head, rest ? el('span', { text: rest }) : null].filter(Boolean);
  if (!parts.length) return null;
  const box = el('span', { class: 'potd-credit' });
  parts.forEach((x, i) => { if (i) box.append(' · '); box.append(x); });
  return box;
}

async function loadPhoto() {
  const gen = ++bgGen;
  const mode = await getBgMode();
  if (gen !== bgGen) return;
  const credit = $('credit');
  const btn = el('button', { text: t('bg.btn') });
  btn.addEventListener('click', toggleBgPanel);

  if (mode === 'off') { hideBg(); credit.replaceChildren(btn); return; }

  if (mode === 'potd') {
    const p = await getPotd().catch(() => null);
    if (gen !== bgGen) return;
    if (!p) { hideBg(); credit.replaceChildren(btn); return; }
    showBg(p.url, gen);
    credit.replaceChildren(...[potdCredit(p), btn].filter(Boolean));
    return;
  }

  if (mode === 'own') {
    const list = await wpAll().catch(() => []);
    const pin = await store.get('bgPick', null);
    if (gen !== bgGen) return;
    if (!list.length) { hideBg(); credit.replaceChildren(el('span', { text: t('bg.none') }), btn); return; }
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
  $('potdNote').hidden = mode !== 'potd';
  if (mode !== 'own') return;

  thumbUrls.forEach((u) => URL.revokeObjectURL(u)); thumbUrls = [];
  const [list, pin] = await Promise.all([wpAll().catch(() => []), store.get('bgPick', null)]);
  const validPin = list.some((w) => w.id === pin) ? pin : null;
  $('wpGrid').replaceChildren(...list.map((w) => {
    const isVideo = w.kind === 'video';
    const thumb = isVideo ? w.poster : w.blob; // video için yakalanan kare
    const u = thumb ? URL.createObjectURL(thumb) : ''; if (u) thumbUrls.push(u);
    const del = el('span', { class: 'wp-del', role: 'button', title: t('common.delete'), 'aria-label': t('common.delete'), text: '✕' });
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await wpDel(w.id);
      if (validPin === w.id) await store.set('bgPick', null);
      renderBgPanel(); loadPhoto();
    });
    const tile = el('button', { class: 'wp' + (validPin === w.id ? ' active' : '') + (isVideo ? ' is-video' : ''), title: (validPin === w.id ? t('bg.pinned') : t('bg.pin')) + (isVideo ? t('bg.live') : '') },
      u ? el('img', { src: u, alt: '' }) : null, isVideo ? el('span', { class: 'wp-badge', text: t('bg.badge') }) : null, del);
    tile.addEventListener('click', async () => {
      await store.set('bgPick', validPin === w.id ? null : w.id); // aynı fotoğrafa tekrar tıklamak sabitlemeyi kaldırır
      renderBgPanel(); loadPhoto();
    });
    return tile;
  }));
  $('wpState').textContent = !list.length ? t('bg.help')
    : validPin ? t('bg.pinnedState')
    : tn('bg.count', list.length);
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
  $('wpState').textContent = t('bg.adding');
  const skipped = [];
  let lastId = null;
  for (const f of all) {
    try {
      if (f.type.startsWith('video/')) {
        // Video yeniden kodlanmaz, olduğu gibi saklanır; tarayıcının oynatamadığı biçimler (örn. bazı MKV/HEVC) eklenmez.
        if (f.size > MAX_VIDEO_MB * 1048576) { skipped.push(t('bg.tooBig', { name: f.name, mb: MAX_VIDEO_MB })); continue; }
        if (!document.createElement('video').canPlayType(f.type)) { skipped.push(t('bg.badFormat', { name: f.name })); continue; }
        const poster = await videoPoster(f);
        if (!poster) { skipped.push(t('bg.badDecode', { name: f.name })); continue; }
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
  if (skipped.length) $('wpState').textContent = t('bg.notAdded', { list: skipped.join(', ') });
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
      // Yeni kurulumda arka plan kipi (background.js) ilk sekme çizildikten sonra yazılabilir: gelince resmi göster.
      if (area === 'local' && ch.bgMode) { loadPhoto(); renderBgPanel(); }
    });
  }
})();
