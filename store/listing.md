# Store listing (Chrome Web Store and addons.mozilla.org)

## Name
Kotilo New Tab

## Status
- Firefox (AMO): submitted 2026-11-09 as https://addons.mozilla.org/firefox/addon/kotilo-new-tab/ (listed, MIT, category Tabs). The privacy policy text must be pasted in the Developer Hub (the API ignored it).
- Chrome Web Store: not submitted yet. Upload dist/kotilo-newtab-<version>-chrome-store.zip.

## Short description (Chrome: max 132 characters; AMO summary: max 250)
Your bookmarks in a sidebar, with clock, weather, calendar, to-dos, notes, news feeds, Pomodoro and exchange rates. No tracking.

## Category
Chrome: Productivity (Workflow & planning) · AMO: Tabs

## Detailed description
Turn every new tab into a calm, useful start page.

• Bookmarks sidebar — browse your bookmarks bar folder by folder, search bookmarks and open tabs as you type, and add, edit, delete or drag bookmarks without leaving the page.
• Recently closed tabs and most visited sites.
• News — follow any RSS or Atom feed and filter by source.
• Clock, world clocks and a monthly calendar with public holidays for your country.
• Weather — now, hourly and 5 days, in °C or °F.
• Daily focus, to-do list, notes and a Pomodoro timer with notifications.
• Markets — exchange rates in your own currency with a converter, precious metals and major cryptocurrencies. Optional US stocks and ETFs with your own free Finnhub key.
• Quote of the day.
• Your own photo or video wallpapers, kept on your device.
• Light and dark theme, accent colours, and every part can be shown or hidden. Settings sync through your browser account.

Privacy first: no account, no analytics, no ads. Your data stays in your browser. The page only contacts the public services needed for weather, holidays, exchange rates and the daily quote. Full policy: <privacy policy URL — see docs/site-handoff.md>

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
