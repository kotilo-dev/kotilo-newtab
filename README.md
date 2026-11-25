# Kotilo New Tab

**A calm new tab page for Chrome and Firefox: your bookmarks bar in a sidebar, plus a clock, weather, calendar, to-dos, notes, news feeds, a Pomodoro timer and exchange rates. In English and Turkish. No account, no tracking, no ads.**

Part of [Kotilo](https://kotilo.dev) · Türkçe: [aşağıda](#türkçe)

## Install

- **Chrome** and Chromium browsers (Edge, Brave, Opera): [Chrome Web Store](https://chromewebstore.google.com/detail/kotilo-new-tab/jkalagachkdlnpmbgaoimmgkpgmbnhii)
- **Firefox** 142+: [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/kotilo-new-tab/)

▶ Watch the 50-second tour on YouTube: https://youtu.be/OaJ765YvvEo

## Features

- **Bookmarks sidebar:** browse folders in place, filter the sidebar as you type, search all bookmarks and open tabs, add, edit, delete and drag to reorder. Changes go straight to your browser's bookmarks.
- **Web search** with the search engine you chose in your browser; the results list always ends with "Search the web for …".
- **Recent and top sites, saved sessions:** recently closed tabs and your most visited sites, one click away. Save the open tabs of a window as a bookmark folder (Other bookmarks › Kotilo sessions) and reopen them in a new window.
- **News:** add any RSS or Atom feed (or a site address; its feed is found automatically) and filter by source.
- **Clock and calendar:** world clocks; a monthly calendar with ISO week numbers and public holidays for your country (from Nager.Date).
- **Weather:** current conditions, hourly and 5-day forecast (Open-Meteo), in °C or °F.
- **Daily focus, to-dos, notes and Pomodoro.**
- **Markets:** exchange rates in your own currency with a converter; gold, silver, platinum and palladium per ounce or gram; Bitcoin, Ethereum and other major coins. Daily data from the free, public-domain [currency-api](https://github.com/fawazahmed0/exchange-api).
  - Optional **US stocks and ETFs** with your own free [Finnhub](https://finnhub.io) API key.
  - Optional regional fund source: Turkey (TEFAS), off by default.
- **Quote of the day** from BrainyQuote's daily feed, with an offline list as a fallback.
- **Backgrounds:** a new [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Picture_of_the_day) picture of the day (the default for new installs, with author and licence shown), or your own photos and looping videos, stored on your device.
- **Zen mode:** Alt+Z (or ◐ Zen in the sidebar) leaves only the clock, date and background; Esc brings everything back.
- **Settings sync** through your browser account; accent colours; show, hide and reorder the cards. **Backup:** export and import your settings, to-dos, notes and news sources as a JSON file (wallpapers and your Finnhub key are not included).
- **Language:** English or Turkish, following your browser by default (⚙ Settings → Region and units → Language).

On first run, the base currency, holiday country and units are guessed from your browser language; change them under ⚙ Settings → Region and units.

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: everything stays in your browser; the page only contacts the public services needed to show weather, holidays, rates, the daily quote and the picture of the day.

## Development

The repository root is the Chrome extension source and can be loaded directly with **chrome://extensions → Developer mode → Load unpacked**. The `key` field in `manifest.json` keeps the unpacked extension's ID stable across computers; it is removed from store packages.

```
node build.mjs
```

builds:

- `dist/firefox/`: Firefox package (Gecko ID, data-collection declaration, background script instead of a service worker, no `key`, no `favicon` permission). Check it with `npx web-ext lint` inside that folder.
- `dist/kotilo-newtab-<version>-chrome-store.zip`: Chrome Web Store upload (no `key`).

Sign or submit the Firefox package with `web-ext sign` (`--channel=unlisted` for a self-hosted `.xpi`, `--channel=listed` for addons.mozilla.org) using `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`.

Rules the code follows: text from outside (bookmarks, feeds, API responses) is never inserted as HTML; links are http(s) only; new sites are reached through optional, per-site permissions where possible.

## Support

Bugs and ideas: [GitHub issues](https://github.com/kotilo-dev/kotilo-newtab/issues).

## Licence

[MIT](LICENSE) © 2026 Kotilo

## Türkçe

Kotilo New Tab, Chrome ve Firefox için yeni sekme sayfası: yer imi çubuğun kenar çubuğunda; saat, hava durumu, takvim, yapılacaklar, not, haber akışları, Pomodoro ve döviz kurlarıyla birlikte. Arayüz Türkçe ve İngilizce; tarayıcı diline göre seçilir, ⚙ Ayarlar → Bölge ve birimler → Dil bölümünden değiştirilir. Arka planda her gün yeni bir Wikimedia Commons fotoğrafı, tarayıcının kendi arama motoruyla web araması, kayıtlı oturumlar, sade mod (Alt+Z) ve yedekleme de var. Hesap yok, izleme yok, reklam yok. Ana para birimi, tatil ülkesi ve birimler ilk açılışta tarayıcı dilinden tahmin edilir; ⚙ Settings → Region and units bölümünden değiştirilir. Türkiye kullanıcıları için TEFAS fonları Settings → Markets → Funds altında açılabilir.

Kurulum: [Chrome Web Mağazası](https://chromewebstore.google.com/detail/kotilo-new-tab/jkalagachkdlnpmbgaoimmgkpgmbnhii) · [Firefox Eklentileri](https://addons.mozilla.org/firefox/addon/kotilo-new-tab/) · [Tanıtım videosu (YouTube)](https://youtu.be/OaJ765YvvEo)
