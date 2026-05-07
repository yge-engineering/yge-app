# Store listing copy — paste into each developer console

Re-use this verbatim. If a store rejects a section, edit it
**both here** and in the store form so future versions stay in sync.

## Display name
YGE Auto Form Filler

## Tagline / short description (max ~130 chars)
One-tap fills CSLB, DIR, DOT, NAICS, address, EIN into agency + vendor portals. Built for Caltrans BidExpress, Cal eProcure, county packets.

## Long description
**YGE Auto Form Filler** saves contractors the 5-minute manual ritual of typing the same identity fields (license number, DIR registration, DOT, NAICS, address, contact email) into every agency portal, vendor credit application, ACORD certificate request, and county purchasing form.

How it works:

1. Sign in to your YGE app at app.youngge.com (the master business profile lives there).
2. Open any portal you need to fill out — Caltrans BidExpress, Cal eProcure, Tehama County Purchasing, an ACORD COI request, a vendor's W-9 portal, anything.
3. Click the YGE icon in your toolbar → **Scan this page**. The extension walks every visible input, matches each one against your master-profile fields, and shows you a confidence-ranked list of proposed fills.
4. Untick anything you don't want filled (low-confidence matches are unticked by default), then click **Apply**. The extension writes the values and dispatches `input` + `change` events so React-based forms recognize them.

Designed for heavy-civil contractors but works for any business with the same boilerplate. Identity data lives in your YGE app — the extension never stores it locally beyond the active tab.

## Category
Productivity

## Permissions justification
- `activeTab` — only run on the page the user explicitly clicks the YGE icon from. We never read pages in the background.
- `scripting` — needed to inject the form-walker into the active tab on click.
- `storage` — caches your master-profile in `chrome.storage.session` so we don't re-fetch on every fill. Cleared when you sign out of the YGE app.

## Privacy policy URL
https://app.youngge.com/privacy

## Support URL
https://app.youngge.com/help

## Screenshots brief (1280×800 PNG)

1. **Hero** — popup open on a Caltrans BidExpress pre-qual page, with proposed fills highlighted.
2. **Confidence picker** — popup showing high/medium/low confidence matches with checkboxes.
3. **Apply result** — same form post-fill, with green banner "12 fields filled, 0 skipped."
4. **Master-profile source** — split-screen of the YGE master-profile page next to the popup (shows trust source).
5. **Multi-store install banner** — generic device-frame screenshot for the listing's main image.

Screenshots can be captured on the YGE staging URL once it's live.
