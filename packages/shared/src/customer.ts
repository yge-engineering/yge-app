// Customer master.
//
// Mirror image of the Vendor master, but for the AR side. Customers
// are who YGE bills: agencies (CalFire, Caltrans, counties, cities),
// private owners, and other primes (when YGE is acting as a sub).
//
// Phase 1 captures the data we need to write a bill: legal name,
// DBA, primary contact, billing address, agency type. Future phases
// link a Customer to its AR invoices, AR payments, and per-job
// history.

import { z } from 'zod';

export const CustomerKindSchema = z.enum([
  'STATE_AGENCY',         // CalFire, Caltrans, DGS, etc.
  'FEDERAL_AGENCY',       // BLM, USFS, etc.
  'COUNTY',
  'CITY',
  'SPECIAL_DISTRICT',     // school district, water district
  'PRIVATE_OWNER',
  'PRIME_CONTRACTOR',     // when YGE is sub-tier
  'OTHER',
]);
export type CustomerKind = z.infer<typeof CustomerKindSchema>;

export const CustomerSchema = z.object({
  /** Stable id `cus-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Legal name as it appears on contracts. */
  legalName: z.string().min(1).max(200),
  /** DBA / display name. Falls back to legalName. */
  dbaName: z.string().max(200).optional(),
  kind: CustomerKindSchema,

  /** Primary contact for billing questions. */
  contactName: z.string().max(120).optional(),
  contactTitle: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(200).optional(),

  /** Billing address. */
  billingAddressLine: z.string().max(200).optional(),
  billingAddressLine2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  zip: z.string().max(20).optional(),

  /** Free-form payment terms (NET_30, NET_45, etc). Free-form because
   *  agency contracts often spell out unique terms (15 days from
   *  approval, etc). */
  paymentTerms: z.string().max(80).optional(),

  /** Internal account # the customer uses to identify YGE on their
   *  side (e.g. CalFire's vendor #). */
  ourAccountNumber: z.string().max(80).optional(),

  /** Default GL revenue account for this customer (4xxxx). */
  defaultRevenueAccount: z.string().max(10).optional(),

  /** Optional default tax-exempt flag — most public agencies. */
  taxExempt: z.boolean().default(false),
  taxExemptReason: z.string().max(200).optional(),

  /** True iff customer is on hold (don't issue invoices). */
  onHold: z.boolean().default(false),
  onHoldReason: z.string().max(500).optional(),

  notes: z.string().max(10_000).optional(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerCreateSchema = CustomerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  taxExempt: z.boolean().optional(),
  onHold: z.boolean().optional(),
});
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

export const CustomerPatchSchema = CustomerCreateSchema.partial();
export type CustomerPatch = z.infer<typeof CustomerPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function customerKindLabel(k: CustomerKind): string {
  switch (k) {
    case 'STATE_AGENCY': return 'State agency';
    case 'FEDERAL_AGENCY': return 'Federal agency';
    case 'COUNTY': return 'County';
    case 'CITY': return 'City';
    case 'SPECIAL_DISTRICT': return 'Special district';
    case 'PRIVATE_OWNER': return 'Private owner';
    case 'PRIME_CONTRACTOR': return 'Prime contractor';
    case 'OTHER': return 'Other';
  }
}

/** Display name — DBA preferred, falls back to legal. */
export function customerDisplayName(c: Pick<Customer, 'legalName' | 'dbaName'>): string {
  return c.dbaName && c.dbaName.trim().length > 0 ? c.dbaName : c.legalName;
}

/** True iff this customer is a public-works payer. Public agencies
 *  trigger DIR + certified payroll requirements on the job. */
export function isPublicAgency(c: Pick<Customer, 'kind'>): boolean {
  return (
    c.kind === 'STATE_AGENCY' ||
    c.kind === 'FEDERAL_AGENCY' ||
    c.kind === 'COUNTY' ||
    c.kind === 'CITY' ||
    c.kind === 'SPECIAL_DISTRICT'
  );
}

export interface CustomerRollup {
  total: number;
  active: number;
  onHold: number;
  publicAgencies: number;
  byKind: Array<{ kind: CustomerKind; count: number }>;
}

export function computeCustomerRollup(customers: Customer[]): CustomerRollup {
  let active = 0;
  let onHold = 0;
  let publicAgencies = 0;
  const byKindMap = new Map<CustomerKind, number>();
  for (const c of customers) {
    if (c.onHold) onHold += 1;
    else active += 1;
    if (isPublicAgency(c)) publicAgencies += 1;
    byKindMap.set(c.kind, (byKindMap.get(c.kind) ?? 0) + 1);
  }
  return {
    total: customers.length,
    active,
    onHold,
    publicAgencies,
    byKind: Array.from(byKindMap.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function newCustomerId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `cus-${hex.padStart(8, '0')}`;
}
