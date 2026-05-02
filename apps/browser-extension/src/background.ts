// Service worker (background script). Handles the per-page
// inject + the 'open options' shortcut from the popup.
//
// Phase 1 keeps the worker thin — most logic lives in the content
// script + the popup. The worker exists mostly so chrome.runtime
// has a target for `getURL` + extension lifecycle hooks.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First-run: open the options page so the user can confirm
    // the API base URL.
    chrome.runtime.openOptionsPage();
  }
});
