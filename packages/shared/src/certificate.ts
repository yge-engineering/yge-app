// Certificate — a single time-bound credential the company holds.
//
// One unified model covers CSLB licenses, DIR registration, every kind
// of insurance certificate, surety bond profiles, and business
// licenses. Per-kind specifics live in optional fields rather than a
// type-discriminated union — the renderer hides irrelevant fields and
// the editor surfaces only the ones the picked kind actually uses.
//
// Why one model? At Phase 1 the operational question is always the
// same: "is the cert in date and where's the PDF?" Splitting into five
// tables makes the bid-envelope-checklist lookup harder without
// adding precision the foreman cares about.
//
// Out of scope (Phase 4 / 5):
//   - PDF upload + storage (the URL field is a stub for now)
//   - automated renewal reminders via email
//   - per-job cert linkage (which certs were submitted with which bid)

import { z } from 'zod';

/** What kind of credential? Drives the field set surfaced in the editor
 *  and the grouping in the list view. */
export const CertificateKindSchema = z.enum([
  'CSLB_LICENSE',
  'DIR_REGISTRATION',
  'BUSINESS_LICENSE',
  'CONTRACTOR_LICENSE',     // out-of-state, county, etc.
  'GENERAL_LIABILITY',
  'AUTO_INSURANCE',
  'WORKERS_COMP',
  'UMBRELLA',
  'POLLUTION',
  'PROFESSIONAL',
  'BOND_PROFILE',           // surety bonding capacity rather than a per-job bond
  'DOT_REGISTRATION',
  'TAX_CLEARANCE',
  'DBE_CERT',               // Disadvantaged Business Enterprise
  'OTHER',
]);
export type CertificateKind = z.infer<typeof CertificateKindSchema>;

/** Lifecycle. Most certs sit at ACTIVE; REVOKED is the terminal state
 *  for revocation (state pulled the license, etc) and SUPERSEDED gets
 *  used when a new cert replaces an old one and we want to keep the
 *  old row for audit history. */
export const CertificateStatusSchema = z.enum([
  'ACTIVE',
  'SUPERSEDED',
  'REVOKED',
]);
export type CertificateStatus = z.infer<typeof CertificateStatusSchema>;

export const CertificateSchema = z.object({
  /** Stable id of the form `cert-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  kind: CertificateKindSchema,
  /** Free-form label printed wherever the cert appears. e.g. "CSLB
   *  License A & C-12", "Travelers GL Policy 12345". */
  label: z.string().min(1).max(200),
  /** Issuing agency / carrier. State for licenses, insurance carrier
   *  for policies, surety for bonds. */
  issuingAuthority: z.string().max(200).optional(),
  /** Cert / policy / license number — the printable identifier. */
  certificateNumber: z.string().max(120).optional(),

  /** ISO yyyy-mm-dd. Effective date — most certs print this. */
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Expiration date. Optional because some certs (CSLB license — until
   *  revoked) don't expire on a calendar date. */
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  status: CertificateStatusSchema.default('ACTIVE'),

  /** Insurance-specific: per-occurrence + aggregate limits. */
  perOccurrenceLimitCents: z.number().int().nonnegative().optional(),
  aggregateLimitCents: z.number().int().nonnegative().optional(),
  deductibleCents: z.number().int().nonnegative().optional(),

  /** Bonding-profile-specific: surety's single-job + aggregate cap. */
  singleJobCapCents: z.number().int().nonnegative().optional(),
  bondingAggregateCapCents: z.number().int().nonnegative().optional(),
  /** Surety bond rate as a decimal (e.g. 0.0125 = 1.25%). */
  bondRateBps: z.number().int().nonnegative().optional(),

  /** Carrier / surety / agent contact info — useful when chasing
   *  renewals or filing claims. */
  agentName: z.string().max(120).optional(),
  agentPhone: z.string().max(40).optional(),
  agentEmail: z.string().max(120).optional(),

  /** Stub for the future doc-vault link. URL or vault id. */
  pdfUrl: z.string().max(800).optional(),

  /** Free-form notes — riders, exclusions, gotchas. */
  notes: z.string().max(10_000).optional(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

export const CertificateCreateSchema = CertificateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: CertificateStatusSchema.optional(),
});
export type CertificateCreate = z.infer<typeof CertificateCreateSchema>;

export const CertificatePatchSchema = CertificateCreateSchema.partial();
export type CertificatePatch = z.infer<typeof CertificatePatchSchema>;

// ---- Display + expiry helpers -------------------------------------------

export function certificateKindLabel(k: CertificateKind): string {
  switch (k) {
    case 'CSLB_LICENSE': return 'CSLB license';
    case 'DIR_REGISTRATION': return 'DIR registration';
    case 'BUSINESS_LICENSE': return 'Business license';
    case 'CONTRACTOR_LICENSE': return 'Contractor license';
    case 'GENERAL_LIABILITY': return 'General liability';
    case 'AUTO_INSURANCE': return 'Auto insurance';
    case 'WORKERS_COMP': return 'Workers\u2019 comp';
    case 'UMBRELLA': return 'Umbrella';
    case 'POLLUTION': return 'Pollution';
    case 'PROFESSIONAL': return 'Professional';
    case 'BOND_PROFILE': return 'Bonding profile';
    case 'DOT_REGISTRATION': return 'DOT registration';
    case 'TAX_CLEARANCE': return 'Tax clearance';
    case 'DBE_CERT': return 'DBE certification';
    case 'OTHER': return 'Other';
  }
}

export function certificateStatusLabel(s: CertificateStatus): string {
  switch (s) {
    case 'ACTIVE': return 'Active';
    case 'SUPERSEDED': return 'Superseded';
    case 'REVOKED': return 'Revoked';
  }
}

export type CertExpiryLevel = 'lifetime' | 'expired' | 'expiringSoon' | 'current';

/** Urgency band. Defaults: warn at 60 days out (most certs you'll want
 *  some lead time); 30-day window is too tight for bond renewals. */
export function certificateExpiryLevel(
  cert: Pick<Certificate, 'expiresOn' | 'status'>,
  now: Date = new Date(),
  warnDays = 60,
): CertExpiryLevel {
  if (cert.status === 'REVOKED' || cert.status === 'SUPERSEDED') {
    return 'expired';
  }
  if (!cert.expiresOn) return 'lifetime';
  const expiresAt = new Date(cert.expiresOn + 'T23:59:59');
  if (Number.isNaN(expiresAt.getTime())) return 'lifetime';
  const deltaMs = expiresAt.getTime() - now.getTime();
  if (deltaMs < 0) return 'expired';
  if (deltaMs < warnDays * 24 * 60 * 60 * 1000) return 'expiringSoon';
  return 'current';
}

/** Days until the cert expires. Negative when past expiry. Undefined for
 *  lifetime certs (no expiration date set). */
export function daysUntilExpiry(
  cert: Pick<Certificate, 'expiresOn'>,
  now: Date = new Date(),
): number | undefined {
  if (!cert.expiresOn) return undefined;
  const expiresAt = new Date(cert.expiresOn + 'T23:59:59');
  if (Number.isNaN(expiresAt.getTime())) return undefined;
  const deltaMs = expiresAt.getTime() - now.getTime();
  return Math.floor(deltaMs / (24 * 60 * 60 * 1000));
}

export interface CertificateRollup {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  /** Counts per kind for the at-a-glance sidebar. */
  byKind: Array<{ kind: CertificateKind; count: number }>;
}

export function computeCertificateRollup(
  certs: Certificate[],
  now: Date = new Date(),
): CertificateRollup {
  let active = 0;
  let expired = 0;
  let expiringSoon = 0;
  const byKind = new Map<CertificateKind, number>();
  for (const c of certs) {
    const lvl = certificateExpiryLevel(c, now);
    if (lvl === 'expired') expired += 1;
    else if (lvl === 'expiringSoon') expiringSoon += 1;
    if (c.status === 'ACTIVE' && lvl !== 'expired') active += 1;
    byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  }
  return {
    total: certs.length,
    active,
    expired,
    expiringSoon,
    byKind: Array.from(byKind.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function newCertificateId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `cert-${hex.padStart(8, '0')}`;
}
