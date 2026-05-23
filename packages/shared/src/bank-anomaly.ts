// Bank transaction anomaly detector.
//
// Scans a list of cleared bank transactions (typically from an OFX import
// or a future Plaid pull) and returns flags for things a bookkeeper
// should hand-review before the next reconciliation:
//
//   DUPLICATE_CHARGE       — same vendor + amount + within N days.
//   FEE_INCREASE           — recurring bank fee whose amount went up.
//   UNUSUAL_AMOUNT         — vendor's spend > 3σ above their own mean.
//   LARGE_ROUND_CHECK      — debit in round thousands above a threshold
//                            (often a fraud signature on hand-written
//                            check kits).
//   NEW_VENDOR_LARGE       — debit to a merchant not in the known list +
//                            amount over threshold.
//   WEEKEND_LARGE_DEBIT    — large debit posted Sat/Sun (a real bank
//                            transaction wouldn't post then; ACH and card
//                            fraud do).
//
// All thresholds are constants at the top of the file so a future bundle
// can promote them to per-company settings. Pure: no DB, no clock.
// Caller supplies the transaction list and the "today" date.

import { z } from 'zod';
import type { OfxTransaction } from './ofx-parser';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const BankTxnTypeSchema = z.enum(['DEBIT', 'CREDIT']);
export type BankTxnType = z.infer<typeof BankTxnTypeSchema>;

export const BankTransactionSchema = z.object({
  /** Stable id from the bank/import — used to reference back. */
  id: z.string().min(1),
  /** Posting date, yyyy-mm-dd. */
  postedOn: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  /** Merchant / payee name as it appeared on the statement, normalized. */
  merchant: z.string().min(1).max(300),
  /** Positive cents. Sign is carried by `type`. */
  amountCents: z.number().int().nonnegative(),
  type: BankTxnTypeSchema,
});
export type BankTransaction = z.infer<typeof BankTransactionSchema>;

export const BankAnomalyCodeSchema = z.enum([
  'DUPLICATE_CHARGE',
  'FEE_INCREASE',
  'UNUSUAL_AMOUNT',
  'LARGE_ROUND_CHECK',
  'NEW_VENDOR_LARGE',
  'WEEKEND_LARGE_DEBIT',
]);
export type BankAnomalyCode = z.infer<typeof BankAnomalyCodeSchema>;

export const BankAnomalySeveritySchema = z.enum(['info', 'warn', 'critical']);
export type BankAnomalySeverity = z.infer<typeof BankAnomalySeveritySchema>;

export interface BankAnomaly {
  code: BankAnomalyCode;
  severity: BankAnomalySeverity;
  /** Transactions involved (1+, in order). */
  transactionIds: string[];
  /** Human-readable summary, plain English. */
  message: string;
}

export interface BankAnomalyScanOptions {
  /** Optional list of known/approved merchant strings (case-insensitive,
   *  exact match). When omitted the NEW_VENDOR_LARGE rule is skipped. */
  knownMerchants?: string[];
  /** Date the bookkeeper is reviewing (yyyy-mm-dd). Only used for the
   *  "duplicate within window" lookback. */
  asOfDate: string;
}

// ---- Thresholds (cents / counts / days). Tuned for a small contractor. ----
const DUPLICATE_WINDOW_DAYS = 3;
const FEE_MERCHANT_HINTS = ['service charge', 'overdraft', 'wire fee', 'monthly fee', 'maintenance fee'];
const UNUSUAL_AMOUNT_SIGMA = 3;
const UNUSUAL_AMOUNT_MIN_HISTORY = 3; // need at least this many prior tx to compute σ
const LARGE_ROUND_CHECK_MIN_CENTS = 5_000_00; // $5k
const NEW_VENDOR_LARGE_MIN_CENTS = 2_500_00;  // $2.5k
const WEEKEND_LARGE_DEBIT_MIN_CENTS = 5_000_00; // $5k

/** Run all rules. Returns a flat list of anomalies. Caller is free to
 *  sort/group/deduplicate by transactionIds. */
export function scanForAnomalies(
  txns: BankTransaction[],
  opts: BankAnomalyScanOptions,
): BankAnomaly[] {
  const out: BankAnomaly[] = [];
  out.push(...findDuplicateCharges(txns));
  out.push(...findFeeIncreases(txns));
  out.push(...findUnusualAmounts(txns));
  out.push(...findLargeRoundChecks(txns));
  out.push(...findWeekendLargeDebits(txns));
  if (opts.knownMerchants) {
    out.push(...findNewVendorLarge(txns, opts.knownMerchants));
  }
  return out;
}

// ---- Rule implementations (each exported for unit testing in isolation). ----

export function findDuplicateCharges(txns: BankTransaction[]): BankAnomaly[] {
  const out: BankAnomaly[] = [];
  const debits = txns.filter((t) => t.type === 'DEBIT');
  for (let i = 0; i < debits.length; i++) {
    const a = debits[i]!;
    for (let j = i + 1; j < debits.length; j++) {
      const b = debits[j]!;
      if (a.merchant.trim().toLowerCase() !== b.merchant.trim().toLowerCase()) continue;
      if (a.amountCents !== b.amountCents) continue;
      const days = Math.abs(daysBetween(a.postedOn, b.postedOn));
      if (days <= DUPLICATE_WINDOW_DAYS) {
        out.push({
          code: 'DUPLICATE_CHARGE',
          severity: 'warn',
          transactionIds: [a.id, b.id],
          message: `Possible duplicate charge: ${a.merchant} for $${cents$(a.amountCents)} on ${a.postedOn} and ${b.postedOn} (${days} day${days === 1 ? '' : 's'} apart).`,
        });
      }
    }
  }
  return out;
}

export function findFeeIncreases(txns: BankTransaction[]): BankAnomaly[] {
  const out: BankAnomaly[] = [];
  const fees = txns.filter(
    (t) =>
      t.type === 'DEBIT' &&
      FEE_MERCHANT_HINTS.some((h) => t.merchant.toLowerCase().includes(h)),
  );
  // Group by merchant and sort by date.
  const byMerchant = new Map<string, BankTransaction[]>();
  for (const t of fees) {
    const key = t.merchant.trim().toLowerCase();
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }
  for (const list of byMerchant.values()) {
    list.sort((a, b) => a.postedOn.localeCompare(b.postedOn));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const curr = list[i]!;
      if (curr.amountCents > prev.amountCents) {
        out.push({
          code: 'FEE_INCREASE',
          severity: 'info',
          transactionIds: [prev.id, curr.id],
          message: `${curr.merchant} fee rose from $${cents$(prev.amountCents)} on ${prev.postedOn} to $${cents$(curr.amountCents)} on ${curr.postedOn}.`,
        });
      }
    }
  }
  return out;
}

export function findUnusualAmounts(txns: BankTransaction[]): BankAnomaly[] {
  const out: BankAnomaly[] = [];
  const byMerchant = new Map<string, BankTransaction[]>();
  for (const t of txns) {
    if (t.type !== 'DEBIT') continue;
    const key = t.merchant.trim().toLowerCase();
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }
  for (const list of byMerchant.values()) {
    if (list.length < UNUSUAL_AMOUNT_MIN_HISTORY + 1) continue;
    list.sort((a, b) => a.postedOn.localeCompare(b.postedOn));
    // For each tx, use the PRIOR ones as history (no peeking forward).
    for (let i = UNUSUAL_AMOUNT_MIN_HISTORY; i < list.length; i++) {
      const history = list.slice(0, i).map((t) => t.amountCents);
      const mean = history.reduce((s, n) => s + n, 0) / history.length;
      const variance =
        history.reduce((s, n) => s + (n - mean) * (n - mean), 0) / history.length;
      const sigma = Math.sqrt(variance);
      const t = list[i]!;
      if (sigma > 0 && t.amountCents - mean > UNUSUAL_AMOUNT_SIGMA * sigma) {
        out.push({
          code: 'UNUSUAL_AMOUNT',
          severity: 'warn',
          transactionIds: [t.id],
          message: `${t.merchant} charged $${cents$(t.amountCents)} on ${t.postedOn}; their prior average was $${cents$(Math.round(mean))} (this is ${UNUSUAL_AMOUNT_SIGMA}σ above).`,
        });
      }
    }
  }
  return out;
}

export function findLargeRoundChecks(txns: BankTransaction[]): BankAnomaly[] {
  return txns
    .filter(
      (t) =>
        t.type === 'DEBIT' &&
        t.amountCents >= LARGE_ROUND_CHECK_MIN_CENTS &&
        t.amountCents % 100_00 === 0,
    )
    .map((t) => ({
      code: 'LARGE_ROUND_CHECK' as const,
      severity: 'info' as const,
      transactionIds: [t.id],
      message: `Large round-number debit: ${t.merchant} $${cents$(t.amountCents)} on ${t.postedOn}. Worth verifying against an approval.`,
    }));
}

export function findNewVendorLarge(
  txns: BankTransaction[],
  knownMerchants: string[],
): BankAnomaly[] {
  const known = new Set(knownMerchants.map((s) => s.trim().toLowerCase()));
  return txns
    .filter(
      (t) =>
        t.type === 'DEBIT' &&
        t.amountCents >= NEW_VENDOR_LARGE_MIN_CENTS &&
        !known.has(t.merchant.trim().toLowerCase()),
    )
    .map((t) => ({
      code: 'NEW_VENDOR_LARGE' as const,
      severity: 'warn' as const,
      transactionIds: [t.id],
      message: `New / unknown vendor over $${cents$(NEW_VENDOR_LARGE_MIN_CENTS)}: ${t.merchant} for $${cents$(t.amountCents)} on ${t.postedOn}.`,
    }));
}

export function findWeekendLargeDebits(txns: BankTransaction[]): BankAnomaly[] {
  return txns
    .filter(
      (t) =>
        t.type === 'DEBIT' &&
        t.amountCents >= WEEKEND_LARGE_DEBIT_MIN_CENTS &&
        isWeekend(t.postedOn),
    )
    .map((t) => ({
      code: 'WEEKEND_LARGE_DEBIT' as const,
      severity: 'critical' as const,
      transactionIds: [t.id],
      message: `Large debit posted on a weekend: ${t.merchant} $${cents$(t.amountCents)} on ${t.postedOn}. Legitimate ACH/checks usually post on business days only.`,
    }));
}

// ---- Helpers ----

function daysBetween(a: string, b: string): number {
  const A = parseIso(a);
  const B = parseIso(b);
  return Math.floor((B - A) / (1000 * 60 * 60 * 24));
}

function parseIso(s: string): number {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
}

function isWeekend(iso: string): boolean {
  const d = new Date(parseIso(iso));
  const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
  return dow === 0 || dow === 6;
}

function cents$(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---- OFX adapter --------------------------------------------------------

/** Convert one OFX-parser transaction into the scanner's input shape.
 *  OFX uses a signed `amountCents` (negative = debit); the scanner uses
 *  positive cents + an explicit `type`. */
export function bankTransactionFromOfx(
  t: OfxTransaction,
  fallbackIdx: number,
): BankTransaction {
  return {
    id: t.fitId ?? `ofx-${fallbackIdx}`,
    postedOn: t.date,
    merchant: t.description.trim() || '(no description)',
    amountCents: Math.abs(t.amountCents),
    type: t.amountCents < 0 ? 'DEBIT' : 'CREDIT',
  };
}

/** Bulk OFX → scanner conversion. Stable index used for fallback ids. */
export function bankTransactionsFromOfx(
  txns: readonly OfxTransaction[],
): BankTransaction[] {
  return txns.map((t, i) => bankTransactionFromOfx(t, i));
}
