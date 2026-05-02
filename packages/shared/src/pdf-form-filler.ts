// PDF form filler — recipe-to-value computation.
//
// Plain English: given a PdfFormMapping and a MasterProfile, compute
// the literal string value that should land in each PDF field. The
// mapping describes WHERE each value comes from (profile path,
// literal, computed, or operator prompt); this module is the pure-
// data evaluator that produces the actual fill string.
//
// The PDF byte rewriting (loading the AcroForm tree, writing the
// values, flattening, embedding a signature image) lives in the
// API package — pdf-lib is server-side. This file is the
// runtime-portable half: same logic in the browser pre-fill
// preview, the server filler, and the future mobile shell.

import type { MasterProfile } from './master-profile';
import type {
  PdfFieldSource,
  PdfFormFieldMapping,
  PdfFormMapping,
} from './pdf-form-mapping';
import { resolveProfilePath } from './master-profile';

// ---- Computed-source registry -------------------------------------------

/**
 * Whitelist of named computations the filler knows how to produce.
 * Add new ones here when the form library needs them — keeping the
 * list explicit makes it obvious what the filler can produce
 * without deriving values from arbitrary code in the mapping.
 */
export const COMPUTED_SOURCES: ReadonlySet<string> = new Set([
  'date.today',
  'date.today.us',
  'profile.address.oneLine',
  'profile.officers.president.signature',
  'profile.officers.vp.signature',
  'profile.bidValidity.expiresOn',
]);

interface ComputedContext {
  profile: MasterProfile;
  /** ISO timestamp the fill is happening — captured once per
   *  fill so every `date.today` lands on the same calendar day. */
  now: Date;
  /** Optional bid context for date.expiresOn helpers. */
  bidValidityDays?: number;
}

function computeNamed(name: string, ctx: ComputedContext): string {
  switch (name) {
    case 'date.today':
      return ctx.now.toISOString().slice(0, 10);
    case 'date.today.us': {
      const y = ctx.now.getUTCFullYear();
      const m = String(ctx.now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(ctx.now.getUTCDate()).padStart(2, '0');
      return `${m}/${d}/${y}`;
    }
    case 'profile.address.oneLine': {
      const a = ctx.profile.address;
      const second = a.street2 ? `, ${a.street2}` : '';
      return `${a.street}${second}, ${a.city}, ${a.state} ${a.zip}`;
    }
    case 'profile.officers.president.signature':
    case 'profile.officers.vp.signature': {
      const role = name.endsWith('president.signature') ? 'president' : 'vp';
      const officer = ctx.profile.officers.find((o) => o.roleKey === role);
      if (!officer) return '';
      return `${officer.name}, ${officer.title}`;
    }
    case 'profile.bidValidity.expiresOn': {
      const days = ctx.bidValidityDays ?? 60;
      const d = new Date(ctx.now.getTime() + days * 24 * 60 * 60 * 1000);
      return d.toISOString().slice(0, 10);
    }
    default:
      return '';
  }
}

// ---- Value computation --------------------------------------------------

export interface FillContext {
  profile: MasterProfile;
  /** Operator-supplied answers for `prompt`-source fields, keyed by
   *  the field's stable `id` (NOT the pdfFieldName). */
  promptAnswers?: Record<string, string>;
  /** 'Now' for date computations. Defaults to the current wall clock. */
  now?: Date;
  /** Default bid validity window for `date.bidValidity.expiresOn` —
   *  most agencies expect 60 or 90 days; we default to 60. */
  bidValidityDays?: number;
}

export interface ComputedFieldValue {
  fieldId: string;
  pdfFieldName: string;
  /** Final string the PDF field receives. Empty string when the
   *  source resolves to nothing AND there's no fallback. */
  value: string;
  /** Whether the source produced a value vs. landed on the empty
   *  fallback. Drives the 'X fields are still blank' UI nag. */
  filled: boolean;
  /** True when this field needed a prompt and the operator hasn't
   *  answered yet. UI uses this to render the inline-prompt rows. */
  awaitingPrompt: boolean;
}

/**
 * Compute the value for a single field. Pure: no I/O, no PDF
 * manipulation. Returns `''` for an unfilled field instead of
 * throwing — the caller decides what to do (block submit on
 * required-but-empty, leave optional fields blank, etc.).
 */
export function computeFieldValue(
  field: PdfFormFieldMapping,
  ctx: FillContext,
): ComputedFieldValue {
  const profileCtx: ComputedContext = {
    profile: ctx.profile,
    now: ctx.now ?? new Date(),
    bidValidityDays: ctx.bidValidityDays,
  };
  const out = (value: string, filled: boolean, awaitingPrompt: boolean): ComputedFieldValue => ({
    fieldId: field.id,
    pdfFieldName: field.pdfFieldName,
    value,
    filled,
    awaitingPrompt,
  });

  return resolveSource(field, field.source, ctx, profileCtx, out);
}

function resolveSource(
  field: PdfFormFieldMapping,
  source: PdfFieldSource,
  ctx: FillContext,
  computeCtx: ComputedContext,
  out: (v: string, filled: boolean, awaiting: boolean) => ComputedFieldValue,
): ComputedFieldValue {
  switch (source.kind) {
    case 'profile-path': {
      const raw = resolveProfilePath(ctx.profile, source.path);
      const str = stringify(raw);
      if (str !== '') return out(str, true, false);
      if (source.fallback != null && source.fallback !== '') {
        return out(source.fallback, true, false);
      }
      return out('', false, false);
    }
    case 'literal':
      return out(source.value, source.value !== '', false);
    case 'computed': {
      const v = computeNamed(source.name, computeCtx);
      return out(v, v !== '', false);
    }
    case 'prompt': {
      const answer = ctx.promptAnswers?.[field.id];
      if (answer != null && answer !== '') return out(answer, true, false);
      return out('', false, true);
    }
  }
}

/**
 * Bulk compute every field in a mapping. Returns the list in the
 * same order the mapping lists them. Stable for re-renders.
 */
export function computeFillValues(
  mapping: PdfFormMapping,
  ctx: FillContext,
): ComputedFieldValue[] {
  return mapping.fields.map((f) => computeFieldValue(f, ctx));
}

// ---- Pre-fill report ----------------------------------------------------

export interface FillReport {
  total: number;
  filledCount: number;
  awaitingPromptCount: number;
  /** Required fields that produced no value — block submit on these. */
  requiredEmpty: ComputedFieldValue[];
  /** Sensitive prompts the operator still has to answer. */
  awaitingSensitivePrompts: ComputedFieldValue[];
  /** Pattern violations — the rendered value doesn't match the
   *  mapping's `pattern` regex. Forces the operator to fix
   *  before submit. */
  patternViolations: Array<{ field: ComputedFieldValue; pattern: string }>;
  /** Full per-field result list in mapping order. */
  values: ComputedFieldValue[];
}

export function buildFillReport(
  mapping: PdfFormMapping,
  ctx: FillContext,
): FillReport {
  const values = computeFillValues(mapping, ctx);
  const requiredEmpty: ComputedFieldValue[] = [];
  const awaitingSensitivePrompts: ComputedFieldValue[] = [];
  const patternViolations: FillReport['patternViolations'] = [];
  let filledCount = 0;
  let awaitingPromptCount = 0;

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]!;
    const f = mapping.fields[i]!;
    if (v.filled) filledCount += 1;
    if (v.awaitingPrompt) {
      awaitingPromptCount += 1;
      if (f.source.kind === 'prompt' && f.source.sensitive) {
        awaitingSensitivePrompts.push(v);
      }
    }
    if (f.required && !v.filled) requiredEmpty.push(v);
    if (f.pattern && v.value !== '') {
      try {
        const re = new RegExp(f.pattern);
        if (!re.test(v.value)) {
          patternViolations.push({ field: v, pattern: f.pattern });
        }
      } catch {
        // Bad regex in the mapping is an authoring bug, not a fill
        // failure. Skip silently here; the mapping editor surface
        // will validate patterns at save time.
      }
    }
  }

  return {
    total: values.length,
    filledCount,
    awaitingPromptCount,
    requiredEmpty,
    awaitingSensitivePrompts,
    patternViolations,
    values,
  };
}

// ---- Helpers ------------------------------------------------------------

function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(stringify).filter(Boolean).join(', ');
  return '';
}
