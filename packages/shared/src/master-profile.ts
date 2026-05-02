// Master business profile — every value the PDF form filler + the
// browser auto-form-filler need on demand.
//
// Plain English: this is YGE's identity in structured form — the
// CSLB / DIR / DOT / NAICS / PSC / address / officers / bonding /
// insurance / banking detail that lands on every agency form. The
// company-info static export (./company.ts) is the on-disk static
// view used by templates that print at server-render time. This
// module is the editable schema that the PDF form filler + the
// browser extension read at fill time. They overlap on the
// company-identity fields and that's intentional — the form filler
// can fall back to the static export when the editable record is
// stale.
//
// Phase 1: Zod schema + helpers. The /settings/master-profile editor
// + the Prisma persistence layer ship in subsequent commits. The
// pre-mapped form library reads this shape via the path-resolution
// helper at the bottom.

import { z } from 'zod';

// ---- Sub-shapes ----------------------------------------------------------

export const MasterProfileAddressSchema = z.object({
  street: z.string().min(1).max(200),
  /** Optional second line — suite, unit, mailroom code. */
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(120),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Use 5- or 9-digit ZIP'),
  county: z.string().max(80).optional(),
});
export type MasterProfileAddress = z.infer<typeof MasterProfileAddressSchema>;

export const MasterProfileOfficerSchema = z.object({
  /** Stable per-row id for editor-driven updates. */
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(120),
  /** Free-form role tag — 'president' / 'vp' / 'secretary' /
   *  'safety-director' — used by the form filler to pick the right
   *  signer for a given form. */
  roleKey: z.string().min(1).max(60),
  phone: z.string().min(1).max(40),
  email: z.string().email().max(254),
  /** SSN-truncated last-4 — some federal forms ask for it. We never
   *  store the full SSN; the form filler asks the user at fill time
   *  if an agency demands it. */
  ssnLast4: z.string().regex(/^\d{4}$/).optional(),
  ownershipPercent: z.number().min(0).max(100).optional(),
});
export type MasterProfileOfficer = z.infer<typeof MasterProfileOfficerSchema>;

export const MasterProfileBondingSchema = z.object({
  /** Surety company. */
  suretyName: z.string().min(1).max(200),
  /** Surety address. */
  suretyAddress: MasterProfileAddressSchema.optional(),
  /** Bond agent contact. */
  agentName: z.string().max(200).optional(),
  agentPhone: z.string().max(40).optional(),
  agentEmail: z.string().email().max(254).optional(),
  /** Bonding capacity in cents. */
  singleJobLimitCents: z.number().int().nonnegative().default(0),
  aggregateLimitCents: z.number().int().nonnegative().default(0),
  /** Free-form notes — 'Travelers — capacity confirmed via Brook on
   *  4/22'. */
  notes: z.string().max(2000).optional(),
});
export type MasterProfileBonding = z.infer<typeof MasterProfileBondingSchema>;

export const MasterProfileInsurancePolicySchema = z.object({
  id: z.string().min(1).max(60),
  /** What kind of policy. */
  kind: z.enum([
    'GENERAL_LIABILITY',
    'AUTOMOBILE_LIABILITY',
    'WORKERS_COMP',
    'EXCESS_UMBRELLA',
    'POLLUTION',
    'PROFESSIONAL',
    'EQUIPMENT_FLOATER',
    'BUILDERS_RISK',
    'OTHER',
  ]),
  carrierName: z.string().min(1).max(200),
  policyNumber: z.string().min(1).max(80),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Per-occurrence limit in cents. */
  perOccurrenceCents: z.number().int().nonnegative().default(0),
  /** Aggregate limit in cents. */
  aggregateCents: z.number().int().nonnegative().default(0),
  /** Optional broker contact. */
  brokerName: z.string().max(200).optional(),
  brokerPhone: z.string().max(40).optional(),
  brokerEmail: z.string().email().max(254).optional(),
  /** ACORD 25 cert holder template — most agencies want this on file. */
  acordCertOnFile: z.boolean().default(false),
});
export type MasterProfileInsurancePolicy = z.infer<typeof MasterProfileInsurancePolicySchema>;

export const MasterProfileBankingSchema = z.object({
  bankName: z.string().min(1).max(200),
  /** Last-4 only — full account numbers never live in the master
   *  profile. The form filler asks the user inline when an agency
   *  demands a full account number. */
  accountLast4: z.string().regex(/^\d{4}$/).optional(),
  /** Routing number is publicly known per bank, so it's safe to keep. */
  routingNumber: z.string().regex(/^\d{9}$/).optional(),
  /** Banker contact for capacity / reference letters. */
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().max(254).optional(),
});
export type MasterProfileBanking = z.infer<typeof MasterProfileBankingSchema>;

// ---- The full row --------------------------------------------------------

export const MasterProfileSchema = z.object({
  id: z.string().min(1).max(80).default('master'),
  createdAt: z.string(),
  updatedAt: z.string(),

  legalName: z.string().min(1).max(200),
  shortName: z.string().min(1).max(80),
  /** California Secretary of State entity number when applicable. */
  caEntityNumber: z.string().max(40).optional(),
  /** Federal EIN — XX-XXXXXXX. Required by IRS forms. */
  federalEin: z.string().regex(/^\d{2}-\d{7}$/).optional(),
  /** California Employer Account Number for SUI / ETT / SDI. */
  caEmployerAccountNumber: z.string().max(40).optional(),

  cslbLicense: z.string().min(1).max(40),
  /** CSLB license classifications — 'A' general engineering,
   *  'C-12' earthwork, etc. */
  cslbClassifications: z.array(z.string().max(20)).default([]),
  /** CSLB license expiration. */
  cslbExpiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  dirNumber: z.string().min(1).max(40),
  dirExpiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  dotNumber: z.string().max(40).optional(),
  /** California Motor Carrier Permit number. */
  caMcpNumber: z.string().max(40).optional(),

  naicsCodes: z.array(z.string().regex(/^\d{6}$/)).default([]),
  pscCodes: z.array(z.string().max(10)).default([]),

  /** Primary business address — printed on bid forms, ACORD 25, etc. */
  address: MasterProfileAddressSchema,
  /** Mailing address when distinct from the primary. */
  mailingAddress: MasterProfileAddressSchema.optional(),

  primaryPhone: z.string().min(1).max(40),
  primaryFax: z.string().max(40).optional(),
  primaryEmail: z.string().email().max(254),
  websiteUrl: z.string().url().max(400).optional(),

  /** Officers / signers — president, VP, secretary, etc. The form
   *  filler picks by roleKey. */
  officers: z.array(MasterProfileOfficerSchema).default([]),

  bonding: MasterProfileBondingSchema.optional(),
  insurance: z.array(MasterProfileInsurancePolicySchema).default([]),
  banking: MasterProfileBankingSchema.optional(),

  /** Whether YGE is registered as a Disadvantaged Business
   *  Enterprise / Small Business Enterprise / Disabled Veteran
   *  Business Enterprise / Woman-Owned. Each agency form asks. */
  isDbe: z.boolean().default(false),
  isSbe: z.boolean().default(false),
  isDvbe: z.boolean().default(false),
  isWbe: z.boolean().default(false),

  /** Free-form notes — internal only. */
  notes: z.string().max(8000).optional(),
});
export type MasterProfile = z.infer<typeof MasterProfileSchema>;

// ---- Path resolver -------------------------------------------------------

/**
 * Get a value from the master profile by dotted path. Drives the
 * PDF form filler's per-field 'fill from this path' mapping. Walks
 * arrays via numeric indices (e.g. `officers.0.name`) and supports
 * a `roleKey` shortcut for officer lookup
 * (`officers.president.name`).
 *
 * Returns `undefined` for any path that doesn't resolve. Returning
 * undefined (rather than throwing) lets the filler skip optional
 * fields cleanly without try/catch noise.
 */
export function resolveProfilePath(
  profile: MasterProfile,
  path: string,
): unknown {
  const parts = path.split('.');
  let cursor: unknown = profile;
  for (const part of parts) {
    if (cursor == null) return undefined;
    if (Array.isArray(cursor)) {
      // Officer / insurance lookup by role / kind shortcut.
      const numeric = Number.parseInt(part, 10);
      if (Number.isFinite(numeric)) {
        cursor = cursor[numeric];
        continue;
      }
      // Try roleKey on officers and kind on insurance.
      const matchByKey = (cursor as Array<{ roleKey?: string; kind?: string }>).find(
        (x) => x.roleKey === part || x.kind === part,
      );
      if (matchByKey) {
        cursor = matchByKey;
        continue;
      }
      return undefined;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[part];
      continue;
    }
    return undefined;
  }
  return cursor;
}

/**
 * Whether a field is considered sensitive — full SSN, full bank
 * account number, etc. The form filler shows these as 'fill at
 * paste time, not from the master record' to keep the master
 * profile free of high-risk PII. Currently a hard-coded list;
 * future iterations may make it configurable.
 */
const SENSITIVE_PATHS: ReadonlyArray<string> = [
  // Reserved — full SSN, full bank account number live nowhere on
  // disk. The filler always prompts for them inline.
];

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATHS.includes(path);
}

// ---- Id helper -----------------------------------------------------------

export function newOfficerId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `officer-${hex.padStart(8, '0')}`;
}

export function newInsurancePolicyId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `pol-${hex.padStart(8, '0')}`;
}
