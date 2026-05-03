// AP payment — money out to a vendor against an AP invoice.
//
// Mirror image of the AR payment module. One AP payment is one
// outgoing event (a check, ACH, wire, or card transaction) that may
// apply to one or more AP invoices. Phase 1 keeps it simple — one
// payment applies to one invoice; Phase 2 will let a single check
// satisfy multiple invoices in one row.
//
// The bookkeeper's "check register" is just `listApPayments()` sorted
// by date. The AP invoice's `paidCents` is the sum of payments.

import { z } from 'zod';
import { ApPaymentMethodSchema, type ApPaymentMethod } from './ap-invoice';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

// Re-export the enum from ap-invoice so callers can pull it from here
// alongside the rest of the AP-payment surface.
export { ApPaymentMethodSchema };
export type { ApPaymentMethod };

export const ApPaymentSchema = z.object({
  /** Stable id `app-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** AP invoice this payment applies to. */
  apInvoiceId: z.string().min(1).max(120),
  /** Convenience copy of the vendor name (so the check register prints
   *  without a join). */
  vendorName: z.string().min(1).max(200),

  method: ApPaymentMethodSchema.default('CHECK'),

  /** Date the money left the bank (yyyy-mm-dd). */
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Amount applied to the invoice (cents). */
  amountCents: z.number().int().positive(),

  /** Reference number — check #, ACH trace, wire ref, etc. The check
   *  register prints this in mono. */
  referenceNumber: z.string().max(80).optional(),
  /** Bank account label this came out of (free-form for now —
   *  Phase 2 will pin it to a specific GL account). */
  bankAccount: z.string().max(80).optional(),

  /** Stub flag for Phase 2: when true, this payment hasn't cleared yet
   *  (check is "in the mail"). The cash forecast can use this to
   *  separate "scheduled" vs "cleared" outflow. */
  cleared: z.boolean().default(false),
  clearedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Optional voided flag — keeps the row for audit but pulls it out
   *  of the AP balance + check register. */
  voided: z.boolean().default(false),
  voidedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  notes: z.string().max(10_000).optional(),
});
export type ApPayment = z.infer<typeof ApPaymentSchema>;

export const ApPaymentCreateSchema = ApPaymentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  method: ApPaymentMethodSchema.optional(),
  cleared: z.boolean().optional(),
  voided: z.boolean().optional(),
});
export type ApPaymentCreate = z.infer<typeof ApPaymentCreateSchema>;

export const ApPaymentPatchSchema = ApPaymentCreateSchema.partial();
export type ApPaymentPatch = z.infer<typeof ApPaymentPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function apPaymentMethodLabel(m: ApPaymentMethod, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `apPaymentMethod.${m}`);
}

/** Sum of non-voided payments applied to one invoice. */
export function sumApPaymentsForInvoice(
  invoiceId: string,
  payments: ApPayment[],
): number {
  let total = 0;
  for (const p of payments) {
    if (p.voided) continue;
    if (p.apInvoiceId !== invoiceId) continue;
    total += p.amountCents;
  }
  return total;
}

export interface ApPaymentRollup {
  total: number;
  totalCents: number;
  /** Count of payments that haven't cleared yet — funds are scheduled
   *  but still in transit. */
  uncleared: number;
  unclearedCents: number;
  /** Voided rows kept for audit. */
  voided: number;
}

export function computeApPaymentRollup(payments: ApPayment[]): ApPaymentRollup {
  let totalCents = 0;
  let uncleared = 0;
  let unclearedCents = 0;
  let voided = 0;
  for (const p of payments) {
    if (p.voided) {
      voided += 1;
      continue;
    }
    totalCents += p.amountCents;
    if (!p.cleared) {
      uncleared += 1;
      unclearedCents += p.amountCents;
    }
  }
  return {
    total: payments.length,
    totalCents,
    uncleared,
    unclearedCents,
    voided,
  };
}

export function newApPaymentId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `app-${hex.padStart(8, '0')}`;
}
