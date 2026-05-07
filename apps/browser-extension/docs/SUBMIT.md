# YGE Auto Form Filler — store submission runbook

Step-by-step for getting the extension into Chrome Web Store, Edge
Add-ons, Firefox AMO, and the Safari App Store. Order is by ease of
submission.

## 0. Build + package

```bash
pnpm --filter @yge/browser-extension build
pnpm --filter @yge/browser-extension exec node scripts/package.mjs
```

You'll get three zips under `dist/`:

```
dist/yge-extension-chrome-v0.1.0.zip
dist/yge-extension-edge-v0.1.0.zip
dist/yge-extension-firefox-v0.1.0.zip
```

## 1. Microsoft Edge Add-ons (FREE, 2–4 day review)

1. https://partner.microsoft.com/en-us/dashboard/microsoftedge
2. Sign in with your Microsoft account → **+ New extension**.
3. Drop in `yge-extension-edge-v0.1.0.zip`.
4. **Properties tab** — copy from `store/listing-copy.md`:
   - Display name, short / long description, category
5. **Store listing tab** — upload screenshots from `store/screenshots/`.
6. **Availability tab** — Public, all markets.
7. **Privacy & permissions** — paste the privacy URL (https://app.youngge.com/privacy)
8. **Submit for review.** Edge usually approves in 2–4 days.

## 2. Chrome Web Store ($5 one-time, 1–3 day review)

1. https://chrome.google.com/webstore/devconsole — pay the $5 if you
   haven't already.
2. **+ New item** → upload `yge-extension-chrome-v0.1.0.zip`.
3. Fill the same fields from `store/listing-copy.md`.
4. **Privacy practices** — answer all the prompts (we don't collect
   personally identifiable info; we read the master profile from
   the user's own YGE app).
5. **Submit for review.** Chrome's review is usually faster than Edge.

## 3. Mozilla Add-ons / AMO (FREE, automated review usually instant)

1. https://addons.mozilla.org/en-US/developers/ — sign in.
2. **Submit a New Add-on** → upload `yge-extension-firefox-v0.1.0.zip`.
3. AMO runs an automated linter. If it passes you're listed within
   minutes. If it fails, you'll get a list of warnings (often around
   `permissions` or `content_security_policy`) — fix and re-upload.
4. The same listing copy applies; just paste from `store/listing-copy.md`.

## 4. Safari (HARD, $99/yr Apple Developer + Xcode required)

Safari extensions need to be wrapped in a macOS app bundle and submitted
through App Store Connect.

1. Apple Developer Program enrollment ($99/yr) at developer.apple.com.
2. Open Xcode → File → New → Project → **Safari Web Extension App**.
3. When prompted, point at our `apps/browser-extension/` folder. Xcode
   wraps it into an `.xcodeproj` and an iOS / macOS host app shell.
4. Set the team (your enrolled Apple Developer team) on the app target.
5. Bundle identifier: `com.youngge.formfiller`.
6. **Product → Archive**, then **Distribute App → App Store Connect**.
7. In App Store Connect, fill in metadata identical to the other
   stores (`store/listing-copy.md`).
8. Submit for review. Safari is the slow one (5–10 days) and the
   most pedantic about screenshots + permissions justification.

## 5. Post-submission

After approval on each store:

- Add a "Get the extension" link to `/all-modules` in the YGE web app
  pointing at the live store URL.
- Bump `manifest.json` `version` for each subsequent submission.
- Keep a CHANGELOG entry per published version (you can paste from the
  per-bundle commit messages).

## Updating an existing extension

Same packaging flow, then upload as a new version on each store. Edge
+ Chrome auto-rollout to existing users; Firefox auto-rollouts on
review pass; Safari is again the slowest (one new TestFlight build per
update).
