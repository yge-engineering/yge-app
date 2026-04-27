// Vendor — supplier / subcontractor / service provider master record.
//
// Phase 1 captures the data we need to write a check + meet IRS 1099
// reporting + agency COI requirements. Future phases tie vendors to AP
// invoice line items, surface 1099 totals at year-end, and run a
// monthly COI-expiration check.

import { z } from 'zod';

export const VendorKindSchema = z.enum([
  'SUPPLIER',           // material vendor
  'SUBCONTRACTOR',
  'EQUIPMENT_RENTAL',
  'TRUCKING',
  'PROFESSIONAL',       // engineer, accountant, attorney
  'UTILITY',
  'GOVERNMENT',         // permits, inspections
  'OTHER',
]);
export type VendorKind = z.infer<typeof VendorKindSchema>;

export const VendorPaymentTermsSchema = z.enum([
  'NET_30',
  'NET_60',
  'NET_45',
  'NET_15',
  'NET_10',
  'DUE_ON_RECEIPT',
  'COD',
  'PREPAID',
  'OTHER',
]);
export type VendorPaymentTerms = z.infer<typeof VendorPaymentTermsSchema>;

export const VendorSchema = z.object({
  /** Stable id `vnd-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Legal name as it appears on the W-9. */
  legalName: z.string().min(1).max(200),
  /** DBA / display name. Falls back to legalName. */
  dbaName: z.string().max(200).optional(),
  kind: VendorKindSchema,

  /** Federal Tax ID (EIN or SSN). Required for 1099 reporting. Stored
   *  as-typed; the UI masks all but last 4 in list views. */
  taxId: z.string().max(40).optional(),
  /** True iff a current W-9 is on file (must be re-collected every 3
   *  years per IRS guidance). */
  w9OnFile: z.boolean().default(false),
  /** Date W-9 was last collected (yyyy-mm-dd). */
  w9CollectedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** When true, payments to this vendor count toward 1099-NEC reporting
   *  (services rendered by an unincorporated business). Subs default
   *  to true; corporate suppliers default to false. */
  is1099Reportable: z.boolean().default(false),

  /** Insurance certificate of insurance (COI) — common requirement
   *  for subcontractors. Cert kind = 'INSURANCE_CERT'. */
  coiOnFile: z.boolean().default(false),
  coiExpiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  /** Address. */
  addressLine: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(20).optional(),
  zip: z.string().max(20).optional(),

  /** Primary contact + phone + email. */
  contactName: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(120).optional(),

  /** Payment terms. */
  paymentTerms: VendorPaymentTermsSchema.default('NET_30'),
  /** Account number the vendor uses for our company on their side
   *  (the 'remit-to with this' identifier). */
  accountNumber: z.string().max(80).optional(),

  /** Default GL account when AP-invoicing this vendor. */
  defaultGlCode: z.string().max(40).optional(),
  /** Free-form CSLB or DIR number for subcontractor vendors. */
  cslbLicense: z.string().max(40).optional(),
  dirRegistration: z.string().max(40).optional(),

  /** True iff vendor is on hold (don't issue payments). */
  onHold: z.boolean().default(false),
  onHoldReason: z.string().max(500).optional(),

  notes: z.string().max(10_000).optional(),
});
export type Vendor = z.infer<typeof VendorSchema>;

export const VendorCreateSchema = VendorSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  paymentTerms: VendorPaymentTermsSchema.optional(),
  w9OnFile: z.boolean().optional(),
  is1099Reportable: z.boolean().optional(),
  coiOnFile: z.boolean().optional(),
  onHold: z.boolean().optional(),
});
export type VendorCreate = z.infer<typeof VendorCreateSchema>;

export const VendorPatchSchema = VendorCreateSchema.partial();
export type VendorPatch = z.infer<typeof VendorPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function vendorKindLabel(k: VendorKind): string {
  switch (k) {
    case 'SUPPLIER': return 'Supplier';
    case 'SUBCONTRACTOR': return 'Subcontractor';
    case 'EQUIPMENT_RENTAL': return 'Equipment rental';
    case 'TRUCKING': return 'Trucking';
    case 'PROFESSIONAL': return 'Professional';
    case 'UTILITY': return 'Utility';
    case 'GOVERNMENT': return 'Government';
    case 'OTHER': return 'Other';
  }
}

export function vendorPaymentTermsLabel(t: VendorPaymentTerms): string {
  switch (t) {
    case 'NET_30': return 'Net 30';
    case 'NET_60': return 'Net 60';
    case 'NET_45': return 'Net 45';
    case 'NET_15': return 'Net 15';
    case 'NET_10': return 'Net 10';
    case 'DUE_ON_RECEIPT': return 'Due on receipt';
    case 'COD': return 'COD';
    case 'PREPAID': return 'Prepaid';
    case 'OTHER': return 'Other';
  }
}

/** Mask a tax ID for display. Returns just the last 4 with ***-**-XXXX
 *  for SSN-shaped or **-***XXXX for EIN-shaped. */
export function maskTaxId(taxId?: string): string {
  if (!taxId) return '';
  const digits = taxId.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  const last4 = digits.slice(-4);
  return `***-**-${last4}`;
}

/** True iff vendor has a current COI (in date). */
export function vendorCoiCurrent(
  v: Pick<Vendor, 'coiOnFile' | 'coiExpiresOn'>,
  now: Date = new Date(),
): boolean {
  if (!v.coiOnFile) return false;
  if (!v.coiExpiresOn) return true; // not tracked, assume current
  const due = new Date(v.coiExpiresOn + 'T23:59:59');
  if (Number.isNaN(due.getTime())) return true;
  return due.getTime() > now.getTime();
}

/** True iff vendor's W-9 is still in date (re-collected within last
 *  3 years per IRS guidance). */
export function vendorW9Current(
  v: Pick<Vendor, 'w9OnFile' | 'w9CollectedOn'>,
  now: Date = new Date(),
): boolean {
  if (!v.w9OnFile) return false;
  if (!v.w9CollectedOn) return false; // unknown collection date — treat as needing refresh
  const collected = new Date(v.w9CollectedOn + 'T00:00:00');
  if (Number.isNaN(collected.getTime())) return false;
  const threeYearsMs = 3 * 365 * 24 * 60 * 60 * 1000;
  return now.getTime() - collected.getTime() < threeYearsMs;
}

export interface VendorRollup {
  total: number;
  onHold: number;
  missingW9: number;
  missingCoi: number;
  /** Per-kind counts. */
  byKind: Array<{ kind: VendorKind; count: number }>;
}

export function computeVendorRollup(
  vendors: Vendor[],
  now: Date = new Date(),
): VendorRollup {
  let onHold = 0;
  let missingW9 = 0;
  let missingCoi = 0;
  const byKindMap = new Map<VendorKind, number>();
  for (const v of vendors) {
    if (v.onHold) onHold += 1;
    if (v.is1099Reportable && !vendorW9Current(v, now)) missingW9 += 1;
    if (v.kind === 'SUBCONTRACTOR' && !vendorCoiCurrent(v, now)) missingCoi += 1;
    byKindMap.set(v.kind, (byKindMap.get(v.kind) ?? 0) + 1);
  }
  return {
    total: vendors.length,
    onHold,
    missingW9,
    missingCoi,
    byKind: Array.from(byKindMap.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function newVendorId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `vnd-${hex.padStart(8, '0')}`;
}
