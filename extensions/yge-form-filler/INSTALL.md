# YGE Form Filler — extension install

This is the YGE auto-fill browser extension scaffold (Manifest v3).
Today it just reads page fields and reports the count — no auto-fill
yet. The real fill flow lands in a follow-up bundle.

## Chrome / Edge install (developer mode)

1. Open `chrome://extensions/`.
2. Toggle "Developer mode" on (top-right).
3. Click "Load unpacked".
4. Select this directory:
   `~/Documents/Claude/Estimating Software/Estimating Software/yge-app/extensions/yge-form-filler/`
5. The "YGE Form Filler" icon appears in the toolbar. Pin it.

## Safari install (Xcode required)

Safari requires the extension to be wrapped in a macOS app shell:

1. Open Xcode → File → New → Project → Safari Extension App.
2. Point the resources folder at this directory.
3. Sign with a Developer ID and run.

## Firefox install

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on".
3. Select `manifest.json` in this directory.
4. Reloads on every Firefox restart (use a self-signed XPI for
   persistence).

## What works today

- Manifest is loaded; service worker installs.
- Content script runs on `*.dir.ca.gov`, `*.fire.ca.gov`,
  `*.dot.ca.gov`, `*.cslb.ca.gov`.
- Popup shows the configured API URL and the form-element count on
  the active tab.

## What's NOT wired yet

- Auto-fill from YGE master profile.
- Session token / auth flow.
- CORS allow-list for `api.youngge.com` calls from the extension
  origin.
- Real icon PNGs (manifest references `icon-16.png` / `icon-48.png` /
  `icon-128.png` but they aren't included — Chrome shows the default
  icon until they're added).
