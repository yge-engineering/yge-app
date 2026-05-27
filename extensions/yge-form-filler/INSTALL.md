# YGE Form Filler — extension install

The YGE auto-fill browser extension (Manifest v3). Scans agency
bid forms and auto-fills recognized fields from the live YGE
master profile.

See also `/extension` in the web app for the same content rendered
in HTML.

## What it does today

- Scans every form on the current page and flags which fields it
  recognizes against the YGE master profile.
- On "Fill matched fields", writes the right values into name,
  CSLB license, DIR registration, USDOT, address (street/city/
  state/zip/county), phone, email, officer name/title/phone/email,
  NAICS, PSC, website URL, CA MCP, CA SOS entity #, and more.
- Supports text inputs, select dropdowns, checkboxes, and radio
  buttons. Undo reverses the last fill.
- Manifest allows `*.dir.ca.gov`, `*.fire.ca.gov`, `*.dot.ca.gov`,
  `*.cslb.ca.gov`, plus the seven NorCal county procurement
  domains (Shasta, Tehama, Glenn, Butte, Yuba, Sutter, Colusa).
- Popup shows: configured API URL · API build SHA + AI prompt
  version · snapshot age · how many master-profile fields are
  populated · last fill result · undo button · refresh-snapshot
  button · view-raw-snapshot debug link · deep-links to
  /master-profile and /pdf-forms.

## Chrome / Edge install (developer mode)

1. Open `chrome://extensions/`
2. Toggle "Developer mode" on (top-right).
3. Click "Load unpacked".
4. Select this directory:
   `~/Documents/Claude/Estimating Software/Estimating Software/yge-app/extensions/yge-form-filler/`
5. Pin the "YGE Form Filler" icon to the toolbar.

## Firefox install

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on".
3. Select `manifest.json` in this directory.
4. Reloads on every Firefox restart (use a self-signed XPI for
   persistence).

## Safari install (Xcode required)

Safari requires the extension to be wrapped in a macOS app shell:

1. Open Xcode → File → New → Project → Safari Extension App.
2. Point the resources folder at this directory.
3. Sign with a Developer ID and run.

## Configure

The popup's "edit" link overrides the API URL. Useful when
pointing at staging or localhost (`http://localhost:4000`).
"Reset" puts it back to the default `https://api.youngge.com`.

When you click "Refresh snapshot" the cache clears AND the
background re-fetches immediately so the next form fills with
the latest master-profile values.

## Troubleshooting

- **"API unreachable"** in red in the popup → the popup can't
  reach `/api/version`. Check the configured URL and that the
  API host is up. The web app's `/api-status` page surfaces
  every API route's health.
- **Field matched but didn't fill** → the master profile field
  is empty. Open `/master-profile` and check the extension-
  snapshot tile; it lists any empty fields.
- **"View raw snapshot JSON"** debug link opens
  `/api/extension/profile-snapshot` in a tab so you can eyeball
  exactly what the extension sees.
- **Stale snapshot** (an edit on the master profile isn't
  showing on a form) → click "Refresh snapshot" in the popup.

## Notes on icons

Manifest references `icon-16.png` / `icon-48.png` / `icon-128.png`
but they aren't bundled — Chrome shows the default puzzle-piece
icon until they're added. Cosmetic only; the extension works
without them.
