# YGE Mobile App

React Native (Expo) app for **Apple App Store** + **Google Play Store**.
Bundle ID and Android package: `com.youngge.app`.

## What's in here

- **Login** — email + password against `/api/login` (HMAC-signed token, 30-day expiry)
- **Home** — bid pipeline, win-rate, active bids list (live from API)
- **Jobs** — active job list sorted by bid-due urgency, status pills, tap to view detail
- **Estimates** — bid list with search + readiness pills, tap to view detail with line items
- **Me** — locale switcher (en/es), API environment toggle (dev/prod), sign-out

Detail screens are read-only for now. Edits happen in the web app.

## Local development

```bash
# from repo root
pnpm install
pnpm --filter @yge/mobile dev
```

Then either:
- Scan the QR code with **Expo Go** on your iPhone/Android (test on a real device)
- Press `i` for iOS Simulator (Mac only) — needs Xcode installed
- Press `a` for Android emulator — needs Android Studio installed

The app reads `extra.apiUrl` from `app.json` for the API base URL — default
`http://localhost:4000`. Inside the app, the **Me** tab lets you toggle
between `Dev (local)` and `Production` (`https://api.youngge.com`).

### Pointing at your local Mac from your iPhone

If you're testing on a real iPhone with the API running on your Mac, you'll
need the Mac's LAN IP (e.g. `192.168.1.50`) instead of `localhost`. Update
`extra.apiUrl` in `app.json` to `http://192.168.1.50:4000`. Both devices
must be on the same Wi-Fi.

## Building for the stores

We use **EAS Build** — Expo's hosted iOS/Android build service.

### One-time account setup (Ryan does this)

1. **Apple Developer account** — sign up at [developer.apple.com](https://developer.apple.com) ($99/yr).
2. **App Store Connect record** — create one for "YGE" with bundle ID `com.youngge.app`. Note the App Store Connect App ID.
3. **Google Play Developer account** — sign up at [play.google.com/console](https://play.google.com/console) ($25 one-time).
4. **Play Console app** — create one with package `com.youngge.app`.

### One-time CLI setup

```bash
# from repo root
pnpm dlx eas-cli login
# enter your Expo account credentials (free)

cd apps/mobile
pnpm dlx eas-cli build:configure
# walks you through Apple Push Notification + distribution + Android keystore generation
```

Edit `eas.json` and fill in the placeholders:
- `submit.production.ios.appleId` = your Apple ID email
- `submit.production.ios.ascAppId` = your App Store Connect app ID

### Builds

```bash
# from apps/mobile/
# preview build for internal testing (TestFlight / Play Internal track)
pnpm dlx eas-cli build --platform all --profile preview

# production build to submit to the stores
pnpm dlx eas-cli build --platform all --profile production
```

Each build runs in Expo's cloud and takes 10-30 min. You'll get a download
link for `.ipa` (iOS) and `.aab` (Android Bundle) files.

### Submitting

```bash
# After a production build finishes:
pnpm dlx eas-cli submit --platform ios
pnpm dlx eas-cli submit --platform android
```

**App Store** review usually takes 24-48 hours.
**Google Play** internal track is <1h; production track several hours to a few days.

### Setting the API URL on the production app

Before building production, update `app.json` → `extra.apiUrl` to `https://api.youngge.com`
(or wherever your prod API lives). Also set `MOBILE_TOKEN_SECRET` env var on
the API server (any random string ≥32 chars) — the API uses it to sign auth
tokens.

## Bumping the version

When you ship an update:
1. Bump `expo.version` in `app.json` (e.g. `0.1.0` → `0.1.1`).
2. iOS `buildNumber` and Android `versionCode` increment automatically when
   `appVersionSource: 'remote'` is set in `eas.json`.

## Architecture notes

- **Shared types**: imports from `@yge/shared` (Locale, dictionary, etc.) so
  changes to schemas / labels propagate from web to mobile automatically.
- **Auth**: HMAC-signed JWT-style token stored in AsyncStorage. No DB
  session — token expires after 30 days, user re-logs in.
- **API client**: `src/lib/api.ts` — fetch wrapper that injects
  `Authorization: Bearer <token>` on every request.
- **Persistence**: `@react-native-async-storage/async-storage` for locale,
  API base URL, auth token, user info.
- **Navigation**: `@react-navigation/bottom-tabs` for the 4 main tabs +
  `@react-navigation/native-stack` inside Jobs and Estimates tabs for
  list → detail navigation.

## Roadmap

Phase 2 (mobile-specific):
- [ ] Push notifications (Apple APNs + FCM)
- [ ] Offline read-cache for jobs + estimates
- [ ] Foreman screens: time card, daily report draft, photo capture
- [ ] Crew screens: clock in/out, PTO request
- [ ] Bid status switcher inline (currently web-only)
- [ ] Per-line edit support (currently read-only)
