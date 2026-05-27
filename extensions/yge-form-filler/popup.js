// YGE Form Filler — popup script.
//
// Read the configured API base URL from storage + the latest
// page-scan field count from background. Renders both into the
// pre-existing #api-url and #field-count divs in popup.html.
//
// No interactions yet — the popup is read-only until the
// auto-fill flow ships.

(async function () {
  const stored = await chrome.storage.local.get('yge.apiBaseUrl');
  const apiUrlEl = document.getElementById('api-url');
  if (apiUrlEl) {
    apiUrlEl.textContent = stored['yge.apiBaseUrl'] ?? 'not configured';
  }

  // Ask the active tab's content script (if any) for its last
  // scan count. Falls back to "—" when the tab doesn't have a
  // content script (off-domain).
  const fieldCountEl = document.getElementById('field-count');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.querySelectorAll('input, textarea, select').length,
      });
      const count = result?.[0]?.result ?? 0;
      if (fieldCountEl) {
        fieldCountEl.textContent = `${count} form element(s)`;
      }
    }
  } catch (err) {
    if (fieldCountEl) {
      fieldCountEl.textContent = '— (not on a supported page)';
    }
  }
})();
