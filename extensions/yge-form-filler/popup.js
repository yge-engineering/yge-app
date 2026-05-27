// YGE Form Filler — popup script.
//
// Read the configured API base URL from storage + the latest
// page-scan from the content script (via chrome.scripting on
// the active tab). Renders both into the pre-existing #api-url
// and #field-count divs in popup.html.

(async function () {
  const stored = await chrome.storage.local.get('yge.apiBaseUrl');
  const apiUrlEl = document.getElementById('api-url');
  if (apiUrlEl) {
    apiUrlEl.textContent = stored['yge.apiBaseUrl'] ?? 'not configured';
  }

  const fieldCountEl = document.getElementById('field-count');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id != null) {
      // Inject a tiny script that just reads the totals our
      // content script computed; falls back to a raw input
      // count when the content script hasn't run (off-domain).
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const inputs = document.querySelectorAll(
            'input, textarea, select',
          ).length;
          // Content script stashes its last scan summary on
          // window.YGE_LAST_SCAN when wiring this up in a follow-up.
          // For now just report raw count.
          return { inputs };
        },
      });
      const inputs = result?.[0]?.result?.inputs ?? 0;
      if (fieldCountEl) {
        fieldCountEl.textContent = `${inputs} form element(s) on this page`;
      }
    }
  } catch (err) {
    if (fieldCountEl) {
      fieldCountEl.textContent = '— (not on a supported page)';
    }
  }
})();
