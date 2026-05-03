// AR payment — money received from a customer / agency.
//
// Phase 1 captures the audit trail every contractor needs:
//   - which invoice was paid
//   - how (ACH / check / wire / card)
//   - when and how much
//   - who deposited it (bank account label)
//
// Special treatment for retention: Cal public-works contracts hold
// retention until completion, then release it on a statutory clock
// (CA Public Contract Code §7107: 60 days from completion notice).
// `RETENTION_RELEASE` payments are tagged so the system can compute
// CA prompt-pay interest if released late (2% per month per §7107(f)).

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const ArPaymentMethodSchema = z.enum([
  'ACH',
  'CHECK',
  'WIRE',
  'CARD',
  'CASH',
  'OTHER',
]);
export type ArPaymentMethod = z.infer<typeof ArPaymentMethodSchema>;

export const ArPaymentKindSchema = z.enum([
  'PROGRESS',           // normal progress payment
  'RETENTION_RELEASE',  // released retention
  'FINAL',              // final closeout
  'PARTIAL',            // ad-hoc partial
  'OTHER',
]);
export type ArPaymentKind = z.infer<typeof ArPaymentKindSchema>;

export const ArPaymentSchema = z.object({
  /** Stable id `arp-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** AR invoice this payment applies to. */
  arInvoiceId: z.string().min(1).max(120),
  /** Convenience copy of the job id (for fast filtering / reporting). */
  jobId: z.string().min(1).max(120),

  kind: ArPaymentKindSchema.default('PROGRESS'),
  method: ArPaymentMethodSchema.default('CHECK'),

  /** Date the money cleared / hit the bank (yyyy-mm-dd). */
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Amount applied to the invoice (cents). */
  amountCents: z.number().int().nonnegative(),

  /** Reference number — check #, ACH trace, wire ref, etc. */
  referenceNumber: z.string().max(80).optional(),
  /** Bank account label this was deposited into (free-form for now). */
  depositAccount: z.string().max(80).optional(),
  /** Date deposited (yyyy-mm-dd) if different from receivedOn. */
  depositedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

  /** Free-form payer name override; defaults to invoice customerName. */
  payerName: z.string().max(200).optional(),

  notes: z.string().max(10_000).optional(),
});
export type ArPayment = z.infer<typeof ArPaymentSchema>;

export const ArPaymentCreateSchema = ArPaymentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  kind: ArPaymentKindSchema.optional(),
  method: ArPaymentMethodSchema.optional(),
});
export type ArPaymentCreate = z.infer<typeof ArPaymentCreateSchema>;

export const ArPaymentPatchSchema = ArPaymentCreateSchema.partial();
export type ArPaymentPatch = z.infer<typeof ArPaymentPatchSchema>;

// ---- Pure helpers --------------------------------------------------------

export function arPaymentMethodLabel(m: ArPaymentMethod, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `arPaymentMethod.${m}`);
}

export function arPaymentKindLabel(k: ArPaymentKind, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `arPaymentKind.${k}`);
}

/** Sum of all payments applied to a single invoice (cents). */
export function sumPaymentsForInvoice(
  invoiceId: string,
  payments: ArPayment[],
): number {
  return payments
    .filter((p) => p.arInvoiceId === invoiceId)
    .reduce((acc, p) => acc + p.amountCents, 0);
}

/**
 * CA Public Contract Code §7107 retention-release prompt-pay interest.
 *
 * For public-works contracts the retention must be released within 60
 * days of completion notice. If late, statutory interest at 2% per
 * month accrues, computed daily.
 *
 * - completedOn: date the agency issued completion notice (yyyy-mm-dd)
 * - releasedOn: date retention payment cleared (yyyy-mm-dd) — null if
 *               still outstanding (uses `now`)
 * - retentionHeldCents: original retention amount (cents)
 * - now: defaults to `new Date()`
 *
 * Returns:
 *   {
 *     dueOn: 'yyyy-mm-dd' (60 days after completedOn),
 *     daysLate: number  (>=0),
 *     interestCents: number  (rounded to nearest cent),
 *   }
 *
 * Citation: PCC §7107(c) (60-day release) + §7107(f) (2%/month
 * interest "in lieu of any interest otherwise due"). The 2%/month rule
 * is statutory; this helper computes it as 2% / 30 = 0.0667% per day.
 */
export function ca7107RetentionInterest(args: {
  completedOn: string;
  releasedOn?: string;
  retentionHeldCents: number;
  now?: Date;
}): { dueOn: string; daysLate: number; interestCents: number } {
  const { completedOn, releasedOn, retentionHeldCents } = args;
  const now = args.now ?? new Date();

  const completed = new Date(completedOn + 'T00:00:00Z');
  const dueDate = new Date(completed.getTime() + 60 * 24 * 60 * 60 * 1000);
  const dueOn = dueDate.toISOString().slice(0, 10);

  const endDate = releasedOn
    ? new Date(releasedOn + 'T00:00:00Z')
    : now;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLate = Math.max(
    0,
    Math.floor((endDate.getTime() - dueDate.getTime()) / msPerDay),
  );

  // 2% per month, applied as 2%/30 daily.
  const dailyRate = 0.02 / 30;
  const interestCents = Math.round(retentionHeldCents * dailyRate * daysLate);

  return { dueOn, daysLate, interestCents };
}

export interface ArPaymentRollup {
  total: number;
  totalCents: number;
  /** Count + total of retention-release payments. */
  retentionReleaseCount: number;
  retentionReleaseCents: number;
}

export function computeArPaymentRollup(payments: ArPayment[]): ArPaymentRollup {
  let totalCents = 0;
  let retentionReleaseCount = 0;
  let retentionReleaseCents = 0;
  for (const p of payments) {
    totalCents += p.amountCents;
    if (p.kind === 'RETENTION_RELEASE') {
      retentionReleaseCount += 1;
      retentionReleaseCents += p.amountCents;
    }
  }
  return {
    total: payments.length,
    totalCents,
    retentionReleaseCount,
    retentionReleaseCents,
  };
}

export function newArPaymentId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `arp-${hex.padStart(8, '0')}`;
}
