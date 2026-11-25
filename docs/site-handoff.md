# kotilo.dev — tasks for Kotilo New Tab

Hand-off for whoever maintains the site repository `kotilo-dev/kotilo-dev.github.io` (GitHub Pages, custom domain kotilo.dev, single `index.html` + `assets/style.css`, Geist fonts). Written 2026-11-09.

## Why

Kotilo New Tab (browser extension for Chrome and Firefox) is being published to the Chrome Web Store and addons.mozilla.org. Both stores need a **public privacy policy URL**, and the listings should point to a product page on kotilo.dev. Source repository: https://github.com/kotilo-dev/kotilo-newtab

## Required (blocks the Chrome Web Store submission)

1. **Privacy policy page at `https://kotilo.dev/newtab/privacy/`**
   - Content: the full text of `PRIVACY.md` in the extension repository (keep headings and the services table). Source of truth stays `PRIVACY.md`; the page is a rendered copy. Add a line "Source: <link to PRIVACY.md on GitHub>".
   - Must be reachable without JavaScript and must not set tracking cookies (the policy says no tracking).
   - When this URL works, tell the extension maintainer so it can be entered in both store forms and in `store/listing.md`.

1a. **Update the privacy page for version 3.2.0** (added 2026-11-25)
   - Re-render `/newtab/privacy/` from the current `PRIVACY.md`. New in 3.2.0: the daily background photo is fetched from Wikimedia (`api.wikimedia.org`, `upload.wikimedia.org`); the new `search` permission (web search goes to the browser's default search engine); saved sessions are stored as ordinary bookmarks; backups are a JSON file the user downloads and imports. The "Last updated" date in `PRIVACY.md` is 25 November 2026.
   - Also add Wikimedia to the "Data" row in the table below.

## Recommended

2. **Product page at `https://kotilo.dev/newtab/`**
   - Title: "Kotilo New Tab". Tagline: "A calm new tab page: your bookmarks in a sidebar, with clock, weather, calendar, to-dos, notes, news, Pomodoro and exchange rates. No account, no tracking, no ads."
   - Feature list: take it from the "Features" section of the extension `README.md`.
   - Screenshots: `store/screenshots/1-main.png` … `5-settings.png` in the extension repository (1280×800, demo data only).
   - Install buttons: "Add to Chrome" → https://chromewebstore.google.com/detail/kotilo-new-tab/jkalagachkdlnpmbgaoimmgkpgmbnhii (public since 2026-11-13). "Add to Firefox" → https://addons.mozilla.org/firefox/addon/kotilo-new-tab/ (public since 2026-11-09). Both listings are live: enable both buttons and remove the "coming soon" / "in review" note.
   - Footer links: Privacy (`/newtab/privacy/`), Source (GitHub repository), Issues (`/issues` of the repository), Licence (MIT).
3. **Home page (`index.html`)**: add Kotilo New Tab to wherever other Kotilo products are listed (or add a small "More from Kotilo" section with Kotilo Kit and Kotilo New Tab), linking to `/newtab/`.
4. **Promo video on the product page** (added 2026-11-20)
   - Video: https://youtu.be/OaJ765YvvEo (50 seconds, 1920×1080, English captions, music; public on YouTube).
   - Place it on `/newtab/` right below the tagline and install buttons, above the screenshots.
   - Embed with the privacy-enhanced domain so no YouTube cookies are set until the visitor presses play (the policy says no tracking): `https://www.youtube-nocookie.com/embed/OaJ765YvvEo`. Use a responsive 16:9 box, `loading="lazy"`, a `title="Kotilo New Tab — 50-second tour"`, and `allow="encrypted-media; picture-in-picture; fullscreen"`.
   - Without JavaScript or if embedding fails, keep a plain link: "▶ Watch the 50-second tour on YouTube" → https://youtu.be/OaJ765YvvEo.
   - Optional: if the page sets a Content-Security-Policy, allow `frame-src https://www.youtube-nocookie.com`.

## Facts to keep consistent

| Item | Value |
|---|---|
| Name | Kotilo New Tab |
| Publisher | Kotilo |
| Browsers | Chrome (and Chromium browsers), Firefox 142+ |
| Licence | MIT |
| Firefox add-on ID | newtab@kotilo.dev |
| Firefox listing | https://addons.mozilla.org/firefox/addon/kotilo-new-tab/ |
| Data | Stays in the browser; no analytics. Contacts Open-Meteo, BigDataCloud, Wikimedia (daily photo), Nager.Date, BrainyQuote, currency-api; optional Finnhub (user's own key), TEFAS (opt-in), user-added RSS feeds |
