# Kotilo New Tab — Privacy Policy

_Last updated: 9 November 2026_

This extension replaces your browser's new tab page. It has no account, no analytics, no advertising and no server of its own. The developer does not receive, collect, store or sell any of your data.

## Data stored on your device

Everything you enter stays in your browser's own extension storage:

- Bookmarks are read from, and edited in, your browser's bookmarks; the extension keeps no copy of them.
- Settings, world clocks, to-dos, daily focus, market watchlists and news feed addresses are kept in browser sync storage. If you are signed in to your browser with sync turned on, your browser (Google for Chrome, Mozilla for Firefox) syncs this data between your own devices.
- Notes, cached weather, cached prices and news, and click counts for frequently used bookmarks are kept in local storage on this device only.
- Wallpapers (photos and videos) you add are kept in the browser's local database (IndexedDB) on this device only.

Removing the extension deletes this data from the device.

## Network requests

To show its content, the extension's page contacts the following services directly from your browser. Each one receives only what is listed, plus the technical data every web request carries (such as your IP address).

| Service | When | What it receives |
|---|---|---|
| Open-Meteo (api.open-meteo.com, geocoding-api.open-meteo.com) | Weather card | Your approximate coordinates (only if you allow location access) or the city you type |
| BigDataCloud (api.bigdatacloud.net) | Weather card, automatic location | Your approximate coordinates, to show the city name |
| Nager.Date (date.nager.at) | Calendar | The country you selected for public holidays and the year |
| BrainyQuote (brainyquote.com) | Quote of the day | Nothing beyond the request for the public daily quote feed |
| currency-api (cdn.jsdelivr.net, currency-api.pages.dev) | Markets card | Your selected base currency |
| DuckDuckGo (icons.duckduckgo.com) | Firefox only, bookmark icons | The domain names of your bookmarks (Chrome uses its own local icon cache instead) |
| Finnhub (finnhub.io) | Only if you add your own Finnhub API key | Your API key and the stock symbols you watch |
| TEFAS (tefas.gov.tr) | Only if you turn on the regional "Turkey — TEFAS funds" source | The fund codes you watch |
| RSS feeds you add | Only for feeds you add | A normal request for that feed |

Optional sources (Finnhub, TEFAS, RSS feeds) ask for your permission to contact that site before the first request.

## Permissions

- **Bookmarks:** to show and manage your bookmarks bar.
- **Tabs, sessions, top sites:** to search your open tabs and to show recently closed tabs and most visited sites. This data is shown on the page only and never leaves your device.
- **Storage, unlimited storage:** to save your settings, notes and wallpapers.
- **Geolocation:** to show local weather, only if you allow it.
- **Alarms, notifications:** for the Pomodoro timer.
- **Favicon (Chrome):** to show bookmark icons from the browser's local cache.

## Contact

Kotilo New Tab is published by Kotilo (https://kotilo.dev). Questions about this policy: https://github.com/kotilo-dev/kotilo-newtab/issues
