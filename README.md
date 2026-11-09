# Kotilo New Tab

**A calm new tab page for Chrome and Firefox: your bookmarks bar in a sidebar, plus a clock, weather, calendar, to-dos, notes, news feeds, a Pomodoro timer and exchange rates. No account, no tracking, no ads.**

Part of [Kotilo](https://kotilo.dev) · Türkçe: [aşağıda](#türkçe)

## Features

- **Bookmarks sidebar:** browse folders in place, search all bookmarks and open tabs, add, edit, delete and drag to reorder. Changes go straight to your browser's bookmarks.
- **Recent and top sites:** recently closed tabs and your most visited sites, one click away.
- **News:** add any RSS or Atom feed (or a site address; its feed is found automatically) and filter by source.
- **Clock and calendar:** world clocks; a monthly calendar with ISO week numbers and public holidays for your country (from Nager.Date).
- **Weather:** current conditions, hourly and 5-day forecast (Open-Meteo), in °C or °F.
- **Daily focus, to-dos, notes and Pomodoro.**
- **Markets:** exchange rates in your own currency with a converter; gold, silver, platinum and palladium per ounce or gram; Bitcoin, Ethereum and other major coins. Daily data from the free, public-domain [currency-api](https://github.com/fawazahmed0/exchange-api).
  - Optional **US stocks and ETFs** with your own free [Finnhub](https://finnhub.io) API key.
  - Optional regional fund source: Turkey (TEFAS), off by default.
- **Quote of the day** from BrainyQuote's daily feed, with an offline list as a fallback.
- **Your own wallpapers:** photos or looping videos, stored on your device.
- **Settings sync** through your browser account; accent colours; show or hide every part.

On first run, the base currency, holiday country and units are guessed from your browser language; change them under ⚙ Settings → Region and units.

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: everything stays in your browser; the page only contacts the public services needed to show weather, holidays, rates and the daily quote.

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

Kotilo New Tab, Chrome ve Firefox için yeni sekme sayfası: yer imi çubuğun kenar çubuğunda; saat, hava durumu, takvim, yapılacaklar, not, haber akışları, Pomodoro ve döviz kurlarıyla birlikte. Hesap yok, izleme yok, reklam yok. Ana para birimi, tatil ülkesi ve birimler ilk açılışta tarayıcı dilinden tahmin edilir; ⚙ Settings → Region and units bölümünden değiştirilir. Türkiye kullanıcıları için TEFAS fonları Settings → Markets → Funds altında açılabilir.
