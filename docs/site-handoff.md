# kotilo.dev — tasks for Kotilo New Tab

Hand-off for whoever maintains the site repository `kotilo-dev/kotilo-dev.github.io` (GitHub Pages, custom domain kotilo.dev, single `index.html` + `assets/style.css`, Geist fonts). Written 2026-11-09.

## Why

Kotilo New Tab (browser extension for Chrome and Firefox) is being published to the Chrome Web Store and addons.mozilla.org. Both stores need a **public privacy policy URL**, and the listings should point to a product page on kotilo.dev. Source repository: https://github.com/kotilo-dev/kotilo-newtab

## Required (blocks the Chrome Web Store submission)

1. **Privacy policy page at `https://kotilo.dev/newtab/privacy/`**
   - Content: the full text of `PRIVACY.md` in the extension repository (keep headings and the services table). Source of truth stays `PRIVACY.md`; the page is a rendered copy. Add a line "Source: <link to PRIVACY.md on GitHub>".
   - Must be reachable without JavaScript and must not set tracking cookies (the policy says no tracking).
   - When this URL works, tell the extension maintainer so it can be entered in both store forms and in `store/listing.md`.

## Recommended

2. **Product page at `https://kotilo.dev/newtab/`**
   - Title: "Kotilo New Tab". Tagline: "A calm new tab page: your bookmarks in a sidebar, with clock, weather, calendar, to-dos, notes, news, Pomodoro and exchange rates. No account, no tracking, no ads."
   - Feature list: take it from the "Features" section of the extension `README.md`.
   - Screenshots: `store/screenshots/1-main.png` … `5-settings.png` in the extension repository (1280×800, demo data only).
   - Install buttons: "Add to Firefox" → https://addons.mozilla.org/firefox/addon/kotilo-new-tab/ (submitted 2026-11-09, live once Mozilla approves it; until then the page shows "not available"). "Add to Chrome": no URL yet (Chrome Web Store submission pending); show it disabled with "Coming soon" or link to the GitHub repository. The maintainer will send the Chrome URL after approval.
   - Footer links: Privacy (`/newtab/privacy/`), Source (GitHub repository), Issues (`/issues` of the repository), Licence (MIT).
3. **Home page (`index.html`)**: add Kotilo New Tab to wherever other Kotilo products are listed (or add a small "More from Kotilo" section with Kotilo Kit and Kotilo New Tab), linking to `/newtab/`.

## Facts to keep consistent

| Item | Value |
|---|---|
| Name | Kotilo New Tab |
| Publisher | Kotilo |
| Browsers | Chrome (and Chromium browsers), Firefox 142+ |
| Licence | MIT |
| Firefox add-on ID | newtab@kotilo.dev |
| Firefox listing | https://addons.mozilla.org/firefox/addon/kotilo-new-tab/ |
| Data | Stays in the browser; no analytics. Contacts Open-Meteo, BigDataCloud, Nager.Date, BrainyQuote, currency-api; optional Finnhub (user's own key), TEFAS (opt-in), user-added RSS feeds |
