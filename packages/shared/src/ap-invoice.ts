// AP invoice — a vendor bill YGE owes.
//
// Phase 1 scope: manual entry. AI-assisted scan from a PDF lands in a
// later phase as a transformer that produces the same shape from a file.
// The data model is therefore a complete invoice record without any
// AI-extraction cruft.
//
// What the data model captures:
//   - vendor (name, optional canonical id later when vendor master lands)
//   - invoice number + dates (invoice date + due date)
//   - optional job linkage so cost rolls into the right project
//   - line items (qty * unitPrice = lineTotalCents) with cost-code stub
//   - status pipeline: DRAFT → PENDING (submitted for approval) →
//     APPROVED → PAID. REJECTED is a terminal off-ramp from any state.
//   - payment fields: paidAt + payment method + check / ACH ref
//
// Unpaid balance math: header.totalCents - header.paidCents (paidCents
// updates when a payment hits). Doesn't compare to the line-item sum
// directly — invoices in the wild have rounding, freight, surcharges,
// and discounts that don't always reconcile to a simple sum.

import { z } from 'zod';

export const ApInvoiceStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PAID',
  'REJECTED',
]);
export type ApInvoiceStatus = z.infer<typeof ApInvoiceStatusSchema>;

export const ApPaymentMethodSchema = z.enum([
  'CHECK',
  'ACH',
  'WIRE',
  'CREDIT_CARD',
  'CASH',
  'OTHER',
]);
export type ApPaymentMethod = z.infer<typeof ApPaymentMethodSchema>;

/** A single line on the bill. */
export const ApInvoiceLineItemSchema = z.object({
  description: z.string().min(1).max(400),
  /** Free-form unit (EA, TON, HR, LF). */
  unit: z.string().max(20).optional(),
  /** Quantity invoiced. */
  quantity: z.number().nonnegative().default(1),
  /** Unit price in cents. */
  unitPriceCents: z.number().int().nonnegative().default(0),
  /** Line total in cents. Stored explicitly because invoices in the wild
   *  often round qty*unit_price differently than we'd compute. */
  lineTotalCents: z.number().int().nonnegative(),
  /** Optional GL account code (chart-of-accounts). Free-form for Phase 1;
   *  Phase 4 will tie this to a managed GL. */
  glCode: z.string().max(40).optional(),
  /** Internal cost-code reference. Free-form Phase 1 -> CostCode FK Phase 4. */
  costCode: z.string().max(40).optional(),
  /** When this line is for a specific job — supports invoices that
   *  span multiple jobs (rare but happens). */
  jobId: z.string().max(120).optional(),
});
export type ApInvoiceLineItem = z.infer<typeof ApInvoiceLineItemSchema>;

export const ApInvoiceSchema = z.object({
  /** Stable id `ap-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Free-form vendor name. Phase 4 introduces a Vendor master and this
   *  becomes a foreign key. */
  vendorName: z.string().min(1).max(200),
  /** Vendor's invoice number (their identifier — not ours). */
  invoiceNumber: z.string().max(80).optional(),

  /** Invoice date (yyyy-mm-dd). */
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Due date (yyyy-mm-dd). Optional — many vendors leave it blank
   *  and we apply terms on payment. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Default job linkage. Per-line jobId overrides this. */
  jobId: z.string().max(120).optional(),

  /** Line items — required to be at least one for a real invoice but
   *  drafts are allowed empty. */
  lineItems: z.array(ApInvoiceLineItemSchema).default([]),

  /** Header totals. totalCents is what the vendor billed (their bottom
   *  line). subtotalCents is the pre-tax/freight number. */
  subtotalCents: z.number().int().nonnegative().optional(),
  taxCents: z.number().int().nonnegative().optional(),
  freightCents: z.number().int().nonnegative().optional(),
  totalCents: z.number().int().nonnegative().default(0),
  /** Cumulative paid amount. status flips to PAID when this >= totalCents. */
  paidCents: z.number().int().nonnegative().default(0),

  status: ApInvoiceStatusSchema.default('DRAFT'),
  /** Audit trail for the approval step (set by /approve endpoint). */
  approvedAt: z.string().optional(),
  approvedByEmployeeId: z.string().max(60).optional(),
  /** Reason / detail when rejected. */
  rejectedReason: z.string().max(2_000).optional(),

  /** Most recent payment summary. The payment ledger is a Phase 4 add-on. */
  paidAt: z.string().optional(),
  paymentMethod: ApPaymentMethodSchema.optional(),
  /** Check / ACH / wire reference number. */
  paymentReference: z.string().max(80).optional(),

  /** Free-form internal notes. */
  notes: z.string().max(10_000).optional(),
});
export type ApInvoice = z.infer<typeof ApInvoiceSchema>;

export const ApInvoiceCreateSchema = ApInvoiceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: ApInvoiceStatusSchema.optional(),
  lineItems: z.array(ApInvoiceLineItemSchema).optional(),
  totalCents: z.number().int().nonnegative().optional(),
  paidCents: z.number().int().nonnegative().optional(),
});
export type ApInvoiceCreate = z.infer<typeof ApInvoiceCreateSchema>;

export const ApInvoicePatchSchema = ApInvoiceCreateSchema.partial();
export type ApInvoicePatch = z.infer<typeof ApInvoicePatchSchema>;

/** Body for /approve endpoint. */
export const ApInvoiceApproveSchema = z.object({
  approvedByEmployeeId: z.string().max(60).optional(),
});
export type ApInvoiceApprove = z.infer<typeof ApInvoiceApproveSchema>;

/** Body for /pay endpoint. */
export const ApInvoicePaySchema = z.object({
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  paymentMethod: ApPaymentMethodSchema,
  paymentReference: z.string().max(80).optional(),
  /** Cents amount of THIS payment. Server adds to paidCents and flips
   *  status to PAID when paidCents >= totalCents. */
  amountCents: z.number().int().positive(),
});
export type ApInvoicePay = z.infer<typeof ApInvoicePaySchema>;

/** Body for /reject endpoint. */
export const ApInvoiceRejectSchema = z.object({
  reason: z.string().min(1).max(2_000),
});
export type ApInvoiceReject = z.infer<typeof ApInvoiceRejectSchema>;

// ---- Pure helpers --------------------------------------------------------

export function apStatusLabel(s: ApInvoiceStatus): string {
  switch (s) {
    case 'DRAFT': return 'Draft';
    case 'PENDING': return 'Pending approval';
    case 'APPROVED': return 'Approved';
    case 'PAID': return 'Paid';
    case 'REJECTED': return 'Rejected';
  }
}

export function paymentMethodLabel(m: ApPaymentMethod): string {
  switch (m) {
    case 'CHECK': return 'Check';
    case 'ACH': return 'ACH';
    case 'WIRE': return 'Wire';
    case 'CREDIT_CARD': return 'Credit card';
    case 'CASH': return 'Cash';
    case 'OTHER': return 'Other';
  }
}

/** Sum of line totals (cents). Useful sanity check vs invoice header
 *  total — when they mismatch, a freight or tax line is missing. */
export function lineItemSumCents(invoice: Pick<ApInvoice, 'lineItems'>): number {
  return invoice.lineItems.reduce((acc, li) => acc + li.lineTotalCents, 0);
}

/** Unpaid balance. Negative numbers (overpaid) clamp to 0. */
export function unpaidBalanceCents(
  invoice: Pick<ApInvoice, 'totalCents' | 'paidCents'>,
): number {
  return Math.max(0, invoice.totalCents - invoice.paidCents);
}

export type ApDueLevel = 'none' | 'ok' | 'dueSoon' | 'overdue' | 'paid';

/** Urgency of payment. PAID is terminal-good. dueSoon = within 7 days.
 *  overdue = past due. none = no due date set. */
export function apDueLevel(
  invoice: Pick<ApInvoice, 'dueDate' | 'status' | 'paidCents' | 'totalCents'>,
  now: Date = new Date(),
): ApDueLevel {
  if (invoice.status === 'PAID' || unpaidBalanceCents(invoice) === 0) return 'paid';
  if (!invoice.dueDate) return 'none';
  const due = new Date(invoice.dueDate + 'T23:59:59');
  if (Number.isNaN(due.getTime())) return 'none';
  const deltaMs = due.getTime() - now.getTime();
  if (deltaMs < 0) return 'overdue';
  if (deltaMs < 7 * 24 * 60 * 60 * 1000) return 'dueSoon';
  return 'ok';
}

export interface ApInvoiceRollup {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  paid: number;
  rejected: number;
  /** Outstanding balance across non-paid invoices, in cents. */
  outstandingCents: number;
  /** Outstanding overdue subset of the above. */
  overdueCents: number;
}

export function computeApInvoiceRollup(
  invoices: ApInvoice[],
  now: Date = new Date(),
): ApInvoiceRollup {
  let draft = 0;
  let pending = 0;
  let approved = 0;
  let paid = 0;
  let rejected = 0;
  let outstandingCents = 0;
  let overdueCents = 0;
  for (const inv of invoices) {
    switch (inv.status) {
      case 'DRAFT': draft += 1; break;
      case 'PENDING': pending += 1; break;
      case 'APPROVED': approved += 1; break;
      case 'PAID': paid += 1; break;
      case 'REJECTED': rejected += 1; break;
    }
    if (inv.status !== 'PAID' && inv.status !== 'REJECTED') {
      const balance = unpaidBalanceCents(inv);
      outstandingCents += balance;
      if (apDueLevel(inv, now) === 'overdue') {
        overdueCents += balance;
      }
    }
  }
  return {
    total: invoices.length,
    draft,
    pending,
    approved,
    paid,
    rejected,
    outstandingCents,
    overdueCents,
  };
}

export function newApInvoiceId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `ap-${hex.padStart(8, '0')}`;
}
