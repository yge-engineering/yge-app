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
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="checkbox"], input[type="radio"], input:not([type]), textarea, select',
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

  // Last-fill journal — stores the original (empty) value for
  // every field we wrote on the current page. Lets the popup
  // offer an "Undo last fill" affordance until the user
  // navigates away.
  window.YGE_LAST_FILL = window.YGE_LAST_FILL ?? [];

  function writeValue(el, value) {
    // Skip empty values + fields the user already filled.
    if (typeof value !== 'string' || value.length === 0) return false;
    if (el.value && el.value.trim().length > 0) return false;
    const prevValue = el.value;

    if (el.type === 'checkbox' || el.type === 'radio') {
      // For checkboxes / radios, only fill when the snapshot
      // value looks affirmative ('true', 'yes', '1', '✓'). Never
      // un-check something the user (or page default) had set.
      const wanted = value.toLowerCase().trim();
      const truthy = wanted === 'true' || wanted === 'yes' || wanted === '1' || wanted === 'on';
      if (!truthy) return false;
      if (el.checked) return false;  // already on, leave alone
      el.checked = true;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, prev: false };  // prev was false → undo unchecks
    }

    if (el.tagName === 'SELECT') {
      // For <select>, only set when one of the option values or
      // labels matches the snapshot value (case-insensitive). If
      // nothing matches, skip — never want to leave a select on
      // a value that doesn't correspond to a real option.
      const wanted = value.toLowerCase();
      let matchedOption = null;
      for (const opt of el.options) {
        const optValue = (opt.value ?? '').toLowerCase();
        const optText = (opt.textContent ?? '').toLowerCase().trim();
        if (optValue === wanted || optText === wanted) {
          matchedOption = opt;
          break;
        }
      }
      if (!matchedOption) {
        // Try a softer match: state codes ("CA") often render as
        // "California" in option text and vice versa.
        for (const opt of el.options) {
          const optText = (opt.textContent ?? '').toLowerCase().trim();
          if (optText.startsWith(wanted) || wanted.startsWith(optText)) {
            matchedOption = opt;
            break;
          }
        }
      }
      if (!matchedOption) return false;
      el.value = matchedOption.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, prev: prevValue };
    }

    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, prev: prevValue };
  }

  function fillAll(classified, snapshot) {
    const lookup = window.YGE_FIELD_PATTERNS?.lookupSnapshotValue;
    if (typeof lookup !== 'function') return { filled: 0, skipped: 0 };
    let filled = 0;
    let skipped = 0;
    const journal = [];
    for (const item of classified) {
      if (!item.profilePath) {
        skipped += 1;
        continue;
      }
      const value = lookup(snapshot, item.profilePath);
      const result = writeValue(item.el, value);
      if (result && result.ok) {
        filled += 1;
        journal.push({ el: item.el, prev: result.prev });
      } else {
        skipped += 1;
      }
    }
    // Append to existing journal so multiple fill clicks
    // accumulate; undo reverses the whole accumulated set.
    window.YGE_LAST_FILL = window.YGE_LAST_FILL.concat(journal);
    return { filled, skipped };
  }

  function undoLastFill() {
    const journal = window.YGE_LAST_FILL ?? [];
    let undone = 0;
    for (const entry of journal) {
      if (entry.el && entry.el.isConnected) {
        // Restore by type — checkboxes / radios get .checked
        // back, everything else gets .value.
        if (entry.el.type === 'checkbox' || entry.el.type === 'radio') {
          entry.el.checked = entry.prev === true;
        } else {
          entry.el.value = typeof entry.prev === 'string' ? entry.prev : '';
        }
        entry.el.dispatchEvent(new Event('input', { bubbles: true }));
        entry.el.dispatchEvent(new Event('change', { bubbles: true }));
        undone += 1;
      }
    }
    window.YGE_LAST_FILL = [];
    return { undone };
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
        // Mirror of PROFILE_PATH_TO_SNAPSHOT_KEY in
        // packages/shared/src/extension-profile-snapshot.ts. Keep
        // in sync when adding new field-patterns; bundle 2663
        // re-aligned this after bundle 2656 added classifier
        // patterns without updating the lookup map.
        const map = {
          legalName: 'legalName',
          shortName: 'shortName',
          cslbLicense: 'cslbLicense',
          cslbClassifications: 'cslbClassifications',
          dirNumber: 'dirNumber',
          dotNumber: 'dotNumber',
          federalEin: 'federalEin',
          naicsCodes: 'naicsCodes',
          pscCodes: 'pscCodes',
          caMcpNumber: 'caMcpNumber',
          caEntityNumber: 'caEntityNumber',
          websiteUrl: 'websiteUrl',
          'address.street': 'addressStreet',
          'address.city': 'addressCity',
          'address.state': 'addressState',
          'address.zip': 'addressZip',
          'address.county': 'addressCounty',
          primaryPhone: 'primaryPhone',
          primaryEmail: 'primaryEmail',
          'officers.president.name': 'presidentName',
          'officers.president.title': 'presidentTitle',
          'officers.president.phone': 'presidentPhone',
          'officers.president.email': 'presidentEmail',
          'officers.vp.name': 'vpName',
          'officers.vp.title': 'vpTitle',
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

      // Listen for popup messages: fill-now / undo-last-fill.
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === 'undo-last-fill') {
          const result = undoLastFill();
          sendResponse({ ok: true, ...result });
          return false;
        }
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
