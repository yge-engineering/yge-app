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
  // Stub responder. The content script + popup can poke here
  // with { type: "ping" } today and get a sanity-check response.
  if (message && message.type === 'ping') {
    sendResponse({
      pong: true,
      installedAt: new Date().toISOString(),
      sender: sender.id ?? null,
    });
    return true;
  }
  return false;
});
