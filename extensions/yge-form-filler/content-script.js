// YGE Form Filler — content script.
//
// Two responsibilities now:
//
//   1. On page load: scan + classify visible form fields,
//      pre-fetch the master-profile snapshot from background,
//      stash both on window.YGE_LAST_SCAN so the popup can
//      read the latest state synchronously.
//
//   2. On 'fill-now' message from popup: walk the classified
//      fillable fields, write each one with the snapshot
//      value, dispatch input + change events so React /
//      Angular / vanilla form validation re-runs.
//
// The fill loop never overwrites a field the user already
// typed into — readonly check + non-empty check guard against
// stepping on in-progress input.

(function () {
  if (typeof window === 'undefined' || !window.document) return;

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function inferLabel(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    if (el.id) {
      const explicit = document.querySelector(
        `label[for="${cssEscape(el.id)}"]`,
      );
      if (explicit && explicit.textContent) return explicit.textContent.trim();
    }
    let parent = el.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      if (parent.tagName === 'LABEL' && parent.textContent) {
        return parent.textContent.trim();
      }
      parent = parent.parentElement;
    }
    return '';
  }

  function scanFormFields() {
    const out = [];
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea, select',
    );
    inputs.forEach((el) => {
      if (el.disabled || el.readOnly) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      out.push({
        el,
        meta: {
          tag: el.tagName.toLowerCase(),
          type: el.type ?? null,
          name: el.name ?? '',
          id: el.id ?? '',
          ariaLabel: el.getAttribute('aria-label') ?? '',
          labelText: inferLabel(el),
        },
      });
    });
    return out;
  }

  function classifyAll(scanned) {
    if (typeof window.YGE_FIELD_PATTERNS !== 'object') return [];
    return scanned.map((s) => ({
      ...s,
      profilePath: window.YGE_FIELD_PATTERNS.classifyField(s.meta),
    }));
  }

  function writeValue(el, value) {
    // Skip empty values + fields the user already filled.
    if (typeof value !== 'string' || value.length === 0) return false;
    if (el.value && el.value.trim().length > 0) return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function fillAll(classified, snapshot) {
    const lookup = window.YGE_FIELD_PATTERNS?.lookupSnapshotValue;
    if (typeof lookup !== 'function') return { filled: 0, skipped: 0 };
    let filled = 0;
    let skipped = 0;
    for (const item of classified) {
      if (!item.profilePath) {
        skipped += 1;
        continue;
      }
      const value = lookup(snapshot, item.profilePath);
      if (writeValue(item.el, value)) filled += 1;
      else skipped += 1;
    }
    return { filled, skipped };
  }

  // ---- Bootstrap ----------------------------------------------------------

  const patternsUrl = chrome.runtime.getURL('field-patterns.js');
  fetch(patternsUrl)
    .then((r) => r.text())
    .then((src) => {
      // Bridge module exports → window global so the same module
      // is callable from a content-script context.
      const wrapped = src
        .replace(
          /^export const FIELD_PATTERNS/m,
          'window.YGE_FIELD_PATTERNS = window.YGE_FIELD_PATTERNS || {};\nwindow.YGE_FIELD_PATTERNS.FIELD_PATTERNS',
        )
        .replace(
          /^export function classifyField/m,
          'window.YGE_FIELD_PATTERNS.classifyField = function classifyField',
        );
      // eslint-disable-next-line no-eval
      eval(wrapped + '\n;');

      // The lookupSnapshotValue helper lives in the shared
      // package; since content scripts can't pull from
      // packages/shared, inline a copy here. (Single source of
      // truth still lives in extension-profile-snapshot.ts;
      // this is a hand port that the manifest team keeps in
      // sync — small enough to be cheap.)
      window.YGE_FIELD_PATTERNS.lookupSnapshotValue = function (
        snapshot,
        profilePath,
      ) {
        const map = {
          legalName: 'legalName',
          cslbLicense: 'cslbLicense',
          dirNumber: 'dirNumber',
          dotNumber: 'dotNumber',
          federalEin: 'federalEin',
          'address.street': 'addressStreet',
          'address.city': 'addressCity',
          'address.state': 'addressState',
          'address.zip': 'addressZip',
          primaryPhone: 'primaryPhone',
          primaryEmail: 'primaryEmail',
          'officers.president.name': 'presidentName',
          'officers.president.phone': 'presidentPhone',
          'officers.president.email': 'presidentEmail',
          'officers.vp.name': 'vpName',
          'officers.vp.phone': 'vpPhone',
          'officers.vp.email': 'vpEmail',
        };
        const key = map[profilePath];
        if (!key) return undefined;
        const v = snapshot && snapshot[key];
        if (typeof v !== 'string' || v.length === 0) return undefined;
        return v;
      };

      const scanned = scanFormFields();
      const classified = classifyAll(scanned);
      const fillable = classified.filter((f) => f.profilePath != null);

      // Stash for popup.js to read synchronously.
      window.YGE_LAST_SCAN = {
        url: window.location.href,
        fieldCount: scanned.length,
        fillableCount: fillable.length,
        scannedAt: new Date().toISOString(),
      };

      chrome.runtime
        .sendMessage({
          type: 'page-scan',
          url: window.location.href,
          fieldCount: scanned.length,
          fillableCount: fillable.length,
        })
        .catch(() => {});

      // Pre-fetch the snapshot so the fill round-trip is one
      // message away when the user clicks the popup button.
      chrome.runtime.sendMessage({ type: 'fetch-profile-snapshot' }).catch(() => {});

      console.log(
        '[yge-form-filler]',
        scanned.length,
        'fields,',
        fillable.length,
        'fillable.',
      );

      // Listen for the popup's fill-now message.
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === 'fill-now') {
          chrome.runtime
            .sendMessage({ type: 'fetch-profile-snapshot' })
            .then((reply) => {
              if (!reply || !reply.ok) {
                sendResponse({
                  ok: false,
                  error: reply?.error ?? 'no snapshot available',
                });
                return;
              }
              const result = fillAll(classified, reply.snapshot);
              sendResponse({ ok: true, ...result });
            })
            .catch((err) =>
              sendResponse({
                ok: false,
                error: err instanceof Error ? err.message : 'fetch failed',
              }),
            );
          return true;  // async response
        }
        return false;
      });
    })
    .catch((err) => {
      console.warn('[yge-form-filler] failed to load field patterns:', err);
    });
})();
