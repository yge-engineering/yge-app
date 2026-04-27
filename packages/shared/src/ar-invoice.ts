// AR invoice — outgoing customer / agency bill.
//
// One invoice per (job, billing period). Phase 1 supports two source
// modes for line items:
//   - manual: user types each line
//   - from-daily-reports: server aggregates daily reports for the
//     billing period by employee classification (labor) + equipment
//     usage, multiplied by the rates set at build time. Cal Fire and
//     Caltrans both bill monthly with this kind of summary.
//
// The Cal Fire-specific format (text layout, attached daily reports,
// signed approval) is a printable-page concern, not a data-model
// concern. The data here is generic; the print template renders the
// per-customer flavor.

import { z } from 'zod';

export const ArInvoiceStatusSchema = z.enum([
  'DRAFT',
  'SENT',
  'PARTIALLY_PAID',
  'PAID',
  'DISPUTED',
  'WRITTEN_OFF',
]);
export type ArInvoiceStatus = z.infer<typeof ArInvoiceStatusSchema>;

export const ArInvoiceSourceSchema = z.enum([
  'MANUAL',
  'DAILY_REPORTS',
  'PROGRESS',
  'LUMP_SUM',
]);
export type ArInvoiceSource = z.infer<typeof ArInvoiceSourceSchema>;

export const ArInvoiceLineKindSchema = z.enum([
  'LABOR',
  'EQUIPMENT',
  'MATERIAL',
  'SUBCONTRACT',
  'OTHER',
]);
export type ArInvoiceLineKind = z.infer<typeof ArInvoiceLineKindSchema>;

export const ArInvoiceLineItemSchema = z.object({
  kind: ArInvoiceLineKindSchema,
  description: z.string().min(1).max(400),
  /** Free-form unit (HR, DAY, EA, TON, LF). */
  unit: z.string().max(20).optional(),
  quantity: z.number().nonnegative().default(1),
  unitPriceCents: z.number().int().nonnegative().default(0),
  /** Stored rather than computed because some agencies override (round
   *  weird) on the line total. */
  lineTotalCents: z.number().int().nonnegative(),
  /** When kind=LABOR or EQUIPMENT and source=DAILY_REPORTS, this points
   *  at the daily-report rows that contributed. */
  sourceRefs: z.array(z.string().max(120)).optional(),
  /** Free-form notes printed on the line (e.g. "Crew of 4 on backslope
   *  drainage"). */
  note: z.string().max(500).optional(),
});
export type ArInvoiceLineItem = z.infer<typeof ArInvoiceLineItemSchema>;

export const ArInvoiceSchema = z.object({
  /** Stable id `ar-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),

  /** Per-job counter for the invoice. e.g. 1, 2, 3. Free-form so a
   *  YGE-2026-0001 scheme works too. */
  invoiceNumber: z.string().min(1).max(40),

  customerName: z.string().min(1).max(200),
  customerAddress: z.string().max(1_000).optional(),
  /** Project / task / PO number the agency wants on the invoice. */
  customerProjectNumber: z.string().max(80).optional(),

  /** ISO yyyy-mm-dd. */
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Billing period covered. Cal Fire-style monthly billing uses month
   *  start + month end. T&M biweekly uses two-week ranges. */
  billingPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  billingPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  source: ArInvoiceSourceSchema.default('MANUAL'),
  lineItems: z.array(ArInvoiceLineItemSchema).default([]),

  /** Header totals. taxCents and retentionCents are deductions /
   *  additions; totalCents is what we're actually billing. */
  subtotalCents: z.number().int().nonnegative().default(0),
  taxCents: z.number().int().nonnegative().optional(),
  /** Retention held back per the contract. Negative impact on totalCents. */
  retentionCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().default(0),
  paidCents: z.number().int().nonnegative().default(0),

  status: ArInvoiceStatusSchema.default('DRAFT'),
  /** When the invoice was sent to the customer. */
  sentAt: z.string().optional(),
  /** Last payment received. */
  lastPaymentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Free-form description block that prints under the invoice header.
   *  Cal Fire wants a description per their contract; this captures it. */
  description: z.string().max(20_000).optional(),
  /** Internal notes — not printed. */
  notes: z.string().max(10_000).optional(),
});
export type ArInvoice = z.infer<typeof ArInvoiceSchema>;

export const ArInvoiceCreateSchema = ArInvoiceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: ArInvoiceStatusSchema.optional(),
  source: ArInvoiceSourceSchema.optional(),
  lineItems: z.array(ArInvoiceLineItemSchema).optional(),
  totalCents: z.number().int().nonnegative().optional(),
  subtotalCents: z.number().int().nonnegative().optional(),
  paidCents: z.number().int().nonnegative().optional(),
});
export type ArInvoiceCreate = z.infer<typeof ArInvoiceCreateSchema>;

export const ArInvoicePatchSchema = ArInvoiceCreateSchema.partial();
export type ArInvoicePatch = z.infer<typeof ArInvoicePatchSchema>;

/** Body for POST /ar-invoices/:id/build-from-daily-reports. */
export const ArInvoiceBuildFromReportsSchema = z.object({
  /** Date range to pull daily reports for. */
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Per-classification labor rates in cents/hour. Caller passes the
   *  rates appropriate to this contract (prevailing wage / GSA / agency-
   *  specific schedule). Keys = DirClassification values from
   *  ./employee. Empty entries fall back to a single defaultLaborRate. */
  laborRatesCentsPerHour: z.record(z.number().int().nonnegative()).optional(),
  /** Catch-all rate in cents/hour for any classification not in the
   *  laborRatesCentsPerHour map. */
  defaultLaborRateCentsPerHour: z.number().int().nonnegative().optional(),
  /** Whether to consolidate all crew rows under a single LABOR line
   *  (one line per period) or split per classification (one line per
   *  classification per period). */
  consolidateLabor: z.boolean().default(false),
});
export type ArInvoiceBuildFromReports = z.infer<typeof ArInvoiceBuildFromReportsSchema>;

// ---- Pure helpers --------------------------------------------------------

export function arInvoiceStatusLabel(s: ArInvoiceStatus): string {
  switch (s) {
    case 'DRAFT': return 'Draft';
    case 'SENT': return 'Sent';
    case 'PARTIALLY_PAID': return 'Partially paid';
    case 'PAID': return 'Paid';
    case 'DISPUTED': return 'Disputed';
    case 'WRITTEN_OFF': return 'Written off';
  }
}

export function arInvoiceSourceLabel(s: ArInvoiceSource): string {
  switch (s) {
    case 'MANUAL': return 'Manual';
    case 'DAILY_REPORTS': return 'From daily reports';
    case 'PROGRESS': return 'Progress billing';
    case 'LUMP_SUM': return 'Lump sum';
  }
}

export function arInvoiceLineKindLabel(k: ArInvoiceLineKind): string {
  switch (k) {
    case 'LABOR': return 'Labor';
    case 'EQUIPMENT': return 'Equipment';
    case 'MATERIAL': return 'Material';
    case 'SUBCONTRACT': return 'Subcontract';
    case 'OTHER': return 'Other';
  }
}

/** Sum of line totals (cents). */
export function arLineItemSumCents(invoice: Pick<ArInvoice, 'lineItems'>): number {
  return invoice.lineItems.reduce((acc, li) => acc + li.lineTotalCents, 0);
}

/** Compute totals from line items + tax + retention. */
export function computeArTotals(invoice: Pick<ArInvoice, 'lineItems' | 'taxCents' | 'retentionCents'>): {
  subtotalCents: number;
  totalCents: number;
} {
  const subtotalCents = arLineItemSumCents(invoice);
  const tax = invoice.taxCents ?? 0;
  const retention = invoice.retentionCents ?? 0;
  return {
    subtotalCents,
    totalCents: Math.max(0, subtotalCents + tax - retention),
  };
}

/** Unpaid balance. */
export function arUnpaidBalanceCents(
  invoice: Pick<ArInvoice, 'totalCents' | 'paidCents'>,
): number {
  return Math.max(0, invoice.totalCents - invoice.paidCents);
}

export interface ArInvoiceRollup {
  total: number;
  draft: number;
  sent: number;
  paid: number;
  disputed: number;
  outstandingCents: number;
  paidCents: number;
}

export function computeArRollup(invoices: ArInvoice[]): ArInvoiceRollup {
  let draft = 0;
  let sent = 0;
  let paid = 0;
  let disputed = 0;
  let outstandingCents = 0;
  let paidCents = 0;
  for (const inv of invoices) {
    if (inv.status === 'DRAFT') draft += 1;
    else if (inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID') sent += 1;
    else if (inv.status === 'PAID') paid += 1;
    else if (inv.status === 'DISPUTED') disputed += 1;
    if (inv.status !== 'PAID' && inv.status !== 'WRITTEN_OFF') {
      outstandingCents += arUnpaidBalanceCents(inv);
    }
    paidCents += inv.paidCents;
  }
  return { total: invoices.length, draft, sent, paid, disputed, outstandingCents, paidCents };
}

export function newArInvoiceId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `ar-${hex.padStart(8, '0')}`;
}
