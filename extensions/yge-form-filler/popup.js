// YGE Form Filler — popup script.
//
// On open: read API URL from storage + active-tab's page-scan
// summary (window.YGE_LAST_SCAN stashed by the content script).
// Enable the "Fill matched fields" button when fillableCount > 0.
//
// Click: send 'fill-now' to the content script. Show the result.
//
// "edit" link opens an inline panel to override the API URL.
// Useful when pointing at a staging API or localhost.

const API_KEY = 'yge.apiBaseUrl';
const DEFAULT_API_URL = 'https://api.youngge.com';

(async function () {
  const apiUrlEl = document.getElementById('api-url');
  const apiUrlInput = document.getElementById('api-url-input');
  const apiUrlSave = document.getElementById('api-url-save');
  const apiUrlReset = document.getElementById('api-url-reset');
  const configToggle = document.getElementById('config-toggle');
  const configPanel = document.getElementById('config-panel');
  const fieldSummaryEl = document.getElementById('field-summary');
  const fillBtn = document.getElementById('fill-btn');
  const statusEl = document.getElementById('status');

  function appHostFromApi(url) {
    // api.youngge.com → app.youngge.com; localhost:4000 → localhost:3000
    try {
      const u = new URL(url);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return `${u.protocol}//${u.hostname}:3000`;
      }
      if (u.hostname.startsWith('api.')) {
        return `${u.protocol}//${u.hostname.replace(/^api\./, 'app.')}`;
      }
      return url;
    } catch {
      return 'https://app.youngge.com';
    }
  }

  async function refreshApiUrl() {
    const stored = await chrome.storage.local.get(API_KEY);
    const url = stored[API_KEY] ?? DEFAULT_API_URL;
    if (apiUrlEl) apiUrlEl.textContent = url;
    if (apiUrlInput) apiUrlInput.value = url;
    const appBase = appHostFromApi(url);
    const profileLink = document.getElementById('profile-link');
    if (profileLink) profileLink.href = `${appBase}/master-profile`;
    const formsLink = document.getElementById('forms-link');
    if (formsLink) formsLink.href = `${appBase}/pdf-forms`;
    return url;
  }

  await refreshApiUrl();

  // Fetch /api/version to show which deploy we're hitting +
  // which AI prompt version is active. Best-effort; silent on
  // failure (the API might be offline, on a stale deploy, etc.)
  async function refreshApiVersion() {
    const versionEl = document.getElementById('api-version');
    if (!versionEl) return;
    try {
      const stored = await chrome.storage.local.get(API_KEY);
      const base = stored[API_KEY] ?? DEFAULT_API_URL;
      const res = await fetch(`${base}/api/version`);
      if (!res.ok) {
        versionEl.textContent = `API ${res.status}`;
        return;
      }
      const json = await res.json();
      const sha = (json.buildSha ?? 'unknown').slice(0, 7);
      versionEl.textContent = `build ${sha} · prompt ${json.promptVersion ?? '?'}`;
    } catch {
      versionEl.textContent = 'API unreachable';
    }
  }

  // Fire-and-forget — don't block popup render on the version
  // round-trip.
  refreshApiVersion();

  async function refreshSnapshotAge() {
    const ageEl = document.getElementById('snapshot-age');
    if (!ageEl) return;
    const cache = await chrome.storage.local.get('yge.profileSnapshot.cachedAt');
    const cachedAt = cache['yge.profileSnapshot.cachedAt'];
    if (typeof cachedAt !== 'number') {
      ageEl.textContent = 'no snapshot cached yet';
      ageEl.style.color = '#9ca3af';
      return;
    }
    const ms = Date.now() - cachedAt;
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    // Human-readable age label. Lazy-fetch model (15-min TTL only
    // applies on next form-page visit), so age can grow large
    // between sessions — show days/hours/minutes appropriately.
    let label;
    if (secs < 60) label = `snapshot ${secs}s old`;
    else if (mins < 60) label = `snapshot ${mins}m old`;
    else if (hours < 24) label = `snapshot ${hours}h old`;
    else label = `snapshot ${days}d old`;
    ageEl.textContent = label;

    // Color hint — master profile rarely changes so we are
    // permissive: under a day is gray, a day to a week is amber,
    // a week+ is red and the user should explicitly refresh.
    if (days >= 7) ageEl.style.color = '#dc2626';
    else if (hours >= 24) ageEl.style.color = '#d97706';
    else ageEl.style.color = '#9ca3af';
  }

  await refreshSnapshotAge();

  document
    .getElementById('refresh-snapshot-btn')
    ?.addEventListener('click', async () => {
      await chrome.storage.local.remove([
        'yge.profileSnapshot',
        'yge.profileSnapshot.cachedAt',
      ]);
      if (statusEl) {
        statusEl.className = 'status ok';
        statusEl.textContent = '✓ Snapshot cache cleared. Next fill re-fetches.';
      }
      await refreshSnapshotAge();
    });

  configToggle?.addEventListener('click', () => {
    configPanel?.classList.toggle('open');
  });

  apiUrlSave?.addEventListener('click', async () => {
    const next = (apiUrlInput?.value ?? '').trim();
    if (next.length === 0) return;
    try {
      // Sanity-validate URL.
      new URL(next);
    } catch {
      if (statusEl) {
        statusEl.className = 'status err';
        statusEl.textContent = 'Invalid URL';
      }
      return;
    }
    await chrome.storage.local.set({ [API_KEY]: next });
    // Invalidate the cached profile snapshot so the next fill
    // call re-fetches against the new API.
    await chrome.storage.local.remove([
      'yge.profileSnapshot',
      'yge.profileSnapshot.cachedAt',
    ]);
    if (statusEl) {
      statusEl.className = 'status ok';
      statusEl.textContent = '✓ Saved. Snapshot cache cleared.';
    }
    await refreshApiUrl();
  });

  apiUrlReset?.addEventListener('click', async () => {
    await chrome.storage.local.set({ [API_KEY]: DEFAULT_API_URL });
    await chrome.storage.local.remove([
      'yge.profileSnapshot',
      'yge.profileSnapshot.cachedAt',
    ]);
    if (statusEl) {
      statusEl.className = 'status ok';
      statusEl.textContent = '✓ Reset to default.';
    }
    await refreshApiUrl();
  });

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
  const undoBtn = document.getElementById('undo-btn');

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
          if (undoBtn && reply.filled > 0) {
            undoBtn.style.display = 'block';
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

  // Show undo button if there's already a fill journal from a
  // previous popup open (filled in another popup session,
  // page wasn't navigated).
  if (undoBtn) {
    try {
      const journal = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (window.YGE_LAST_FILL ?? []).length,
      });
      if ((journal?.[0]?.result ?? 0) > 0) {
        undoBtn.style.display = 'block';
      }
    } catch {}
    undoBtn.addEventListener('click', async () => {
      undoBtn.disabled = true;
      try {
        const reply = await chrome.tabs.sendMessage(tab.id, {
          type: 'undo-last-fill',
        });
        if (reply && reply.ok) {
          if (statusEl) {
            statusEl.className = 'status ok';
            statusEl.textContent = `✓ Reverted ${reply.undone} field(s).`;
          }
          undoBtn.style.display = 'none';
          if (fillBtn) fillBtn.disabled = false;
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'status err';
          statusEl.textContent =
            'Undo failed: ' + (err instanceof Error ? err.message : 'unknown');
        }
        undoBtn.disabled = false;
      }
    });
  }
})();
