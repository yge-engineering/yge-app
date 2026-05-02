// Document vault — Phase 1 metadata-only store.
//
// The PDFs themselves don't live in the app yet; this module captures
// the *pointer* to the document (URL into Drive / SharePoint / Bluebeam
// Studio / a local Bluebeam path) plus enough metadata to find the
// right document later: kind, job linkage, tags.
//
// Why not store the file? Real file storage means deciding on S3 vs
// local disk vs object store, plus signed-url permissions, plus virus
// scanning, plus a UI for upload + preview. That's a Phase 4
// 'doc vault' module of its own. The metadata layer here is the
// scaffold those features bolt onto: every document already has an id
// and a kind tag, so when actual upload lands we just attach a real
// fileUrl to the existing record.
//
// What it solves today:
//   - 'Where's the spec for Sulphur Springs?' → /documents?jobId=...
//   - 'Where's our latest CSLB cert PDF?' → kind=CSLB_CERT
//   - 'What addenda came in on this job?' → kind=ADDENDUM + jobId

import { z } from 'zod';

/** What kind of document? Drives default tags + grouping in the list
 *  view. The set covers the documents YGE actually accumulates around
 *  a bid. */
export const DocumentKindSchema = z.enum([
  'RFP',
  'PLAN_SET',
  'SPEC',
  'ADDENDUM',
  'BID_FORM_BLANK',
  'BID_FORM_SIGNED',
  'COVER_LETTER',
  'BID_BOND',
  'CSLB_CERT',
  'DIR_CERT',
  'INSURANCE_CERT',
  'BUSINESS_LICENSE',
  'SITE_PHOTO',
  'CORRESPONDENCE',     // emails, RFI responses
  'CONTRACT',
  'CHANGE_ORDER',
  'INVOICE',
  'OTHER',
]);
export type DocumentKind = z.infer<typeof DocumentKindSchema>;

export const DocumentSchema = z.object({
  /** Stable id of the form `doc-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Display title. e.g. "Sulphur Springs Soquol Road — RFP rev B". */
  title: z.string().min(1).max(300),
  kind: DocumentKindSchema,
  /** Optional job linkage. Documents that aren't tied to a specific job
   *  (company-level certs, business licenses) leave this empty. */
  jobId: z.string().max(120).optional(),
  /** Free-form tags for additional filtering. Lowercase, trimmed by the
   *  UI. e.g. ["caltrans", "drainage", "rev-b"]. */
  tags: z.array(z.string().min(1).max(40)).default([]),

  /** Where the file actually lives. Free-form so it can be:
   *    - a public URL (https://agency.gov/.../bid.pdf)
   *    - a SharePoint / Drive deep link
   *    - a Bluebeam Studio session URL
   *    - a local path the user knows ("S:/YGE/...")
   *  When the real file-upload module ships, this becomes the canonical
   *  vault URL. */
  url: z.string().max(2_000).optional(),
  /** Page count, when known. Helpful in the list when filtering plan
   *  sets ('show me anything over 100 pages'). */
  pageCount: z.number().int().nonnegative().optional(),

  /** Date on the document itself, not the upload date. e.g. RFP issued
   *  date, addendum date, cert effective date. */
  documentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd')
    .optional(),

  /** Free-form notes — what's in the doc, what to look out for. */
  notes: z.string().max(10_000).optional(),

  // ---- Retention helpers -----------------------------------------
  // Optional fields the records-retention engine reads when the
  // document's kind has a specific statutory rule.

  /** Policy expiration / cert effective-end date for INSURANCE_CERT,
   *  CSLB_CERT, DIR_CERT, BUSINESS_LICENSE. Drives the
   *  POLICY_EXPIRATION trigger for the 7-year insurance retention
   *  window per Cal. Ins. Code §10508 / YGE policy. yyyy-mm-dd. */
  policyExpirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd')
    .optional(),

  /** Document is an I-9 (or I-9 supporting doc). When true, the
   *  retention rule applies (3 years past linkedEmployeeId's
   *  separation date per 8 CFR 274a.2(b)(2)(i)). */
  i9: z.boolean().optional(),

  /** Employee linkage for documents whose retention clock starts at
   *  EMPLOYEE_SEPARATION (I-9, training certs, personnel-file
   *  attachments). Empty for company-level docs. */
  linkedEmployeeId: z.string().max(120).optional(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentCreateSchema = DocumentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  tags: z.array(z.string().min(1).max(40)).optional(),
});
export type DocumentCreate = z.infer<typeof DocumentCreateSchema>;

export const DocumentPatchSchema = DocumentCreateSchema.partial();
export type DocumentPatch = z.infer<typeof DocumentPatchSchema>;

export function documentKindLabel(k: DocumentKind): string {
  switch (k) {
    case 'RFP': return 'RFP';
    case 'PLAN_SET': return 'Plan set';
    case 'SPEC': return 'Spec';
    case 'ADDENDUM': return 'Addendum';
    case 'BID_FORM_BLANK': return 'Bid form (blank)';
    case 'BID_FORM_SIGNED': return 'Bid form (signed)';
    case 'COVER_LETTER': return 'Cover letter';
    case 'BID_BOND': return 'Bid bond';
    case 'CSLB_CERT': return 'CSLB cert';
    case 'DIR_CERT': return 'DIR cert';
    case 'INSURANCE_CERT': return 'Insurance cert';
    case 'BUSINESS_LICENSE': return 'Business license';
    case 'SITE_PHOTO': return 'Site photo';
    case 'CORRESPONDENCE': return 'Correspondence';
    case 'CONTRACT': return 'Contract';
    case 'CHANGE_ORDER': return 'Change order';
    case 'INVOICE': return 'Invoice';
    case 'OTHER': return 'Other';
  }
}

/** Normalize a free-form tag input to lowercase + trimmed + dedup
 *  whitespace. */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
}

export function newDocumentId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `doc-${hex.padStart(8, '0')}`;
}

/** Document classes records-retention treats as 'insurance / cert'
 *  (the 7-year POLICY_EXPIRATION rule via Cal. Ins. Code §10508). */
const INSURANCE_LIKE_KINDS: ReadonlySet<DocumentKind> = new Set([
  'INSURANCE_CERT',
  'CSLB_CERT',
  'DIR_CERT',
  'BUSINESS_LICENSE',
]);

export function isI9Document(doc: Document): boolean {
  return doc.i9 === true || doc.tags.includes('i9');
}

export function isInsuranceLikeDocument(doc: Document): boolean {
  if (INSURANCE_LIKE_KINDS.has(doc.kind)) return true;
  if (doc.tags.includes('insurance-cert') || doc.tags.includes('acord-25')) return true;
  return false;
}

export interface DocumentRetentionMatch {
  /** 'I9' = 3-yr post-separation rule; 'INSURANCE' = 7-yr post-policy
   *  expiration rule. Other doc kinds return null (not yet covered
   *  by a CompanyDocument rule). */
  ruleKey: 'I9' | 'INSURANCE';
}

/**
 * Map a Document to its records-retention rule key. Returns null
 * when the document doesn't fall under any CompanyDocument rule
 * (correspondence, plain RFP, plan set, etc.).
 *
 * The records-retention-job uses this to decide whether the doc
 * contributes a candidate to the I-9 or insurance bucket.
 */
export function documentRetentionMatch(doc: Document): DocumentRetentionMatch | null {
  if (isI9Document(doc)) return { ruleKey: 'I9' };
  if (isInsuranceLikeDocument(doc)) return { ruleKey: 'INSURANCE' };
  return null;
}
