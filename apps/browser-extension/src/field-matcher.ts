// Field-name matcher.
//
// Walks every <input> / <select> / <textarea> on the active page,
// matches each against a list of patterns derived from the master
// profile, and returns the planned fills. The popup approves +
// the content script applies. We never auto-fill without a click —
// silently dropping master-profile values into a page is the kind
// of thing that lands the extension in app store review forever.

import type { MasterProfile } from '@yge/shared';

export interface FieldMatch {
  /** Element id the content script will write back into via
   *  document.querySelector. */
  selector: string;
  /** Best-effort label for the popup ('CSLB License #', 'Phone'). */
  label: string;
  /** What the field would receive on apply. */
  proposedValue: string;
  /** Confidence 0..1 — derived from how many pattern signals lined up. */
  confidence: number;
  /** Why this match fired — one or more keywords matched, name regex,
   *  label proximity. Useful for the popup explanation row. */
  reasons: string[];
}

interface FieldRule {
  /** Profile path the matcher resolves against (passed through to the
   *  /api/master-profile body). */
  path: string;
  label: string;
  /** Lowercase substrings to look for in the field's name / id /
   *  placeholder / preceding label. */
  keywords: string[];
  /** Optional: when the field already has text, only fill if the
   *  text is empty / a placeholder. Defaults true. */
  emptyOnly?: boolean;
  /** Optional pattern the existing value must match before we'll
   *  consider it a 'placeholder' worth overwriting. */
  placeholderPattern?: RegExp;
}

const RULES: FieldRule[] = [
  { path: 'legalName', label: 'Legal name', keywords: ['legal', 'company', 'business name', 'firm name', 'contractor'] },
  { path: 'shortName', label: 'Short / DBA', keywords: ['dba', 'doing business as', 'short name'] },
  { path: 'cslbLicense', label: 'CSLB license #', keywords: ['cslb', 'license #', 'license no', 'lic #', 'contractor license'] },
  { path: 'dirNumber', label: 'DIR registration', keywords: ['dir', 'public works registration', 'dir reg'] },
  { path: 'dotNumber', label: 'DOT', keywords: ['dot', 'usdot'] },
  { path: 'caEntityNumber', label: 'CA SOS entity', keywords: ['secretary of state', 'sos entity', 'corporate id'] },
  { path: 'federalEin', label: 'Federal EIN', keywords: ['ein', 'federal tax id', 'taxpayer id', 'fein'] },
  { path: 'caEmployerAccountNumber', label: 'CA employer account', keywords: ['edd', 'sui', 'employer account'] },
  { path: 'address.street', label: 'Street', keywords: ['street', 'address line 1', 'address1', 'addr1'] },
  { path: 'address.street2', label: 'Suite / unit', keywords: ['suite', 'unit', 'address line 2', 'address2'] },
  { path: 'address.city', label: 'City', keywords: ['city', 'town'] },
  { path: 'address.state', label: 'State', keywords: ['state', 'province'] },
  { path: 'address.zip', label: 'ZIP', keywords: ['zip', 'postal'] },
  { path: 'primaryPhone', label: 'Phone', keywords: ['phone', 'tel', 'contact number'] },
  { path: 'primaryEmail', label: 'Email', keywords: ['email', 'e-mail'] },
  { path: 'websiteUrl', label: 'Website', keywords: ['website', 'url', 'company web'] },
  { path: 'naicsCodes', label: 'NAICS', keywords: ['naics'] },
  { path: 'pscCodes', label: 'PSC', keywords: ['psc', 'product service code'] },
];

/** Lowercased haystack for one element — id + name + placeholder + preceding label. */
function haystackFor(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const parts: string[] = [];
  if (el.id) parts.push(el.id);
  if (el.name) parts.push(el.name);
  if ('placeholder' in el && el.placeholder) parts.push(el.placeholder);
  // Preceding label[for=...]
  if (el.id) {
    const lbl = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
    if (lbl) parts.push(lbl.textContent ?? '');
  }
  // Wrapping label
  const parentLabel = el.closest('label');
  if (parentLabel) parts.push(parentLabel.textContent ?? '');
  // aria-label / aria-labelledby
  const aria = el.getAttribute('aria-label');
  if (aria) parts.push(aria);
  return parts.join(' | ').toLowerCase();
}

function cssEscape(id: string): string {
  // CSS.escape isn't on every old browser version we might run in;
  // fall back to a manual escape for the limited charset that
  // shows up in form ids.
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(id);
  return id.replace(/(["\\#.:>+~*^$|()\[\]{},])/g, '\\$1');
}

function uniqueSelector(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const name = (el as HTMLInputElement).name;
  if (name) return `${tag}[name="${cssEscape(name)}"]`;
  // Last resort — element index from DOM.
  const all = Array.from(document.querySelectorAll(tag));
  const idx = all.indexOf(el);
  return `${tag}:nth-of-type(${idx + 1})`;
}

function valueAt(profile: MasterProfile, path: string): string {
  // Inline a tiny subset of resolveProfilePath without pulling the
  // shared module into the content-script bundle. The patterns
  // we use here all hit single-level paths or address.X.
  const parts = path.split('.');
  let cursor: unknown = profile;
  for (const p of parts) {
    if (cursor == null) return '';
    if (Array.isArray(cursor)) return cursor.join(', ');
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[p];
      continue;
    }
    return '';
  }
  if (cursor == null) return '';
  if (typeof cursor === 'string') return cursor;
  if (typeof cursor === 'number' || typeof cursor === 'boolean') return String(cursor);
  if (Array.isArray(cursor)) return cursor.join(', ');
  return '';
}

export function findMatches(profile: MasterProfile): FieldMatch[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="password"]):not([type="hidden"]):not([type="file"]), select, textarea',
    ),
  );
  const matches: FieldMatch[] = [];

  for (const el of elements) {
    if ((el as HTMLInputElement).type === 'submit' || (el as HTMLInputElement).type === 'button') continue;
    if (el.disabled) continue;
    if ((el as HTMLInputElement | HTMLTextAreaElement).readOnly) continue;
    const haystack = haystackFor(el);
    if (haystack.length === 0) continue;

    // Find the best-matching rule for this element. Multiple rules
    // can fire on a single element only if the value strings happen
    // to be identical (fall back to highest-confidence rule).
    let best: { rule: FieldRule; reasons: string[]; confidence: number } | null = null;
    for (const rule of RULES) {
      const reasons: string[] = [];
      let hits = 0;
      for (const kw of rule.keywords) {
        if (haystack.includes(kw)) {
          reasons.push(`matched "${kw}"`);
          hits += 1;
        }
      }
      if (hits === 0) continue;
      const confidence = Math.min(0.4 + 0.2 * hits, 0.95);
      if (!best || confidence > best.confidence) {
        best = { rule, reasons, confidence };
      }
    }
    if (!best) continue;

    const value = valueAt(profile, best.rule.path);
    if (!value) continue;

    // Skip when the field already has a non-placeholder value and
    // emptyOnly is true (default).
    const emptyOnly = best.rule.emptyOnly ?? true;
    const existing = (el as HTMLInputElement).value ?? '';
    if (emptyOnly && existing.trim().length > 0) {
      const isPlaceholder = best.rule.placeholderPattern?.test(existing) ?? false;
      if (!isPlaceholder) continue;
    }

    matches.push({
      selector: uniqueSelector(el),
      label: best.rule.label,
      proposedValue: value,
      confidence: best.confidence,
      reasons: best.reasons,
    });
  }

  return matches;
}

/** Apply the planned fills to the page. Triggers an `input` event on
 *  each field so React + framework-driven forms pick up the change. */
export function applyMatches(matches: FieldMatch[]): { applied: number; missed: number } {
  let applied = 0;
  let missed = 0;
  for (const m of matches) {
    const el = document.querySelector(m.selector) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    if (!el) {
      missed += 1;
      continue;
    }
    if ('value' in el) {
      // The native setter is the only reliable way to set an input
      // value React's controlled inputs will accept.
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, m.proposedValue);
      else el.value = m.proposedValue;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      applied += 1;
    }
  }
  return { applied, missed };
}
