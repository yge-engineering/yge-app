// Electronic signature record — ESIGN / UETA compliant.
//
// Plain English: a signature is a row in a vault that says "this
// person signed this document at this time, and here is the proof."
// The proof bundle is what makes a signed PDF stand up in court the
// same way a wet-ink signature would, and it is what the federal ESIGN
// Act and California's UETA both require.
//
// What "compliant" means in concrete terms (15 USC §7001 + Cal. Civ.
// Code §§1633.1-1633.17):
//
//   1. Intent to sign — the signer affirmatively chose to sign (a
//      separate Sign button, not a passive "by continuing you agree").
//   2. Consent to do business electronically — captured once per
//      signer per document.
//   3. Association with the record — the signature is bound to the
//      document hash, not stored as a free-floating image.
//   4. Attribution — proof that the signer is who they claim to be
//      (auth method + signing-session identifier).
//   5. Record retention — the signed record AND the audit trail of
//      how it was signed are kept together, immutable, for the life
//      of the document.
//
// This module is the canonical shape for that proof bundle. Capturing
// these fields wrong is the difference between a contract that holds
// and a contract that gets thrown out at trial — keep this strict.
//
// Persistence (file-store + Prisma) and the inline-PDF signing UI land
// in subsequent commits. This module is the data model + helpers.

import { z } from 'zod';

// ---- Enums ---------------------------------------------------------------

/**
 * What kind of document was signed. Drives downstream routing — a
 * signed lien waiver hits AR; a signed bid acceptance flips the job
 * status; a signed handbook ack lands in the employee binder.
 */
export const SignatureDocumentTypeSchema = z.enum([
  'BID_ACCEPTANCE',
  'BID_COVER_LETTER',
  'CHANGE_ORDER',
  'CONTRACT',
  'PAY_APPLICATION',
  'LIEN_WAIVER',
  'SUBCONTRACT',
  'SUB_ATTESTATION',
  'COI_ATTESTATION',
  'W4',
  'W9',
  'I9',
  'DIRECT_DEPOSIT',
  'EMPLOYEE_HANDBOOK',
  'SAFETY_ORIENTATION',
  'IIPP_ACKNOWLEDGMENT',
  'CPR_CERTIFICATION',
  'AGENCY_FORM',
  'OTHER',
]);
export type SignatureDocumentType = z.infer<typeof SignatureDocumentTypeSchema>;

/** How the signer proved they meant to sign. */
export const SignatureMethodSchema = z.enum([
  'TYPED',         // typed-name + checkbox affirmation
  'DRAWN',         // finger / stylus / mouse-drawn signature image
  'CLICK_TO_SIGN', // click + biometric / password re-auth
  'BIOMETRIC',     // Face ID / Touch ID / fingerprint at signing
  'WET_INK_SCAN',  // signed paper, scanned + uploaded — UETA-compliant when attribution is captured separately
]);
export type SignatureMethod = z.infer<typeof SignatureMethodSchema>;

/** How the signer's identity was authenticated at signing time. */
export const SignerAuthMethodSchema = z.enum([
  'EMAIL_OTP',
  'SMS_OTP',
  'MAGIC_LINK',
  'PASSWORD',
  'BIOMETRIC',
  'SSO',
  'IN_PERSON',
]);
export type SignerAuthMethod = z.infer<typeof SignerAuthMethodSchema>;

/** Status of the signing event. */
export const SignatureStatusSchema = z.enum([
  'DRAFT',     // signing flow started, signature not yet captured
  'SIGNED',    // signature captured, document hash bound
  'VOIDED',    // signature voided (document edited after, or party withdrew); MUST keep the row
  'EXPIRED',   // signing link expired before signing
  'DECLINED',  // signer affirmatively declined
]);
export type SignatureStatus = z.infer<typeof SignatureStatusSchema>;

// ---- Sub-shapes ----------------------------------------------------------

/**
 * The document being signed, identified by content hash so the
 * signature is bound to the bytes — not to a filename or row id that
 * could later be edited.
 */
export const SignedDocumentRefSchema = z.object({
  /** SHA-256 hex of the PDF bytes at signing time. Lowercase, 64 chars. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex chars'),
  /** Bytes signed (informational; the hash is authoritative). */
  byteLength: z.number().int().positive(),
  /** Document type drives routing + retention rules. */
  documentType: SignatureDocumentTypeSchema,
  /** Free-form display name shown on the certificate. */
  displayName: z.string().min(1).max(300),
  /** Optional storage reference — S3 key, Supabase storage path, drive
   *  path, etc. The hash is the source of truth; this is just where
   *  to find the bytes. */
  reference: z.string().max(800).optional(),

  /** Optional foreign-key style hooks so the signature appears in the
   *  related record's binder. */
  jobId: z.string().max(120).optional(),
  estimateId: z.string().max(120).optional(),
  changeOrderId: z.string().max(120).optional(),
  arInvoiceId: z.string().max(120).optional(),
  lienWaiverId: z.string().max(120).optional(),
  subcontractorId: z.string().max(120).optional(),
  employeeId: z.string().max(120).optional(),
});
export type SignedDocumentRef = z.infer<typeof SignedDocumentRefSchema>;

/** Identity the signer claimed at signing time. */
export const SignerSchema = z.object({
  /** Internal user/employee/sub id when the signer has an account. */
  userId: z.string().max(120).optional(),
  employeeId: z.string().max(120).optional(),
  subcontractorId: z.string().max(120).optional(),
  /** Display name as it appears on the signature certificate. */
  name: z.string().min(1).max(200),
  /** Email used for the signing notice + OTP. */
  email: z.string().email().max(254),
  /** Title / role on this signing — 'VP, YGE', 'Project Manager,
   *  CAL FIRE Region 2', 'Subcontractor'. Free-form. */
  title: z.string().max(200).optional(),
});
export type Signer = z.infer<typeof SignerSchema>;

/** Audit context captured at signing time. */
export const SignatureAuditContextSchema = z.object({
  /** Auth method used to confirm identity at signing. */
  authMethod: SignerAuthMethodSchema,
  /** IP address that submitted the signature. */
  ipAddress: z.string().max(64).optional(),
  /** User-agent string at signing. */
  userAgent: z.string().max(500).optional(),
  /** Device id (PWA / mobile install) if available. */
  deviceId: z.string().max(120).optional(),
  /** Geo coords from the browser/device, if granted. */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  /** Session id from the auth provider. */
  sessionId: z.string().max(200).optional(),
  /** OTP / magic-link token id (NOT the secret) for trace-back. */
  authChallengeId: z.string().max(200).optional(),
  /** ISO timestamp the auth was completed (ESIGN attribution proof). */
  authenticatedAt: z.string().optional(),
});
export type SignatureAuditContext = z.infer<typeof SignatureAuditContextSchema>;

// ---- The signature row ---------------------------------------------------

export const SignatureSchema = z.object({
  /** Stable id of the form `sig-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Tenant scope. */
  companyId: z.string().min(1).max(120),

  status: SignatureStatusSchema.default('DRAFT'),
  method: SignatureMethodSchema,

  document: SignedDocumentRefSchema,
  signer: SignerSchema,
  auditContext: SignatureAuditContextSchema,

  /**
   * Affirmative consent record. ESIGN §7001(c)(1) requires the signer
   * to have agreed to do business electronically and to have received
   * the disclosures. Capture exactly what they saw and clicked.
   */
  consent: z.object({
    agreedAt: z.string(),
    /** Hash of the consent disclosure text the signer was shown. */
    disclosureSha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** Free-form copy of the affirmation language ('I have read…'). */
    affirmationText: z.string().min(1).max(4000),
  }),

  /**
   * Captured signature image. Optional because TYPED + CLICK_TO_SIGN
   * methods produce no image — the typed name + audit context is the
   * proof. When present, it is a PNG data URL written by the signing
   * canvas.
   */
  signatureImage: z.object({
    /** `image/png` data URL. */
    dataUrl: z.string().regex(/^data:image\/png;base64,/),
    /** Width / height in CSS pixels at capture. */
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
  }).optional(),

  /** ISO timestamp the signature itself was captured (separate from
   *  consent + auth — those happen earlier in the flow). */
  signedAt: z.string().optional(),

  /** When voided, why + by whom. Required on `VOIDED`. */
  voidedAt: z.string().optional(),
  voidedReason: z.string().max(2000).optional(),
  voidedByUserId: z.string().max(120).optional(),

  /**
   * Hash of the FLATTENED PDF bytes, after the signature certificate
   * has been embedded. This is what gets archived; it is what an
   * auditor verifies the signed copy against.
   */
  flattenedSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),

  /** Storage reference for the flattened+certified PDF bundle. */
  flattenedReference: z.string().max(800).optional(),
});
export type Signature = z.infer<typeof SignatureSchema>;

export const SignatureCreateSchema = SignatureSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: SignatureStatusSchema.optional(),
});
export type SignatureCreate = z.infer<typeof SignatureCreateSchema>;

// ---- Helpers -------------------------------------------------------------

export function newSignatureId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `sig-${hex.padStart(8, '0')}`;
}

/**
 * SHA-256 of a UTF-8 string. Tiny pure-JS impl (no Node Buffer / no
 * Web Crypto) so this works in every runtime — server, browser PWA,
 * mobile shell. Used for hashing affirmation/disclosure text.
 *
 * For larger PDF byte buffers (multi-MB) the API edge should use
 * Node's crypto.createHash('sha256') instead. This helper exists so
 * tests and small-string hashing work without extra wiring.
 */
export async function sha256Hex(input: string): Promise<string> {
  // Prefer Web Crypto when available (browser + Node 19+).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const buf = await g.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: Node crypto (loaded dynamically so the browser bundle
  // doesn't trip on the import). The dynamic specifier is hidden
  // from TS's static checker so consumers without @types/node
  // (like the browser extension) still typecheck.
  const nodeCryptoSpecifier = 'node:' + 'crypto';
  const nodeCrypto = (await import(/* @vite-ignore */ nodeCryptoSpecifier)) as {
    createHash: (algorithm: string) => {
      update: (data: string, encoding?: string) => {
        digest: (encoding: string) => string;
      };
    };
  };
  return nodeCrypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Whether a signature row is legally binding right now. Convenience
 * for "can the agency rely on this?" checks at the API edge.
 */
export function isLegallyBinding(s: Signature): boolean {
  if (s.status !== 'SIGNED') return false;
  if (!s.signedAt) return false;
  if (!s.consent.agreedAt) return false;
  if (!s.auditContext.authenticatedAt) return false;
  if (!s.flattenedSha256) return false;
  return true;
}

/**
 * Quick reasons WHY a signature isn't binding yet — for the
 * 'Almost done — fix these before sending' UI.
 */
export function bindingGaps(s: Signature): string[] {
  const gaps: string[] = [];
  if (s.status !== 'SIGNED') gaps.push(`status is ${s.status}, not SIGNED`);
  if (!s.signedAt) gaps.push('signedAt timestamp missing');
  if (!s.consent.agreedAt) gaps.push('signer never affirmed consent');
  if (!s.auditContext.authenticatedAt) gaps.push('signer was never authenticated');
  if (!s.flattenedSha256) gaps.push('flattened PDF was never generated');
  return gaps;
}

export interface SignatureRollup {
  total: number;
  byStatus: Record<SignatureStatus, number>;
  byDocumentType: Array<{ type: SignatureDocumentType; count: number }>;
  /** Most-recent signedAt across the set. */
  lastSignedAt: string | null;
  /** Number of rows that pass `isLegallyBinding`. */
  bindingCount: number;
}

export function computeSignatureRollup(rows: Signature[]): SignatureRollup {
  const byStatus: Record<SignatureStatus, number> = {
    DRAFT: 0, SIGNED: 0, VOIDED: 0, EXPIRED: 0, DECLINED: 0,
  };
  const byTypeMap = new Map<SignatureDocumentType, number>();
  let lastSignedAt: string | null = null;
  let bindingCount = 0;
  for (const s of rows) {
    byStatus[s.status] += 1;
    const t = s.document.documentType;
    byTypeMap.set(t, (byTypeMap.get(t) ?? 0) + 1);
    if (s.signedAt && (!lastSignedAt || s.signedAt > lastSignedAt)) lastSignedAt = s.signedAt;
    if (isLegallyBinding(s)) bindingCount += 1;
  }
  return {
    total: rows.length,
    byStatus,
    byDocumentType: Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    lastSignedAt,
    bindingCount,
  };
}
