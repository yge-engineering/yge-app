// YGE Form Filler — content script.
//
// Runs on agency form pages (dir.ca.gov, fire.ca.gov,
// dot.ca.gov, cslb.ca.gov). Scans the DOM for visible form
// fields, classifies each one against the YGE master-profile
// pattern library (field-patterns.js), and reports the result
// to the background worker.
//
// What's new in bundle 2602: per-field classification. The
// scan no longer just counts fields; it tells you how many
// of those fields the extension knows how to fill from the
// master profile.

(function () {
  if (typeof window === 'undefined' || !window.document) return;

  function scanFormFields() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea, select',
    );
    const fields = [];
    inputs.forEach((el) => {
      // Skip hidden / disabled / already-filled.
      if (el.disabled) return;
      if (el.readOnly) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const labelText = inferLabel(el);
      fields.push({
        tag: el.tagName.toLowerCase(),
        type: el.type ?? null,
        name: el.name ?? '',
        id: el.id ?? '',
        ariaLabel: el.getAttribute('aria-label') ?? '',
        labelText,
      });
    });
    return fields;
  }

  function inferLabel(el) {
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }
    if (el.id) {
      const explicit = document.querySelector(
        `label[for="${cssEscape(el.id)}"]`,
      );
      if (explicit && explicit.textContent) {
        return explicit.textContent.trim();
      }
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

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  // Import field-patterns module (declared in manifest as
  // accessible via dynamic import — service worker style).
  // Using a plain script load instead of ES import keeps
  // Manifest v3 simple.
  function classifyAll(fields) {
    if (typeof window.YGE_FIELD_PATTERNS !== 'object') return [];
    const classified = [];
    for (const f of fields) {
      const profilePath = window.YGE_FIELD_PATTERNS.classifyField(f);
      classified.push({ ...f, profilePath });
    }
    return classified;
  }

  // Load field-patterns.js by URL — runtime-discovered via
  // chrome.runtime.getURL so it works regardless of where the
  // extension is installed from.
  const patternsUrl = chrome.runtime.getURL('field-patterns.js');
  fetch(patternsUrl)
    .then((r) => r.text())
    .then((src) => {
      // Bridge ES module to window global so the same module is
      // usable from a content-script context (which doesn't
      // support module-mode script tags by default).
      const wrapped = src.replace(
        /^export const FIELD_PATTERNS/m,
        'window.YGE_FIELD_PATTERNS = window.YGE_FIELD_PATTERNS || {};\nwindow.YGE_FIELD_PATTERNS.FIELD_PATTERNS',
      ).replace(
        /^export function classifyField/m,
        'window.YGE_FIELD_PATTERNS.classifyField = function classifyField',
      );
      // eslint-disable-next-line no-eval
      eval(wrapped + '\n;');

      const fields = scanFormFields();
      const classified = classifyAll(fields);
      const fillable = classified.filter((f) => f.profilePath != null);

      chrome.runtime
        .sendMessage({
          type: 'page-scan',
          url: window.location.href,
          fieldCount: fields.length,
          fillableCount: fillable.length,
          fillableFields: fillable.slice(0, 50),
        })
        .catch(() => {
          // Background worker not ready on first install — silent.
        });

      console.log(
        '[yge-form-filler] content script saw',
        fields.length,
        'fields,',
        fillable.length,
        'fillable from master profile.',
      );
    })
    .catch((err) => {
      console.warn('[yge-form-filler] failed to load field patterns:', err);
    });
})();
