# Store listing (Chrome Web Store and addons.mozilla.org)

## Name
Kotilo New Tab

## Status
- Firefox (AMO): public since 2026-11-09 at https://addons.mozilla.org/firefox/addon/kotilo-new-tab/ (version 3.0.0, MIT, category Tabs). The privacy policy text must be pasted in the Developer Hub (the API ignored it).
- Chrome Web Store: public since 2026-11-13 at https://chromewebstore.google.com/detail/kotilo-new-tab/jkalagachkdlnpmbgaoimmgkpgmbnhii (version 3.0.0, store ID jkalagachkdlnpmbgaoimmgkpgmbnhii; differs from the unpacked ID because store packages have no `key`). Upload new versions as dist/kotilo-newtab-<version>-chrome-store.zip.

## Links
- Product page / homepage: https://kotilo.dev/newtab/
- Privacy policy: https://kotilo.dev/newtab/privacy/
- Promo video (YouTube, Chrome "YouTube video" field): https://youtu.be/OaJ765YvvEo
- Support: https://github.com/kotilo-dev/kotilo-newtab/issues

## Short description (Chrome: max 132 characters; AMO summary: max 250)
Your bookmarks in a sidebar, with clock, weather, calendar, to-dos, notes, news feeds, Pomodoro and exchange rates. No tracking.

## Category
Chrome: Productivity (Workflow & planning) · AMO: Tabs

## Detailed description
Turn every new tab into a calm, useful start page.

• Bookmarks sidebar — browse your bookmarks bar folder by folder, filter it as you type, search bookmarks and open tabs, and add, edit, delete or drag bookmarks without leaving the page.
• Search the web with your browser's own search engine, right from the search box.
• Recently closed tabs, most visited sites and saved sessions: save all open tabs as a bookmark folder and reopen them later.
• News — follow any RSS or Atom feed and filter by source.
• Clock, world clocks and a monthly calendar with public holidays for your country.
• Weather — now, hourly and 5 days, in °C or °F.
• Daily focus, to-do list, notes and a Pomodoro timer with notifications.
• Markets — exchange rates in your own currency with a converter, precious metals and major cryptocurrencies. Optional US stocks and ETFs with your own free Finnhub key.
• Quote of the day.
• A new Wikimedia Commons picture of the day as your background, or your own photo and video wallpapers, kept on your device.
• Zen mode: just the clock and the background, one keystroke away (Alt+Z).
• Light and dark theme, accent colours, card order, and every part can be shown or hidden. Settings sync through your browser account; export and import a backup file.
• English and Turkish interface.

Privacy first: no account, no analytics, no ads. Your data stays in your browser. The page only contacts the public services needed for weather, holidays, exchange rates, the daily quote and the picture of the day. Full policy: https://kotilo.dev/newtab/privacy/

## Turkish listing (Chrome: add language "Türkçe"; AMO: Turkish locale)
Name stays "Kotilo New Tab".

Short description:
Yer imlerin kenar çubuğunda; saat, hava durumu, takvim, yapılacaklar, notlar, haberler, Pomodoro ve döviz kurlarıyla. İzleme yok.

Detailed description:
Her yeni sekmeyi sakin ve işe yarar bir başlangıç sayfasına çevir.

• Yer imi kenar çubuğu: yer imi çubuğunda klasör klasör gez, yazarken filtrele, yer imlerinde ve açık sekmelerde ara; sayfadan çıkmadan yer imi ekle, düzenle, sil ya da sürükle.
• Tarayıcının kendi arama motoruyla doğrudan arama kutusundan web'de ara.
• Son kapatılan sekmeler, en çok ziyaret edilen siteler ve kayıtlı oturumlar: açık sekmelerin hepsini bir yer imi klasörüne kaydet, sonra yeniden aç.
• Haberler: istediğin RSS ya da Atom akışını ekle, kaynağa göre filtrele.
• Saat, dünya saatleri ve ülkenin resmî tatilleriyle aylık takvim.
• Hava durumu: şimdi, saatlik ve 5 günlük; °C ya da °F.
• Günün odağı, yapılacaklar, notlar ve bildirimli Pomodoro sayacı.
• Piyasalar: kendi para biriminde döviz kurları ve çevirici, değerli metaller ve başlıca kripto paralar. İstersen kendi ücretsiz Finnhub anahtarınla ABD hisseleri ve ETF'ler; Türkiye için TEFAS fonları.
• Günün sözü.
• Arka planda her gün yeni bir Wikimedia Commons fotoğrafı ya da cihazında saklanan kendi fotoğraf ve videoların.
• Sade mod: tek tuşla (Alt+Z) yalnızca saat ve arka plan.
• Açık ve koyu tema, vurgu renkleri, kart sırası; her parça gösterilip gizlenebilir. Ayarlar tarayıcı hesabınla eşitlenir; yedek dosyası dışa ve içe aktarılabilir.
• Türkçe ve İngilizce arayüz.

Önce gizlilik: hesap yok, analiz yok, reklam yok. Verilerin tarayıcında kalır. Sayfa yalnızca hava durumu, tatiller, döviz kurları, günün sözü ve günün resmi için gereken herkese açık servislere bağlanır. Politikanın tamamı: https://kotilo.dev/newtab/privacy/

## Single purpose (Chrome)
Replaces the new tab page with a start page that shows the user's bookmarks together with everyday widgets (clock, weather, calendar, to-dos, notes, news, timer, exchange rates).

## Permission justifications (Chrome)
| Permission | Why |
|---|---|
| bookmarks | Show the bookmarks bar in the sidebar and let the user add, edit, move and delete bookmarks. |
| favicon | Show bookmark icons from the browser's local icon cache, without contacting any site. |
| storage | Save settings, to-dos, notes and cached data. |
| unlimitedStorage | Keep user-added photo and video wallpapers on the device. |
| geolocation | Show local weather when the user allows location access. |
| tabs | Search the user's open tabs from the search box and switch to them; show titles of recently closed tabs. |
| sessions | List and restore recently closed tabs. |
| topSites | Show the user's most visited sites. |
| alarms | End Pomodoro sessions on time even when no new tab is open. |
| notifications | Tell the user when a Pomodoro session ends. |
| search | Run a web search with the user's default search engine when they press Enter in the search box. |
| Host permissions (open-meteo.com, bigdatacloud.net, date.nager.at, brainyquote.com, cdn.jsdelivr.net, currency-api.pages.dev) | Fetch weather, city name, public holidays, the daily quote and exchange rates. |
| Optional host permissions (any https/http site) | Requested per site only when the user adds an RSS feed, a Finnhub key or the TEFAS source. |

## Remote code (Chrome)
No. All code is in the package; only data (JSON, XML) is fetched.

## Data usage (Chrome disclosure)
- Location: approximate coordinates, sent to the weather services only if the user allows location access. Not stored by the developer.
- Website content: user-chosen RSS feeds are fetched and shown.
- The developer does not collect or transfer user data; no data is sold or used for advertising or credit decisions.

## Screenshots
`store/screenshots/` holds five 1280×800 24-bit PNGs (no alpha), made with sample data: (1) start page, (2) bookmark folder in the sidebar, (3) Metals tab, (4) calendar, (5) settings panel.

Background in all five: Sanford Robinson Gifford, *The Artist Sketching at Mount Desert, Maine* (1864–1865), National Gallery of Art, Washington, accession 2004.99.1. Public domain (NGA Open Access): https://www.nga.gov/artworks/121618-artist-sketching-mount-desert-maine
