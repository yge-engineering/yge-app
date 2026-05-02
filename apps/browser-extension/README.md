# YGE Auto Form Filler — browser extension

Phase-1 Manifest V3 extension that fills YGE's CSLB / DIR / DOT / NAICS / address into matching fields on any web form. Built for Caltrans BidExpress, Cal eProcure, county purchasing portals, vendor credit apps, sub prequal systems, ACORD COI requests.

## How it works

1. Open the YGE web app + sign in (so the API is running locally on `http://localhost:4000`).
2. Open any agency / vendor portal you need to fill.
3. Click the extension icon → **Scan this page** — the extension fetches the master profile from `/api/master-profile`, walks every input on the page, and proposes matches.
4. Tick which fields to fill (low-confidence matches are unticked by default).
5. **Apply** writes the values, dispatches `input` + `change` events so React forms pick them up.

## Building

```
pnpm --filter @yge/browser-extension build
```

The build bundles every entry point with esbuild (target Chrome 111 / Firefox 109 / Safari 16.4) into `dist/`:

```
dist/
  manifest.json
  icons/*
  src/
    background.js
    content.js
    popup.html
    popup.js
    options.html
    options.js
```

`dist/` is gitignored — re-run `build` after any source change.

Load it as an unpacked extension in Chrome / Edge:

1. `chrome://extensions/`
2. Toggle **Developer mode**
3. **Load unpacked** → point at `apps/browser-extension/dist`

## Production rollout

- **Chrome Web Store** — submit a packed `.zip` of `dist/`. Manifest V3 is required (already set).
- **Edge Add-ons** — same package; separate listing.
- **Firefox / Safari** — Manifest V3 support is fine on Firefox 109+ and Safari 16.4+. The extension uses `chrome.*` APIs which Firefox aliases automatically; Safari needs the package wrapped via `xcrun safari-web-extension-converter`.

## Settings

The options page (`/options.html`, also auto-opened on first install) sets the YGE API base URL. Defaults to `http://localhost:4000`; production points at `https://api.youngge.com`.

## What it doesn't do (yet)

- No local cache of the profile beyond the popup-trigger refresh — every Scan re-pulls from the API.
- No SSN / banking / signature autofill — those stay inline-prompt by design.
- No browser-side e-sig (covered by `/sign/[id]` in the web app).
