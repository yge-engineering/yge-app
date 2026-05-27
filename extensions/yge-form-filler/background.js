// YGE Form Filler — background service worker (MV3).
//
// Today: stub. Receives messages from the content script and
// the popup, holds onto the API base URL + session token in
// chrome.storage.local. No actual fills yet — that wires up in
// a follow-up bundle when the /api/pdf-form-mappings endpoint
// is reachable from the extension origin (CORS allow-list).
//
// Eventual flow:
//   1. User opens an agency form page (e.g. dir.ca.gov apprentice form)
//   2. Content script identifies recognized fields
//   3. Sends a "fill request" message here
//   4. Background calls the YGE API for the matching mapping +
//      live master-profile values
//   5. Sends fill instructions back to the content script
//   6. Content script types the values into the form fields

/** Stored config keys. */
const STORAGE_KEYS = Object.freeze({
  apiBaseUrl: 'yge.apiBaseUrl',
  sessionToken: 'yge.sessionToken',
});

const DEFAULT_API_BASE_URL = 'https://api.youngge.com';

chrome.runtime.onInstalled.addListener(async () => {
  // First install — seed the default API URL if nothing's set.
  const existing = await chrome.storage.local.get(STORAGE_KEYS.apiBaseUrl);
  if (!existing[STORAGE_KEYS.apiBaseUrl]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.apiBaseUrl]: DEFAULT_API_BASE_URL,
    });
  }
  console.log('[yge-form-filler] background worker installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'ping') {
    sendResponse({
      pong: true,
      installedAt: new Date().toISOString(),
      sender: sender.id ?? null,
    });
    return true;
  }

  // Profile snapshot fetcher. Content script calls this on
  // page load. Cached in chrome.storage.local for 15 minutes so
  // back-to-back agency-form pages don't re-hit the API.
  if (message && message.type === 'fetch-profile-snapshot') {
    fetchProfileSnapshotCached()
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'unknown',
        }),
      );
    return true;  // signal async response
  }
  return false;
});

const SNAPSHOT_CACHE_KEY = 'yge.profileSnapshot';
const SNAPSHOT_CACHED_AT_KEY = 'yge.profileSnapshot.cachedAt';
const SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;

async function fetchProfileSnapshotCached() {
  const cache = await chrome.storage.local.get([
    SNAPSHOT_CACHE_KEY,
    SNAPSHOT_CACHED_AT_KEY,
    STORAGE_KEYS.apiBaseUrl,
  ]);
  const cachedAt = cache[SNAPSHOT_CACHED_AT_KEY];
  const cached = cache[SNAPSHOT_CACHE_KEY];
  if (
    cached &&
    typeof cachedAt === 'number' &&
    Date.now() - cachedAt < SNAPSHOT_MAX_AGE_MS
  ) {
    return cached;
  }
  const apiBase = cache[STORAGE_KEYS.apiBaseUrl] ?? DEFAULT_API_BASE_URL;
  const res = await fetch(`${apiBase}/api/extension/profile-snapshot`, {
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(`Snapshot fetch returned ${res.status}`);
  const snapshot = await res.json();
  await chrome.storage.local.set({
    [SNAPSHOT_CACHE_KEY]: snapshot,
    [SNAPSHOT_CACHED_AT_KEY]: Date.now(),
  });
  return snapshot;
}
