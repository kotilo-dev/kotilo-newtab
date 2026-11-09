'use strict';
/* Kenar çubuğundaki "News" sekmesi: birden fazla RSS/Atom kaynağı, kaynak filtresi.
   - Kaynak listesi Chrome/Firefox hesabıyla senkronlanır (syncStore → "feeds"); haberler yerel önbellekte (store → "feedCache", 15 dk).
   - Dış siteden veri okumak için o sitenin izni gerekir. Bütün sitelere baştan izin istemek yerine yalnızca eklenen
     kaynağın sitesine izin istenir (manifest: optional_host_permissions). İzin yoksa kaynakta "Allow access" düğmesi çıkar.
   - Akıştan gelen hiçbir metin HTML olarak sayfaya konmaz; her şey textContent ile yazılır, bağlantılar yalnızca http(s) olabilir.
   newtab.js, widgets.js ve manage.js'ten sonra yüklenir ($, el, ext, store, syncStore, openDialog, normalizeUrl, favImg, hostOf). */

const DEFAULT_FEEDS = []; // varsayılan kaynak yok; kullanıcı kendi akışlarını ekler
const FEED_TTL_MIN = 15;
const MAX_ITEMS_PER_FEED = 50;
let feeds = null;          // [{url, title}]
let feedCache = {};        // url → {at, title, items:[...], error}
let newsFilter = 'all';    // 'all' ya da kaynak url'si
let newsLoading = false;

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
function timeAgo(t) {
  const s = (t - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(Math.round(s), 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
const originPattern = (url) => { const u = new URL(url); return `${u.protocol}//${u.host}/*`; };
const safeHttp = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

/* ---------------------------------------------------------
   İzinler
   --------------------------------------------------------- */
async function hasAccess(url) {
  if (!isExt || !ext.permissions) return true; // önizleme
  try { return await ext.permissions.contains({ origins: [originPattern(url)] }); } catch { return false; }
}
// Kullanıcı tıklamasının içinde çağrılmalı (tarayıcı izin penceresini ancak öyle açar).
async function requestAccess(url) {
  if (!isExt || !ext.permissions) return true;
  try { return await ext.permissions.request({ origins: [originPattern(url)] }); } catch (e) { console.warn('[new-tab] permission', e); return false; }
}

/* ---------------------------------------------------------
   Akış okuma
   --------------------------------------------------------- */
// Karakter kodlaması: önce HTTP başlığı, sonra XML bildirimi (encoding="windows-1254" gibi), yoksa UTF-8.
async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-cache', credentials: 'omit' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  let enc = ((r.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || [])[1];
  if (!enc) {
    const head = new TextDecoder('latin1').decode(buf.slice(0, 300));
    enc = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1];
  }
  let text;
  try { text = new TextDecoder(enc || 'utf-8').decode(buf); } catch { text = new TextDecoder('utf-8').decode(buf); }
  return { text, type: r.headers.get('content-type') || '' };
}

const first = (node, names) => { for (const n of names) { const x = node.getElementsByTagName(n)[0]; if (x) return x; } return null; };
const txt = (node, names) => { const x = first(node, names); return x ? x.textContent.trim() : ''; };
function plain(html) { // HTML'i düz metne çevirir (çalıştırmadan)
  if (!html) return '';
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
}
function itemImage(it) {
  for (const m of it.getElementsByTagName('media:content')) {
    if ((m.getAttribute('medium') === 'image' || /^image\//.test(m.getAttribute('type') || '')) && m.getAttribute('url')) return m.getAttribute('url');
  }
  const th = first(it, ['media:thumbnail']); if (th && th.getAttribute('url')) return th.getAttribute('url');
  for (const e of it.getElementsByTagName('enclosure')) if (/^image\//.test(e.getAttribute('type') || '')) return e.getAttribute('url');
  const html = txt(it, ['content:encoded', 'description', 'content', 'summary']);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// Akışı ayrıştırır: { title, items } ya da sayfa bir akış değilse { discovered: [url, ...] }.
function parseFeed(text, baseUrl) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const root = xml.documentElement;
  if (!xml.getElementsByTagName('parsererror').length && /^(rss|feed|rdf:RDF)$/i.test(root.nodeName)) {
    const isAtom = /^feed$/i.test(root.nodeName);
    const nodes = [...xml.getElementsByTagName(isAtom ? 'entry' : 'item')].slice(0, MAX_ITEMS_PER_FEED);
    const chan = isAtom ? root : (root.getElementsByTagName('channel')[0] || root);
    const items = nodes.map((it) => {
      let link = '';
      if (isAtom) {
        const links = [...it.getElementsByTagName('link')];
        const l = links.find((x) => (x.getAttribute('rel') || 'alternate') === 'alternate') || links[0];
        link = l ? l.getAttribute('href') : '';
      } else link = txt(it, ['link']) || txt(it, ['guid']);
      try { link = new URL(link, baseUrl).href; } catch { link = ''; }
      const dateStr = txt(it, ['pubDate', 'dc:date', 'published', 'updated']);
      const cat = isAtom ? ((it.getElementsByTagName('category')[0] || { getAttribute: () => '' }).getAttribute('term') || '') : txt(it, ['category']);
      let img = itemImage(it);
      if (img) { try { img = safeHttp(new URL(img, baseUrl).href); } catch { img = null; } }
      return {
        title: plain(txt(it, ['title'])) || '(untitled)',
        link: safeHttp(link),
        date: Date.parse(dateStr) || 0,
        cat: plain(cat).slice(0, 40),
        img,
        desc: plain(txt(it, ['description', 'summary', 'content'])).slice(0, 300),
      };
    }).filter((x) => x.link);
    return { title: plain(txt(chan, ['title'])) || hostOf(baseUrl), items };
  }
  // Akış değil: HTML sayfada <link rel="alternate" type="application/rss+xml"> ara.
  const html = new DOMParser().parseFromString(text, 'text/html');
  const found = [...html.querySelectorAll('link[rel~="alternate"][href]')]
    .filter((l) => /rss|atom|xml/i.test(l.getAttribute('type') || ''))
    .map((l) => { try { return new URL(l.getAttribute('href'), baseUrl).href; } catch { return null; } })
    .filter(Boolean);
  return { discovered: [...new Set(found)] };
}

async function loadFeed(f, force) {
  const c = feedCache[f.url];
  if (!force && c && !c.error && Date.now() - c.at < FEED_TTL_MIN * 60e3) return;
  if (!(await hasAccess(f.url))) { feedCache[f.url] = { ...(c || {}), at: Date.now(), error: 'permission' }; return; }
  try {
    const { text } = await fetchText(f.url);
    const res = parseFeed(text, f.url);
    if (!res.items) throw new Error('Not an RSS/Atom feed');
    feedCache[f.url] = { at: Date.now(), title: res.title, items: res.items };
  } catch (e) {
    console.warn('[new-tab] feed', f.url, e);
    feedCache[f.url] = { ...(c || {}), at: Date.now(), error: String(e.message || e) };
  }
}

async function refreshNews(force = false) {
  if (newsLoading) return;
  newsLoading = true;
  $('newsState').textContent = 'Loading…';
  await Promise.all(feeds.map((f) => loadFeed(f, force)));
  store.set('feedCache', feedCache);
  newsLoading = false;
  renderNews();
}

/* ---------------------------------------------------------
   Görünüm
   --------------------------------------------------------- */
const feedName = (f) => f.title || (feedCache[f.url] && feedCache[f.url].title) || hostOf(f.url);

function renderNews() {
  if (!feeds) return;
  if (newsFilter !== 'all' && !feeds.some((f) => f.url === newsFilter)) newsFilter = 'all';

  // Filtre çipleri: All + her kaynak (haber sayısıyla)
  const count = (f) => ((feedCache[f.url] && feedCache[f.url].items) || []).length;
  const chip = (key, label, n) => {
    const b = el('button', { class: 'news-chip' + (newsFilter === key ? ' active' : ''), 'aria-pressed': String(newsFilter === key) },
      label, el('small', { text: String(n) }));
    b.addEventListener('click', () => { newsFilter = key; store.set('newsFilter', key); renderNews(); });
    return b;
  };
  $('newsFilter').replaceChildren(...(feeds.length > 1 ? [chip('all', 'All', feeds.reduce((a, f) => a + count(f), 0))] : []),
    ...feeds.map((f) => chip(f.url, feedName(f), count(f))));
  $('newsFilter').hidden = !feeds.length;

  // Haberler: seçili kaynak(lar)dan, en yeni önce
  const list = [];
  for (const f of feeds) {
    if (newsFilter !== 'all' && f.url !== newsFilter) continue;
    for (const it of (feedCache[f.url] && feedCache[f.url].items) || []) list.push({ ...it, src: feedName(f) });
  }
  list.sort((a, b) => b.date - a.date);
  // Alt bilgide zaman başta: satır kesilse de görünsün.
  const rows = list.slice(0, 120).map((it) => {
    const a = el('a', { class: 'news-item', href: it.link, title: it.desc ? it.title + '\n\n' + it.desc : it.title },
      it.img ? el('img', { class: 'news-thumb', src: it.img, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' }) : null,
      el('span', { class: 'news-text' },
        el('span', { class: 'news-title', text: it.title }),
        el('span', { class: 'news-meta', text: [it.date ? timeAgo(it.date) : null, newsFilter === 'all' && feeds.length > 1 ? it.src : null, it.cat || null].filter(Boolean).join(' · ') })));
    const im = a.querySelector('img'); if (im) im.addEventListener('error', () => im.remove(), { once: true });
    return a;
  });

  // Hata ya da izin bekleyen kaynaklar listenin başında görünür
  const problems = feeds.filter((f) => feedCache[f.url] && feedCache[f.url].error && (newsFilter === 'all' || newsFilter === f.url)).map((f) => {
    const err = feedCache[f.url].error;
    if (err === 'permission') {
      const b = el('button', { class: 'btn btn-primary', text: `Allow access to ${hostOf(f.url)}` });
      b.addEventListener('click', async () => { if (await requestAccess(f.url)) { delete feedCache[f.url]; refreshNews(true); } });
      return el('div', { class: 'news-problem' }, el('span', { text: `${feedName(f)} needs permission to read its feed.` }), b);
    }
    return el('div', { class: 'news-problem' }, el('span', { text: `${feedName(f)}: could not load (${err}).` }));
  });

  if (!feeds.length) rows.push(el('div', { class: 'side-empty', text: 'No sources yet. Press ＋ to add an RSS feed or a website address.' }));
  else if (!rows.length && !problems.length) rows.push(el('div', { class: 'side-empty', text: newsLoading ? 'Loading…' : 'No news in this source.' }));
  $('newsList').replaceChildren(...problems, ...rows);

  const latest = Math.max(0, ...feeds.map((f) => (feedCache[f.url] && !feedCache[f.url].error && feedCache[f.url].at) || 0));
  $('newsState').textContent = newsLoading ? 'Loading…' : latest ? 'updated ' + timeAgo(latest) : '';
  if (!$('newsSources').hidden) renderSources();
}

// Kaynak yönetimi: ⚙ ile açılır; her kaynak için ad, adres, durum ve silme.
function renderSources() {
  const rows = feeds.map((f, i) => {
    const c = feedCache[f.url];
    const status = !c ? '' : c.error === 'permission' ? 'needs permission' : c.error ? 'error' : `${(c.items || []).length} items`;
    const del = el('button', { class: 'icon-btn', title: 'Remove source', 'aria-label': 'Remove ' + feedName(f), text: '✕' });
    del.addEventListener('click', async () => {
      const ok = await openDialog({ title: 'Remove source?', message: `“${feedName(f)}” will be removed from your news sources.`, okText: 'Remove', danger: true });
      if (!ok) return;
      feeds.splice(i, 1); delete feedCache[f.url];
      await syncStore.set('feeds', feeds); store.set('feedCache', feedCache);
      renderNews();
    });
    return el('div', { class: 'news-src' }, favImg(f.url),
      el('span', { class: 'news-src-text' }, el('span', { class: 'name', text: feedName(f) }), el('small', { text: hostOf(f.url) + (status ? ' · ' + status : '') })), del);
  });
  const add = el('button', { class: 'btn', text: '＋ Add source' });
  add.addEventListener('click', addFeed);
  $('newsSources').replaceChildren(...rows, add);
}
$('newsManage').addEventListener('click', () => {
  const box = $('newsSources'); box.hidden = !box.hidden;
  $('newsManage').setAttribute('aria-expanded', String(!box.hidden));
  if (!box.hidden) renderSources();
});
$('newsRefresh').addEventListener('click', () => refreshNews(true));

/* ---------------------------------------------------------
   Kaynak ekleme: akış adresi ya da site adresi (sayfadaki RSS bağlantısı aranır)
   --------------------------------------------------------- */
async function addFeed() {
  const v = await openDialog({ title: 'Add RSS feed', message: 'Paste a feed address (RSS/Atom) or a website address; the feed link on the page will be detected.',
    fields: [{ key: 'url', label: 'Feed or website URL', placeholder: 'https://…/rss.xml' }], okText: 'Add' });
  if (!v) return;
  let url = normalizeUrl(v.url);
  if (!url || !safeHttp(url)) return openDialog({ title: 'Invalid URL', message: 'Please enter a valid http(s) address.', okText: 'OK' });
  if (feeds.some((f) => f.url === url)) return openDialog({ title: 'Already added', message: 'This feed is already in your sources.', okText: 'OK' });

  // Pencere kapandıktan hemen sonra, tıklamanın etkisi sürerken izin iste. Reddedilirse kaynak yine eklenir ve "Allow access" düğmesi çıkar.
  const granted = (await hasAccess(url)) || (await requestAccess(url));
  let title = '';
  if (granted) {
    $('newsState').textContent = 'Checking…';
    try {
      const { text } = await fetchText(url);
      let res = parseFeed(text, url);
      if (!res.items && res.discovered && res.discovered.length) {
        url = res.discovered[0]; // sayfada bulunan ilk akış
        if (!(await hasAccess(url))) await requestAccess(url);
        res = parseFeed((await fetchText(url)).text, url);
      }
      if (!res.items) return openDialog({ title: 'No feed found', message: 'This address is not an RSS/Atom feed and the page does not link to one.', okText: 'OK' });
      title = res.title;
      feedCache[url] = { at: Date.now(), title: res.title, items: res.items };
    } catch (e) {
      return openDialog({ title: 'Could not load feed', message: String(e.message || e), okText: 'OK' });
    }
  }
  feeds.push({ url, title });
  await syncStore.set('feeds', feeds);
  store.set('feedCache', feedCache);
  newsFilter = url; store.set('newsFilter', url);
  renderNews();
}

/* ---------------------------------------------------------
   Başlatma: sekme ilk açıldığında yüklenir
   --------------------------------------------------------- */
async function ensureFeeds() {
  if (feeds) return;
  const saved = await syncStore.get('feeds', null);
  feeds = Array.isArray(saved) ? saved : DEFAULT_FEEDS.map((f) => ({ ...f })); // hiç kaydedilmemişse varsayılan kaynak
  [feedCache, newsFilter] = await Promise.all([store.get('feedCache', {}), store.get('newsFilter', 'all')]);
}
async function openNews() {
  await ensureFeeds();
  renderNews();
  refreshNews(false); // önbellek 15 dakikadan eskiyse yeniler
}
// Kaynak listesi başka bir cihazda değişirse güncelle; izin verilirse yeniden dene.
if (isExt) {
  ext.storage.onChanged.addListener((ch, area) => {
    if (area === 'sync' && ch.feeds && feeds) { feeds = ch.feeds.newValue || []; renderNews(); }
  });
  if (ext.permissions && ext.permissions.onAdded) ext.permissions.onAdded.addListener(() => { if (feeds && sideTab === 'news') refreshNews(true); });
}
// Sayfa News sekmesi seçili olarak açıldıysa (setSideTab bu dosyadan önce çalıştı) şimdi yükle.
if (typeof sideTab !== 'undefined' && sideTab === 'news') openNews();
