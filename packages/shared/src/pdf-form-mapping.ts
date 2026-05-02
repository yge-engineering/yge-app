// PDF form mapping — describes how a single agency PDF maps to the
// master profile.
//
// Plain English: every pre-mapped form (CAL FIRE-720, STD 204, IRS
// W-9, ACORD 25, county packets) is one of these. The mapping holds:
//   - Identity: agency, form name, version, source URL
//   - The PDF file's storage reference (where the byte stream lives)
//   - One row per fillable PDF field, with a recipe for how to fill
//     it: a master-profile path, a literal value, a computed
//     expression (date today, signer name lookup), or 'ask the user
//     inline' when the value isn't safe to derive from the profile
//
// Once a form is mapped, the filler is mechanical. The hard work is
// the mapping itself — for the agency forms YGE hits often, those
// mappings are seeded from a curated library; for one-off uploads
// the AI extracts a draft mapping that the user reviews.
//
// Phase 1: schema + helpers + the canonical agency-list. The filler
// runtime, the PDF byte rewriting, and the AI-drafted mapping flow
// land in subsequent commits.

import { z } from 'zod';

// ---- Agency taxonomy ----------------------------------------------------

export const PdfFormAgencySchema = z.enum([
  'CAL_FIRE',
  'CALTRANS',
  'CA_DGS',
  'CA_DIR',
  'CA_DOI',     // Department of Insurance
  'CA_DTSC',    // Toxic Substances Control
  'CA_OSHA',
  'CA_SOS',     // Secretary of State
  'CA_FTB',
  'COUNTY',
  'CITY',
  'IRS',
  'US_DOL',
  'ACORD',
  'CSLB',
  'YGE_INTERNAL', // YGE-issued forms (subcontractor packet, COI request, etc.)
  'OTHER',
]);
export type PdfFormAgency = z.infer<typeof PdfFormAgencySchema>;

// ---- Field source recipes -----------------------------------------------

/**
 * Each PDF field gets one of these recipes, telling the filler how
 * to produce the value at fill time.
 *
 *   profile-path   — copy from the master profile by dotted path
 *   literal        — hard-coded string the form always wants
 *   computed       — built-in function (date.today, hash.docSha)
 *   prompt         — ask the operator inline at fill time (used for
 *                    sensitive values like full SSN / account #s,
 *                    AND for per-bid values like project number)
 */
export const PdfFieldSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('profile-path'),
    /** Dotted path into MasterProfile, e.g. 'cslbLicense',
     *  'address.street', 'officers.president.name'. Resolved via
     *  resolveProfilePath(). */
    path: z.string().min(1).max(200),
    /** Optional fallback literal when the profile path resolves to
     *  null/undefined. */
    fallback: z.string().max(2000).optional(),
  }),
  z.object({
    kind: z.literal('literal'),
    value: z.string().max(2000),
  }),
  z.object({
    kind: z.literal('computed'),
    /** Whitelist of named computations the runtime knows about:
     *
     *   date.today        — yyyy-mm-dd at fill time
     *   date.today.us     — mm/dd/yyyy at fill time
     *   profile.address.oneLine — 'street, city, state zip'
     *   profile.officers.president.signature — typed name + title
     *   profile.officers.vp.signature        — typed name + title
     */
    name: z.string().min(1).max(80),
  }),
  z.object({
    kind: z.literal('prompt'),
    /** Display label for the inline prompt UI. */
    label: z.string().min(1).max(200),
    /** Helper text describing what the operator should fill in. */
    hint: z.string().max(2000).optional(),
    /** Whether the field is sensitive (SSN, full bank account)
     *  — drives the masked-input widget choice. */
    sensitive: z.boolean().default(false),
  }),
]);
export type PdfFieldSource = z.infer<typeof PdfFieldSourceSchema>;

// ---- Field mapping row --------------------------------------------------

export const PdfFormFieldKindSchema = z.enum([
  'TEXT',
  'CHECKBOX',
  'RADIO',
  'DROPDOWN',
  'SIGNATURE',
  'DATE',
]);
export type PdfFormFieldKind = z.infer<typeof PdfFormFieldKindSchema>;

export const PdfFormFieldMappingSchema = z.object({
  /** Internal stable id for the mapping row — separate from the
   *  PDF's own field name so a renamed PDF field doesn't break
   *  references that may point here from elsewhere. */
  id: z.string().min(1).max(80),
  /** The literal name as it appears in the PDF's AcroForm or
   *  XFA tree. The filler matches against this on fill. */
  pdfFieldName: z.string().min(1).max(200),
  /** Human label for the form-fill UI ('Contractor name', 'CSLB
   *  license #'). */
  label: z.string().min(1).max(200),
  kind: PdfFormFieldKindSchema,

  source: PdfFieldSourceSchema,

  /** Optional: when this field is required by the agency. Drives
   *  the 'these fields can't be blank' warning. */
  required: z.boolean().default(false),
  /** For CHECKBOX / RADIO / DROPDOWN, the value to write when
   *  source resolves truthy (e.g. 'Yes', 'X', 'true'). */
  truthyValue: z.string().max(80).optional(),
  /** Optional regex constraint enforced before fill — DOT number
   *  pattern, DIR registration pattern, ZIP pattern. */
  pattern: z.string().max(200).optional(),
});
export type PdfFormFieldMapping = z.infer<typeof PdfFormFieldMappingSchema>;

// ---- The form mapping row -----------------------------------------------

export const PdfFormMappingSchema = z.object({
  /** Stable id `pdf-form-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Display name on the form library list — 'CAL FIRE 720',
   *  'STD 204', 'ACORD 25 — Certificate of Liability Insurance'. */
  displayName: z.string().min(1).max(200),
  agency: PdfFormAgencySchema,
  /** Agency's official form number / code. */
  formCode: z.string().max(80).optional(),
  /** Agency's published version date (yyyy-mm-dd). DIR + IRS
   *  forms get revised every couple years. */
  versionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** Where the canonical PDF lives. The filler reads bytes from
   *  this reference at fill time. */
  pdfReference: z.string().min(1).max(800),
  /** Optional URL on the agency's website where this PDF is
   *  posted publicly. */
  agencyUrl: z.string().url().max(800).optional(),

  /** The field-by-field mapping. */
  fields: z.array(PdfFormFieldMappingSchema).min(1),

  /** Free-form notes — known quirks the filler should warn about. */
  notes: z.string().max(8000).optional(),

  /** Whether YGE has reviewed + accepted this mapping. Mappings
   *  drafted by the AI start `false`; an estimator flips to `true`
   *  after review. The filler refuses to auto-fill un-reviewed
   *  mappings; they show as 'draft' on the form library. */
  reviewed: z.boolean().default(false),
});
export type PdfFormMapping = z.infer<typeof PdfFormMappingSchema>;

// ---- Helpers ------------------------------------------------------------

export function newPdfFormMappingId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `pdf-form-${hex.padStart(8, '0')}`;
}

export function newPdfFormFieldId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `pdf-fld-${hex.padStart(8, '0')}`;
}

export interface PdfFormFieldsByKind {
  text: number;
  checkbox: number;
  radio: number;
  dropdown: number;
  signature: number;
  date: number;
}

export function summarizeFieldKinds(
  fields: PdfFormFieldMapping[],
): PdfFormFieldsByKind {
  const out: PdfFormFieldsByKind = {
    text: 0, checkbox: 0, radio: 0, dropdown: 0, signature: 0, date: 0,
  };
  for (const f of fields) {
    if (f.kind === 'TEXT') out.text += 1;
    else if (f.kind === 'CHECKBOX') out.checkbox += 1;
    else if (f.kind === 'RADIO') out.radio += 1;
    else if (f.kind === 'DROPDOWN') out.dropdown += 1;
    else if (f.kind === 'SIGNATURE') out.signature += 1;
    else if (f.kind === 'DATE') out.date += 1;
  }
  return out;
}

/**
 * Per-field gap analysis: how many fields the master profile can
 * fill alone, vs. how many will prompt the operator inline. Drives
 * the form-library tile that says 'auto-fills 18 of 22 fields;
 * you'll be asked for 4 inline'.
 */
export interface PdfFormFillability {
  total: number;
  /** Source kind = 'profile-path' or 'literal' or 'computed'. */
  autoFillCount: number;
  /** Source kind = 'prompt'. */
  promptCount: number;
  /** Sensitive prompts (SSN / full account number style). */
  sensitivePromptCount: number;
}

export function computeFillability(fields: PdfFormFieldMapping[]): PdfFormFillability {
  let autoFillCount = 0;
  let promptCount = 0;
  let sensitivePromptCount = 0;
  for (const f of fields) {
    if (f.source.kind === 'prompt') {
      promptCount += 1;
      if (f.source.sensitive) sensitivePromptCount += 1;
    } else {
      autoFillCount += 1;
    }
  }
  return {
    total: fields.length,
    autoFillCount,
    promptCount,
    sensitivePromptCount,
  };
}

export interface PdfFormLibraryRollup {
  total: number;
  byAgency: Array<{ agency: PdfFormAgency; count: number }>;
  reviewedCount: number;
  draftCount: number;
}

export function computeFormLibraryRollup(
  forms: PdfFormMapping[],
): PdfFormLibraryRollup {
  const byAgencyMap = new Map<PdfFormAgency, number>();
  let reviewedCount = 0;
  let draftCount = 0;
  for (const f of forms) {
    byAgencyMap.set(f.agency, (byAgencyMap.get(f.agency) ?? 0) + 1);
    if (f.reviewed) reviewedCount += 1;
    else draftCount += 1;
  }
  return {
    total: forms.length,
    byAgency: Array.from(byAgencyMap.entries())
      .map(([agency, count]) => ({ agency, count }))
      .sort((a, b) => b.count - a.count || a.agency.localeCompare(b.agency)),
    reviewedCount,
    draftCount,
  };
}
