# YGE Mobile App

React Native (Expo) app shipping to the **Apple App Store** and **Google
Play Store**. Bundle ID and Android package both `com.youngge.app`.

## Local development

```bash
# from repo root
pnpm install
pnpm --filter @yge/mobile dev
```

Then scan the QR code with the Expo Go app on your iPhone/Android, or
press `i` for iOS Simulator / `a` for Android emulator.

The app reads `extra.apiUrl` from `app.json` for the API base URL —
default `http://localhost:4000`. To point at the production API, edit
that field or set the `EXPO_PUBLIC_API_URL` env var (when we wire it up).

## Building for the stores

We use **EAS Build** — Expo's hosted iOS/Android build service.

### One-time setup (Ryan does this)

1. **Install the EAS CLI**:
   ```bash
   pnpm dlx eas-cli login
   ```
2. **Apple Developer account** — sign up at developer.apple.com ($99/yr).
   Create an App Store Connect record for "YGE" with bundle ID
   `com.youngge.app`. Note the App Store Connect App ID; paste it into
   `eas.json` → `submit.production.ios.ascAppId`.
3. **Google Play Developer account** — sign up at play.google.com/console
   ($25 one-time). Create an app entry; the package name is
   `com.youngge.app`.
4. **Generate signing keys**:
   ```bash
   eas credentials
   ```
   EAS walks you through Apple Push Notification, distribution, and
   Android keystore generation.

### Building

```bash
# preview build for internal testing (TestFlight / Play Internal track)
pnpm --filter @yge/mobile exec eas build --platform all --profile preview

# production build to submit to the stores
pnpm --filter @yge/mobile exec eas build --platform all --profile production
```

### Submitting to the stores

```bash
# After a production build finishes, submit:
pnpm --filter @yge/mobile exec eas submit --platform ios
pnpm --filter @yge/mobile exec eas submit --platform android
```

App Store review typically takes 24-48 hours. Play Store review for
the internal testing track is usually under an hour; production track
is also typically a few hours but can be 1-3 days.

## Bumping the version

When you ship an update:

1. Bump `expo.version` in `app.json` (e.g. `0.1.0` → `0.1.1`).
2. iOS `buildNumber` and Android `versionCode` increment automatically
   via EAS when `appVersionSource: 'remote'` is set in `eas.json`.

## What's in here

- `App.tsx` — bottom-tab navigator (Home / Jobs / Estimates / Me)
- `src/screens/` — one screen per tab
- `src/lib/api.ts` — fetch wrapper for the YGE API
- `src/lib/locale-store.ts` — AsyncStorage-backed locale persistence
- `src/lib/use-translator.ts` — translator hook (en / es)
- `assets/` — app icon + splash

The mobile app uses the same `@yge/shared` types and i18n dictionary
as the web app, so changes to project schemas / labels propagate
automatically.
