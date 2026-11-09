'use strict';
/* Piyasalar kartı (3.0).
   - FX, Metals, Crypto: currency-api (fawazahmed0, CC0 lisanslı, anahtarsız). Ana para birimine göre tek bir günlük
     dosya alınır; değişim yüzdesi bir önceki günün dosyasıyla hesaplanır.
   - Stocks: Finnhub, kullanıcının kendi ücretsiz anahtarıyla (ücretsiz plan: ABD hisseleri ve ETF'ler). Anahtar yoksa sekme gizli.
   - Funds: bölgesel kaynaklar, varsayılan kapalı. Şimdilik yalnızca Türkiye (TEFAS fon sayfasındaki gömülü veri).
   Ayarlar settings.markets ve settings.region.base içinde (senkron); fiyat önbelleği yerelde ("rates", "quotes").
   newtab.js, widgets.js ve settings.js'ten sonra yüklenir ($, el, store, settings, saveSettings, fmtTime, currencyLabel). */

const RATES_TTL_MIN = 60;        // currency-api günde bir güncellenir
const Q_TTL_MIN = 15;            // Finnhub
const Q_TTL_TEFAS_MIN = 60;      // TEFAS fiyatı günde bir değişir
const RATE_URLS = (base, ver) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${ver}/v1/currencies/${base}.min.json`,
  `https://${ver}.currency-api.pages.dev/v1/currencies/${base}.min.json`, // belgelenmiş yedek adres
];
const OZ_G = 31.1034768;
const METALS = [['xau', 'Gold'], ['xag', 'Silver'], ['xpt', 'Platinum'], ['xpd', 'Palladium']];
const CRYPTO = [['btc', 'Bitcoin'], ['eth', 'Ethereum'], ['sol', 'Solana'], ['xrp', 'XRP'], ['bnb', 'BNB'], ['ada', 'Cardano'], ['doge', 'Dogecoin'], ['ltc', 'Litecoin'], ['dot', 'Polkadot'], ['trx', 'TRON']];
const NAME = Object.fromEntries([...METALS, ...CRYPTO]);
const TABS = ['fx', 'metals', 'crypto', 'stocks', 'funds'];
let mktTab = 'fx';

const fmtNum = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
function digits(v) { const a = Math.abs(v); return a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6; }
function fmtMoney(v, cur) {
  if (v == null || !isFinite(v)) return '—';
  const d = digits(v);
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase(), currencyDisplay: 'narrowSymbol', minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
  catch { return fmtNum(v, d) + ' ' + cur.toUpperCase(); }
}
const pctText = (p) => (p == null || !isFinite(p) ? '' : (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + fmtNum(Math.abs(p)) + '%');
const pctClass = (p) => 'mkt-chg ' + (p > 0 ? 'up' : p < 0 ? 'down' : '');
const mk = () => settings.markets;
const base = () => (settings.region && settings.region.base) || 'usd';

/* ---------------------------------------------------------
   currency-api: ana para birimine göre günlük kurlar
   --------------------------------------------------------- */
let rates = null; // {base, date, at, cur: {kod: oran}, prev: {kod: oran} | null}
async function fetchRateFile(b, ver) {
  let last;
  for (const url of RATE_URLS(b, ver)) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j[b]) throw new Error('unexpected response');
      return j;
    } catch (e) { last = e; }
  }
  throw last;
}
function dayBefore(date) { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
async function loadRates(force = false) {
  const b = base();
  if (!rates) rates = await store.get('rates', null);
  if (!force && rates && rates.base === b && !rates.err && Date.now() - rates.at < RATES_TTL_MIN * 60e3) return rates;
  try {
    const j = await fetchRateFile(b, 'latest');
    let prev = null;
    try { prev = (await fetchRateFile(b, dayBefore(j.date)))[b]; } catch { /* değişim yüzdesi gösterilmez */ }
    rates = { base: b, date: j.date, at: Date.now(), cur: j[b], prev };
    store.set('rates', rates);
  } catch (e) {
    console.warn('[new-tab] rates', e);
    if (rates && rates.base !== b) rates = null; // başka para birimine ait eski veri gösterilmesin
    if (rates) rates.err = String(e.message || e);
  }
  return rates;
}
// 1 birim X kaç birim ana para birimi eder (dosyada "1 ana = oran X" var).
const valueOf = (map, code) => (map && map[code] ? 1 / map[code] : null);
const changeOf = (code) => {
  const now = valueOf(rates && rates.cur, code), before = valueOf(rates && rates.prev, code);
  return now && before ? (now - before) / before * 100 : null;
};

/* ---------------------------------------------------------
   Finnhub ve TEFAS: sembol başına önbellek
   --------------------------------------------------------- */
let quotes = {}; // anahtar → {at, price, prev, cur, name, err}
const qKey = (item) => (item.src === 'tefas' ? 'tefas:' : 'fh:') + item.s;

async function fetchFinnhub(sym) {
  const key = mk().finnhubKey;
  if (!key) throw new Error('No API key');
  const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`);
  if (r.status === 401 || r.status === 403) throw new Error('API key rejected or symbol not in your plan');
  if (r.status === 429) throw new Error('Rate limit reached, try again in a minute');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || !j.c) throw new Error('No price (symbol not found or not covered)');
  return { price: j.c, prev: j.pc || null, cur: 'usd', time: j.t ? j.t * 1000 : null };
}
// TEFAS'ın eski JSON ucu kapandı (2026-11: "Method not found"); fon sayfası sunucuda üretilirken
// fon verisini sayfanın içine gömüyor. Resmî API değil: sayfa değişirse bu satır hata gösterir.
async function fetchTefas(code) {
  const r = await fetch(`https://www.tefas.gov.tr/tr/fon-detayli-analiz/${encodeURIComponent(code)}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const html = (await r.text()).replace(/\\"/g, '"');
  if (/<title>Request Rejected<\/title>/i.test(html)) throw new Error('TEFAS rejected the request (firewall)');
  const price = html.match(/"sonFiyat":(-?[\d.]+)/);
  if (!price) throw new Error('Fund not found on TEFAS');
  const ret = html.match(/"gunlukGetiri":(-?[\d.]+)/);
  const name = [...html.matchAll(/"fonUnvan":"([^"]{2,200})"/g)].map((m) => m[1]).find((t) => t !== 'Fon Adı');
  const p = parseFloat(price[1]);
  const pct = ret ? parseFloat(ret[1]) : null;
  return { price: p, prev: pct == null ? null : p / (1 + pct / 100), cur: 'try', name: name || code, time: null };
}
async function getQuote(item, force) {
  const k = qKey(item);
  const ttl = (item.src === 'tefas' ? Q_TTL_TEFAS_MIN : Q_TTL_MIN) * 60e3;
  const c = quotes[k];
  if (!force && c && !c.err && Date.now() - c.at < ttl) return c;
  if (!force && c && c.err && Date.now() - c.at < 60e3) return c; // hata sonrası bir dakika bekle
  try { quotes[k] = { at: Date.now(), ...(item.src === 'tefas' ? await fetchTefas(item.s) : await fetchFinnhub(item.s)) }; }
  catch (e) { console.warn('[new-tab] quote', item.s, e); quotes[k] = { ...(c || {}), at: Date.now(), err: String(e.message || e) }; }
  return quotes[k];
}

/* ---------------------------------------------------------
   Kart
   --------------------------------------------------------- */
function row({ name, sub, value, pct, href, tip, err }) {
  const children = [
    el('span', { class: 'mkt-name' }, name, sub ? el('small', { text: sub }) : null),
    el('span', { class: 'mkt-val', text: value }),
    el('span', { class: pctClass(pct), text: pctText(pct) }),
  ];
  return href
    ? el('a', { class: 'mkt-row' + (err ? ' err' : ''), href, title: tip || '' }, ...children)
    : el('div', { class: 'mkt-row' + (err ? ' err' : ''), title: tip || '' }, ...children);
}
const muted = (text, ...extra) => el('div', { class: 'muted mkt-empty' }, text, ...extra);
function settingsLink(tab, text = 'Settings') {
  const b = el('button', { class: 'link-btn', text });
  b.addEventListener('click', () => { toggleSettings(true); setMwTab(tab); $('mwTabs').scrollIntoView({ block: 'center' }); });
  return b;
}
function ratesFooter() {
  if (!rates) return '';
  return `currency-api · daily · ${rates.date}` + (rates.err ? ' · offline' : '');
}

function renderFx() {
  const b = base();
  if (!rates || !rates.cur) { $('market').replaceChildren(muted('Rates unavailable (check your network connection).')); $('mktTime').textContent = ''; return; }
  const list = mk().fx.filter((c) => c !== b && rates.cur[c]);
  $('market').replaceChildren(...(list.length ? list.map((c) => {
    const v = valueOf(rates.cur, c), unit = v < 0.001 ? 10000 : v < 0.1 ? 100 : 1; // değeri çok küçük olanlar 100 ya da 10.000 birim için
    const C = c.toUpperCase();
    return row({
      name: C, sub: (unit > 1 ? unit.toLocaleString('en-US') + ' ' : '') + (currencyNames.of(C) || ''), value: fmtMoney(v * unit, b), pct: changeOf(c),
      tip: `${unit.toLocaleString('en-US')} ${C} = ${fmtMoney(v * unit, b)}`,
    });
  }) : [muted('No currencies selected. ', settingsLink('fx', 'Add some'))]));
  renderConvOptions();
  convert();
  $('mktTime').textContent = ratesFooter();
}
function renderMetals() {
  const b = base(), unit = mk().metalUnit === 'g' ? 'g' : 'oz';
  const items = mk().metals.filter((c) => NAME[c]);
  $('mktList').replaceChildren(...(items.length ? items.map((c) => {
    const oz = valueOf(rates && rates.cur, c);
    return row({ name: NAME[c], sub: 'per ' + (unit === 'g' ? 'gram' : 'oz'), value: oz == null ? '—' : fmtMoney(unit === 'g' ? oz / OZ_G : oz, b), pct: changeOf(c) });
  }) : [muted('Nothing selected. ', settingsLink('metals', 'Choose metals'))]));
  $('mktTime').textContent = ratesFooter();
}
function renderCrypto() {
  const b = base();
  const items = mk().crypto.filter((c) => NAME[c]);
  $('mktList').replaceChildren(...(items.length ? items.map((c) => row({ name: NAME[c], sub: c.toUpperCase(), value: fmtMoney(valueOf(rates && rates.cur, c), b), pct: changeOf(c) }))
    : [muted('Nothing selected. ', settingsLink('crypto', 'Choose coins'))]));
  $('mktTime').textContent = ratesFooter();
}
function quoteRow(item) {
  const q = quotes[qKey(item)] || {};
  const pct = q.price != null && q.prev ? (q.price - q.prev) / q.prev * 100 : null;
  const href = item.src === 'tefas' ? `https://www.tefas.gov.tr/tr/fon-detayli-analiz/${encodeURIComponent(item.s)}` : null;
  const tip = [q.name || item.d || item.s, q.time ? 'as of ' + new Date(q.time).toLocaleString() : '', q.err ? 'Error: ' + q.err : ''].filter(Boolean).join('\n');
  return row({
    name: item.n || item.s, sub: item.src === 'tefas' ? 'TEFAS' : '', href, tip,
    value: q.price == null ? (q.err ? '!' : '…') : fmtMoney(q.price, q.cur || 'usd'), pct, err: q.err && q.price == null,
  });
}
function renderQuotes(tab) {
  const items = mk()[tab] || [];
  $('mktList').replaceChildren(...(items.length ? items.map(quoteRow) : [muted('Nothing to watch yet. ', settingsLink(tab, 'Add in Settings'))]));
  const ats = items.map((i) => quotes[qKey(i)] && quotes[qKey(i)].at).filter(Boolean);
  const src = tab === 'stocks' ? 'Finnhub' : 'TEFAS';
  $('mktTime').textContent = items.length ? src + (ats.length ? ` · checked ${fmtTime.format(new Date(Math.min(...ats)))}` : '') : '';
}

function render() {
  if (mktTab === 'fx') renderFx();
  else if (mktTab === 'metals') renderMetals();
  else if (mktTab === 'crypto') renderCrypto();
  else renderQuotes(mktTab);
}
let loadGen = 0;
async function loadTab(force = false) {
  const gen = ++loadGen, tab = mktTab;
  render();
  if (tab === 'stocks' || tab === 'funds') {
    await Promise.all((mk()[tab] || []).map((i) => getQuote(i, force)));
    store.set('quotes', quotes);
  } else await loadRates(force);
  if (gen === loadGen && tab === mktTab) render();
}

const tabVisible = (t) => (t === 'stocks' ? !!mk().finnhubKey : t === 'funds' ? !!mk().tefas : true);
const visibleTabs = () => TABS.filter(tabVisible);
function setMarketTab(tab) {
  mktTab = tabVisible(tab) ? tab : 'fx';
  for (const b of document.querySelectorAll('.mkt-tabs .tab')) {
    const on = b.dataset.mtab === mktTab;
    b.hidden = !tabVisible(b.dataset.mtab);
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  document.querySelector('.mkt-tabs').classList.toggle('many', visibleTabs().length > 4);
  $('mktFx').hidden = mktTab !== 'fx';
  $('mktList').hidden = mktTab === 'fx';
  loadTab();
}
for (const b of document.querySelectorAll('.mkt-tabs .tab')) {
  b.addEventListener('click', () => { setMarketTab(b.dataset.mtab); store.set('mktTab', mktTab); });
}
document.querySelector('.mkt-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault(); e.stopPropagation();
  const tabs = visibleTabs();
  const i = (tabs.indexOf(mktTab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  setMarketTab(tabs[i]); store.set('mktTab', mktTab);
  document.querySelector(`.mkt-tabs .tab[data-mtab="${mktTab}"]`).focus();
});
$('mktRefresh').addEventListener('click', () => loadTab(true));

/* ---- Çevirici: herhangi iki para birimi (ana para birimi + izlenenler) ---- */
function convCodes() { const b = base(); return [b, ...mk().fx.filter((c) => c !== b && rates && rates.cur && rates.cur[c])]; }
function renderConvOptions() {
  const codes = convCodes();
  for (const [id, def] of [['cvFrom', codes[1] || codes[0]], ['cvTo', codes[0]]]) {
    const sel = $(id), prev = sel.value;
    sel.replaceChildren(...codes.map((c) => el('option', { value: c, text: c.toUpperCase() })));
    sel.value = codes.includes(prev) ? prev : def;
  }
}
function convert() {
  const amt = parseFloat($('cvAmt').value), from = $('cvFrom').value, to = $('cvTo').value, b = base();
  if (!from || !to || isNaN(amt) || !rates || !rates.cur) { $('cvOut').textContent = ''; return; }
  const v = (c) => (c === b ? 1 : valueOf(rates.cur, c));
  $('cvOut').textContent = '= ' + fmtMoney(amt * v(from) / v(to), to);
}
$('cvAmt').addEventListener('input', convert);
$('cvFrom').addEventListener('change', convert);
$('cvTo').addEventListener('change', convert);
$('conv').addEventListener('submit', (e) => e.preventDefault());

// settings.js her ayar değişiminde çağırır (başka cihazdan senkron gelince de).
let lastBase = null;
function onMarketSettings() {
  const b = base();
  if (lastBase && lastBase !== b) rates = null;
  lastBase = b;
  setMarketTab(mktTab);
}

/* ---------------------------------------------------------
   Ayarlar: Markets bölümü
   --------------------------------------------------------- */
let mwTab = 'fx';
function setMwTab(tab) { mwTab = TABS.includes(tab) ? tab : 'fx'; renderWatchlist(); }
for (const b of document.querySelectorAll('#mwTabs button')) b.addEventListener('click', () => setMwTab(b.dataset.mw));
const saveMarkets = () => saveSettings();
function moveItem(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; saveMarkets(); }
function listItem(label, sub, arr, i) {
  const up = el('button', { class: 'link-btn', title: 'Move up', 'aria-label': 'Move ' + label + ' up', text: '↑' });
  up.addEventListener('click', () => moveItem(arr, i, -1));
  const del = el('button', { class: 'link-btn', title: 'Remove', 'aria-label': 'Remove ' + label, text: '✕' });
  del.addEventListener('click', () => { arr.splice(i, 1); saveMarkets(); });
  return el('li', {}, el('span', { text: label }), el('small', { text: sub }), i ? up : null, del);
}
function checklist(all, key) {
  return all.map(([c, n]) => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = mk()[key].includes(c);
    cb.addEventListener('change', () => {
      const set = new Set(mk()[key]); cb.checked ? set.add(c) : set.delete(c);
      mk()[key] = all.map(([x]) => x).filter((x) => set.has(x)); // hazır listedeki sıra korunur
      saveMarkets();
    });
    return el('li', {}, el('label', { class: 'set-toggle mw-check' }, cb, el('span', { text: n }), el('small', { text: c.toUpperCase() })));
  });
}
function showForm(pick, input) {
  $('mwForm').hidden = !pick && !input;
  $('mwPick').hidden = !pick;
  $('mwInput').hidden = !input;
}

function renderWatchlist() {
  for (const b of document.querySelectorAll('#mwTabs button')) b.setAttribute('aria-pressed', String(b.dataset.mw === mwTab));
  const m = mk();
  $('mwSuggest').hidden = true;
  $('mwState').textContent = '';
  const intro = (...c) => $('mwIntro').replaceChildren(...c);

  if (mwTab === 'fx') {
    intro(`Prices in ${base().toUpperCase()} (change it under Region and units). Daily rates from currency-api.`);
    $('mwList').replaceChildren(...m.fx.map((c, i) => listItem(c.toUpperCase(), currencyNames.of(c.toUpperCase()) || '', m.fx, i)));
    if (!m.fx.length) $('mwList').replaceChildren(el('li', { class: 'muted', text: 'No currencies.' }));
    const options = currencyCodes().filter((c) => !m.fx.includes(c) && c !== base());
    $('mwPick').replaceChildren(el('option', { value: '', text: '+ Add a currency…' }), ...options.map((c) => el('option', { value: c, text: currencyLabel(c) })));
    showForm(true, false);
    return;
  }
  if (mwTab === 'metals') {
    intro('Spot prices in your currency.');
    const unit = el('div', { class: 'seg mw-unit', role: 'group', 'aria-label': 'Unit' }, ...[['oz', 'Troy ounce'], ['g', 'Gram']].map(([u, t]) => {
      const b = el('button', { type: 'button', text: t, 'aria-pressed': String(m.metalUnit === u) });
      b.addEventListener('click', () => { m.metalUnit = u; saveMarkets(); });
      return b;
    }));
    $('mwList').replaceChildren(el('li', {}, unit), ...checklist(METALS, 'metals'));
    showForm(false, false);
    return;
  }
  if (mwTab === 'crypto') {
    intro('Daily prices in your currency.');
    $('mwList').replaceChildren(...checklist(CRYPTO, 'crypto'));
    showForm(false, false);
    return;
  }
  if (mwTab === 'stocks') {
    if (!m.finnhubKey) {
      const input = el('input', { type: 'password', placeholder: 'Finnhub API key', 'aria-label': 'Finnhub API key', autocomplete: 'off' });
      const form = el('form', { class: 'clock-form' }, input, el('button', { class: 'btn', type: 'submit', text: 'Save' }));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = input.value.trim();
        if (!key) return;
        // İzin penceresi kullanıcı tıklamasının içinde açılmalı: önce izin, sonra ağ isteği.
        requestAccess('https://finnhub.io/').then(async (ok) => {
          if (!ok) { $('mwState').textContent = 'Permission to access finnhub.io was not granted.'; return; }
          $('mwState').textContent = 'Checking…';
          try {
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key)}`);
            if (!r.ok) throw new Error(r.status === 401 ? 'Key rejected.' : 'HTTP ' + r.status);
            m.finnhubKey = key; saveMarkets();
          } catch (err) { $('mwState').textContent = String(err.message || err); }
        });
      });
      intro('US stocks and ETFs need a free API key from ', el('a', { href: 'https://finnhub.io/register', text: 'finnhub.io' }),
        '. The key is stored in your browser settings and sent only to Finnhub.');
      $('mwList').replaceChildren(el('li', {}, form));
      showForm(false, false);
      return;
    }
    const remove = el('button', { class: 'link-btn', text: 'Remove API key' });
    remove.addEventListener('click', () => { m.finnhubKey = ''; saveMarkets(); });
    intro('US stocks and ETFs via Finnhub. ', remove);
    $('mwList').replaceChildren(...m.stocks.map((it, i) => listItem(it.n, it.d || '', m.stocks, i)));
    if (!m.stocks.length) $('mwList').replaceChildren(el('li', { class: 'muted', text: 'Empty. Search below to add.' }));
    $('mwInput').placeholder = 'Search a US stock or ETF (e.g. AAPL)';
    showForm(false, true);
    return;
  }
  // funds: bölgesel kaynaklar
  const cb = el('input', { type: 'checkbox' });
  cb.checked = !!m.tefas;
  cb.addEventListener('change', () => {
    if (!cb.checked) { m.tefas = false; saveMarkets(); return; }
    requestAccess('https://www.tefas.gov.tr/').then((ok) => {
      if (!ok) { cb.checked = false; $('mwState').textContent = 'Permission to access tefas.gov.tr was not granted.'; return; }
      m.tefas = true; saveMarkets();
    });
  });
  intro('Regional fund sources. Off by default.');
  const toggle = el('li', {}, el('label', { class: 'set-toggle mw-check' }, cb, el('span', { text: 'Turkey — TEFAS funds' }), el('small', { text: 'tefas.gov.tr' })));
  $('mwList').replaceChildren(toggle, ...(m.tefas ? m.funds.map((it, i) => listItem(it.n, 'TEFAS', m.funds, i)) : []));
  $('mwInput').placeholder = 'TEFAS fund code (e.g. TTE)';
  showForm(false, !!m.tefas);
}

$('mwPick').addEventListener('change', () => {
  const c = $('mwPick').value;
  if (c && !mk().fx.includes(c)) { mk().fx.push(c); saveMarkets(); }
});

// Finnhub araması (yazdıkça, 300 ms bekleyerek); sonuca tıklayınca listeye eklenir.
let mwTimer, mwSeq = 0, mwResults = [];
async function searchMw() {
  const text = $('mwInput').value.trim();
  const seq = ++mwSeq;
  if (!text || mwTab !== 'stocks') { $('mwSuggest').hidden = true; return; }
  let out = [];
  try {
    const r = await fetch(`https://finnhub.io/api/v1/search?exchange=US&q=${encodeURIComponent(text)}&token=${encodeURIComponent(mk().finnhubKey)}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    out = ((await r.json()).result || []).filter((x) => x.symbol && !x.symbol.includes('.')).slice(0, 8)
      .map((x) => ({ s: x.symbol, d: x.description, label: x.symbol, sub: `${x.description || ''} · ${x.type || ''}` }));
  } catch (e) { console.warn('[new-tab] search', e); if (seq === mwSeq) $('mwState').textContent = 'Search failed.'; }
  if (seq !== mwSeq) return;
  mwResults = out;
  $('mwSuggest').replaceChildren(...out.map((o, i) => el('li', { role: 'option', 'data-i': i }, el('b', { text: o.label }), el('small', { text: o.sub }))));
  if (!out.length) $('mwSuggest').replaceChildren(el('li', { class: 'muted', text: 'No match. Press Enter to add the symbol as typed.' }));
  $('mwSuggest').hidden = false;
}
$('mwInput').addEventListener('input', () => { clearTimeout(mwTimer); mwTimer = setTimeout(searchMw, 300); });

async function addQuoteItem(item) {
  const list = mk()[mwTab];
  if (list.some((x) => qKey(x) === qKey(item))) { $('mwState').textContent = 'Already in the list.'; return; }
  $('mwState').textContent = 'Checking…';
  const q = await getQuote(item, true);
  if (q.price == null) { $('mwState').textContent = (q.err || 'No price') + ' — not added.'; delete quotes[qKey(item)]; return; }
  list.push(item);
  $('mwInput').value = '';
  $('mwState').textContent = `Added ${item.n}.`;
  store.set('quotes', quotes);
  saveMarkets();
}
$('mwSuggest').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li) { const o = mwResults[+li.dataset.i]; addQuoteItem({ s: o.s, n: o.s, d: o.d }); }
});
$('mwForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('mwInput').value.trim().toUpperCase();
  if (!text) return;
  if (mwTab === 'funds') addQuoteItem({ s: text, n: text, src: 'tefas' });
  else if (mwTab === 'stocks') {
    const o = !$('mwSuggest').hidden && mwResults[0];
    addQuoteItem(o ? { s: o.s, n: o.s, d: o.d } : { s: text, n: text });
  }
});

/* ---------------------------------------------------------
   Başlatma
   --------------------------------------------------------- */
(async function initMarkets() {
  const [q, tab] = await Promise.all([store.get('quotes', {}), store.get('mktTab', 'fx')]);
  quotes = q && typeof q === 'object' ? q : {};
  mktTab = TABS.includes(tab) ? tab : 'fx';
  lastBase = base();
  setMarketTab(mktTab);
  setInterval(() => { if (!document.hidden) loadTab(); }, Q_TTL_MIN * 60e3);
})();
