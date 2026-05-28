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

// Render an ISO timestamp as a short human-relative phrase like
// "5m ago" / "3h ago" / "2d ago". Used to show API deploy age
// next to the build SHA so Ryan can verify the popup is hitting
// a freshly-deployed API without doing ISO timestamp math.
//
// Returns null for unparseable / missing / 'unknown' input so
// the caller can decide whether to render anything at all.
function deployAge(iso) {
  if (!iso || iso === 'unknown') return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  if (diffMs < 60_000) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

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
    // Debug deep-link straight at the API so the user can eyeball
    // exactly what the extension is fetching.
    const snapshotLink = document.getElementById('snapshot-link');
    if (snapshotLink) snapshotLink.href = `${url}/api/extension/profile-snapshot`;
    // Build + version diagnostic page. Pairs with the build SHA +
    // deploy age inline above — popup gives the quick answer, the
    // /admin/version page gives the full Web+API breakdown.
    const versionLink = document.getElementById('version-link');
    if (versionLink) versionLink.href = `${appBase}/admin/version`;
    return url;
  }

  await refreshApiUrl();

  // Fetch /api/version to show which deploy we're hitting +
  // which AI prompt version is active. The text + color flips
  // to red on any failure (HTTP non-OK or network error) so
  // Ryan notices when the popup is pointing at a dead API
  // (wrong URL configured, host down, CORS regression).
  async function refreshApiVersion() {
    const versionEl = document.getElementById('api-version');
    if (!versionEl) return;
    try {
      const stored = await chrome.storage.local.get(API_KEY);
      const base = stored[API_KEY] ?? DEFAULT_API_URL;
      const res = await fetch(`${base}/api/version`);
      if (!res.ok) {
        versionEl.textContent = `API ${res.status} — check URL`;
        versionEl.style.color = '#dc2626';
        return;
      }
      const json = await res.json();
      const sha = (json.buildSha ?? 'unknown').slice(0, 7);
      const age = deployAge(json.buildTimestamp);
      const ageSuffix = age ? ` (${age})` : '';
      versionEl.textContent = `build ${sha}${ageSuffix} · prompt ${json.promptVersion ?? '?'}`;
      versionEl.style.color = '#6b7280';
    } catch {
      versionEl.textContent = 'API unreachable';
      versionEl.style.color = '#dc2626';
    }
  }

  // Fire-and-forget — don't block popup render on the version
  // round-trip.
  refreshApiVersion();

  // Surface "X / Y fields populated" from the cached snapshot so
  // Ryan can see at a glance whether the master profile data is
  // complete from the extension's point of view. Mirrors the
  // ExtensionSnapshotStatusTile that lives on /master-profile et al.
  async function refreshSnapshotStatus() {
    const el = document.getElementById('snapshot-status');
    if (!el) return;
    const cache = await chrome.storage.local.get('yge.profileSnapshot');
    const snapshot = cache['yge.profileSnapshot'];
    if (!snapshot || typeof snapshot !== 'object') {
      el.textContent = '';
      return;
    }
    const NON_FILL_FIELDS = new Set(['schemaVersion', 'generatedAt']);
    const entries = Object.entries(snapshot).filter(
      ([k]) => !NON_FILL_FIELDS.has(k),
    );
    const populated = entries.filter(
      ([, v]) => typeof v === 'string' && v.length > 0,
    ).length;
    const total = entries.length;
    const empty = total - populated;
    el.textContent = `snapshot ${populated}/${total} populated`;
    if (empty === 0) el.style.color = '#065f46';
    else if (empty <= 3) el.style.color = '#6b7280';
    else el.style.color = '#d97706';
  }

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
  await refreshSnapshotStatus();

  document
    .getElementById('refresh-snapshot-btn')
    ?.addEventListener('click', async () => {
      // Clear cache first so the background fetch goes to the
      // network instead of returning the old cached snapshot.
      await chrome.storage.local.remove([
        'yge.profileSnapshot',
        'yge.profileSnapshot.cachedAt',
      ]);
      if (statusEl) {
        statusEl.className = 'status ok';
        statusEl.textContent = 'Refreshing…';
      }
      // Proactively re-fetch instead of waiting for the next
      // form-page visit. Background handles the API URL +
      // updates the cache.
      try {
        const reply = await chrome.runtime.sendMessage({
          type: 'fetch-profile-snapshot',
        });
        if (reply && reply.ok) {
          if (statusEl) {
            statusEl.className = 'status ok';
            statusEl.textContent = '✓ Snapshot refreshed from API.';
          }
        } else {
          if (statusEl) {
            statusEl.className = 'status err';
            statusEl.textContent =
              'Refresh failed: ' + (reply?.error ?? 'no response');
          }
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'status err';
          statusEl.textContent =
            'Refresh failed: ' +
            (err instanceof Error ? err.message : 'unknown');
        }
      }
      await refreshSnapshotAge();
      await refreshSnapshotStatus();
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
