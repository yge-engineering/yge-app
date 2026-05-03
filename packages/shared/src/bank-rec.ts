// Bank reconciliation.
//
// One record per (bank account, statement period). The bookkeeper
// types in the statement balance from the paper/PDF statement and
// flags any items that need to be added/subtracted to make the bank
// side match the GL side. Reconciliation passes when:
//
//   Adjusted bank balance == Adjusted GL balance
//
// where:
//   Adjusted bank balance = statement balance
//                          - outstanding checks (in-transit AP payments)
//                          + outstanding deposits (booked in GL but
//                            not yet on the statement)
//   Adjusted GL balance   = GL balance per books
//                          - bank fees (on statement but not in GL)
//                          + interest income (on statement but not in GL)
//                          + manual adjustments (rounding, errors)
//
// Phase 1 stores the rec record + the caller-supplied numbers. Phase 2
// will derive `outstandingChecksCents` automatically by joining
// AP payments where `cleared=false` and `paidOn <= statementDate`.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const BankRecStatusSchema = z.enum([
  'DRAFT',
  'RECONCILED',
  'VOIDED',
]);
export type BankRecStatus = z.infer<typeof BankRecStatusSchema>;

export const BankRecAdjustmentKindSchema = z.enum([
  'BANK_FEE',
  'INTEREST',
  'MANUAL',
]);
export type BankRecAdjustmentKind = z.infer<typeof BankRecAdjustmentKindSchema>;

export const BankRecAdjustmentSchema = z.object({
  kind: BankRecAdjustmentKindSchema,
  /** Free-form description (e.g. "Wire fee — 4/15"). */
  description: z.string().min(1).max(300),
  /** Cents. Positive = adds to GL, negative = subtracts. The reconcile
   *  helper interprets sign per `kind`. */
  amountCents: z.number().int(),
});
export type BankRecAdjustment = z.infer<typeof BankRecAdjustmentSchema>;

export const BankRecSchema = z.object({
  /** Stable id `bnk-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Free-form label for the account (e.g. "Operating - BoA x1234"). */
  bankAccountLabel: z.string().min(1).max(120),
  /** GL account number this rec is for. Optional in case the user is
   *  reconciling before the COA is wired up. */
  glAccountNumber: z.string().max(10).optional(),

  /** yyyy-mm-dd of the statement closing date. */
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Beginning balance from the statement (cents). */
  beginningBalanceCents: z.number().int(),
  /** Ending balance per the statement (cents). */
  statementBalanceCents: z.number().int(),

  /** GL balance per the books as of statement date (cents). */
  glBalanceCents: z.number().int(),

  /** Sum of in-transit (uncleared) AP payments as of statement date. */
  outstandingChecksCents: z.number().int().nonnegative().default(0),
  /** Sum of deposits booked in GL but not yet on statement. */
  outstandingDepositsCents: z.number().int().nonnegative().default(0),

  adjustments: z.array(BankRecAdjustmentSchema).default([]),

  status: BankRecStatusSchema.default('DRAFT'),
  /** Date the bookkeeper signed off. */
  reconciledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Person who reconciled. */
  reconciledByName: z.string().max(120).optional(),

  notes: z.string().max(10_000).optional(),
});
export type BankRec = z.infer<typeof BankRecSchema>;

export const BankRecCreateSchema = BankRecSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: BankRecStatusSchema.optional(),
  outstandingChecksCents: z.number().int().nonnegative().optional(),
  outstandingDepositsCents: z.number().int().nonnegative().optional(),
  adjustments: z.array(BankRecAdjustmentSchema).optional(),
});
export type BankRecCreate = z.infer<typeof BankRecCreateSchema>;

export const BankRecPatchSchema = BankRecCreateSchema.partial();
export type BankRecPatch = z.infer<typeof BankRecPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function bankRecStatusLabel(s: BankRecStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `bankRec.status.${s}`);
}

export function adjustmentKindLabel(k: BankRecAdjustmentKind): string {
  switch (k) {
    case 'BANK_FEE': return 'Bank fee';
    case 'INTEREST': return 'Interest';
    case 'MANUAL': return 'Manual';
  }
}

/** Sum adjustments by signed amount. Bank fees and interest are
 *  caller-signed (typically: fee = positive, fee subtracts from GL by
 *  convention; interest = positive, adds to GL). The `signedNet`
 *  helper below applies the right sign per kind. */
export function signedAdjustmentNetCents(
  adjustments: BankRecAdjustment[],
): number {
  let total = 0;
  for (const a of adjustments) {
    switch (a.kind) {
      case 'BANK_FEE':
        // Fees subtract from GL.
        total -= a.amountCents;
        break;
      case 'INTEREST':
        // Interest adds to GL.
        total += a.amountCents;
        break;
      case 'MANUAL':
        // Caller-signed; positive adds, negative subtracts.
        total += a.amountCents;
        break;
    }
  }
  return total;
}

export interface BankRecComputation {
  /** Statement − outstandingChecks + outstandingDeposits. */
  adjustedBankBalanceCents: number;
  /** GL + signed adjustments. */
  adjustedGlBalanceCents: number;
  /** adjustedBank − adjustedGL. Zero when the rec is square. */
  imbalanceCents: number;
  /** True iff imbalanceCents == 0. */
  inBalance: boolean;
}

export function computeBankRec(rec: Pick<BankRec,
  | 'statementBalanceCents'
  | 'outstandingChecksCents'
  | 'outstandingDepositsCents'
  | 'glBalanceCents'
  | 'adjustments'>): BankRecComputation {
  const adjustedBankBalanceCents =
    rec.statementBalanceCents - rec.outstandingChecksCents + rec.outstandingDepositsCents;
  const adjustedGlBalanceCents =
    rec.glBalanceCents + signedAdjustmentNetCents(rec.adjustments);
  const imbalanceCents = adjustedBankBalanceCents - adjustedGlBalanceCents;
  return {
    adjustedBankBalanceCents,
    adjustedGlBalanceCents,
    imbalanceCents,
    inBalance: imbalanceCents === 0,
  };
}

export interface BankRecRollup {
  total: number;
  draft: number;
  reconciled: number;
  voided: number;
  /** Most recent reconciled statement date. */
  lastReconciledOn: string | null;
}

export function computeBankRecRollup(recs: BankRec[]): BankRecRollup {
  let draft = 0;
  let reconciled = 0;
  let voided = 0;
  let lastReconciledOn: string | null = null;
  for (const r of recs) {
    if (r.status === 'DRAFT') draft += 1;
    else if (r.status === 'RECONCILED') {
      reconciled += 1;
      if (!lastReconciledOn || r.statementDate > lastReconciledOn) {
        lastReconciledOn = r.statementDate;
      }
    } else if (r.status === 'VOIDED') voided += 1;
  }
  return {
    total: recs.length,
    draft,
    reconciled,
    voided,
    lastReconciledOn,
  };
}

export function newBankRecId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `bnk-${hex.padStart(8, '0')}`;
}
