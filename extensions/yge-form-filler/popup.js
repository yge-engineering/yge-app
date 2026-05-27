// YGE Form Filler — popup script.
//
// On open: read API URL from storage + ask the active tab's
// content script for its YGE_LAST_SCAN summary. Enable the
// "Fill matched fields" button when fillableCount > 0.
//
// Click: send 'fill-now' to the content script. Show the
// result (N fields filled, M skipped) in the status area.

(async function () {
  const apiUrlEl = document.getElementById('api-url');
  const fieldSummaryEl = document.getElementById('field-summary');
  const fillBtn = document.getElementById('fill-btn');
  const statusEl = document.getElementById('status');

  const stored = await chrome.storage.local.get('yge.apiBaseUrl');
  if (apiUrlEl) {
    apiUrlEl.textContent = stored['yge.apiBaseUrl'] ?? 'not configured';
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) {
    if (fieldSummaryEl) fieldSummaryEl.textContent = 'no active tab';
    return;
  }

  // Read content-script scan summary via in-page eval.
  let scan = null;
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.YGE_LAST_SCAN ?? null,
    });
    scan = result?.[0]?.result ?? null;
  } catch (err) {
    // Tab might be on a non-allowlisted page (chrome://, about:).
  }

  if (!scan) {
    if (fieldSummaryEl) {
      fieldSummaryEl.textContent = '— (no scan yet — load an agency form page)';
    }
    return;
  }

  if (fieldSummaryEl) {
    fieldSummaryEl.textContent =
      `${scan.fieldCount} form element(s)\n${scan.fillableCount} fillable from master profile`;
  }
  if (fillBtn && scan.fillableCount > 0) {
    fillBtn.disabled = false;
    fillBtn.addEventListener('click', async () => {
      fillBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Filling…';
      try {
        const reply = await chrome.tabs.sendMessage(tab.id, { type: 'fill-now' });
        if (reply && reply.ok) {
          if (statusEl) {
            statusEl.className = 'status ok';
            statusEl.textContent = `✓ Filled ${reply.filled} field(s), skipped ${reply.skipped}.`;
          }
        } else {
          if (statusEl) {
            statusEl.className = 'status err';
            statusEl.textContent = `Failed: ${reply?.error ?? 'no response'}`;
          }
          fillBtn.disabled = false;
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'status err';
          statusEl.textContent =
            'Failed: ' + (err instanceof Error ? err.message : 'unknown');
        }
        fillBtn.disabled = false;
      }
    });
  }
})();
