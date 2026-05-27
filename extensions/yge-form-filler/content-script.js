// YGE Form Filler — content script.
//
// Runs on agency form pages (dir.ca.gov, fire.ca.gov,
// dot.ca.gov, cslb.ca.gov). Today: scans the page for likely
// form fields and reports a count via chrome.runtime.sendMessage
// so the popup can show "I see N fields on this page."
//
// No auto-fill yet — that's the next bundle. The current goal
// is to prove the install / load / message-passing chain works
// without anything that could break a live agency form.

(function () {
  if (typeof window === 'undefined' || !window.document) return;

  function scanFormFields() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea, select',
    );
    const fields = [];
    inputs.forEach((el) => {
      // Skip hidden / disabled / already-filled fields.
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
        labelText,
      });
    });
    return fields;
  }

  function inferLabel(el) {
    // Try aria-label first, then a <label for=> match, then a parent
    // <label> wrap, then the nearest preceding label-ish text node.
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }
    if (el.id) {
      const explicit = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
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

  // Report what we see to the background so the popup can render
  // the count. No DOM mutation yet.
  const fields = scanFormFields();
  chrome.runtime.sendMessage({
    type: 'page-scan',
    url: window.location.href,
    fieldCount: fields.length,
    fields: fields.slice(0, 50),
  }).catch(() => {
    // Background worker might not be ready on first install — silent.
  });

  console.log('[yge-form-filler] content script saw', fields.length, 'fields.');
})();
