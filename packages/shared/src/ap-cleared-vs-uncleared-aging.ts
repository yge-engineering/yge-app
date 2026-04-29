// AP payment cleared vs uncleared aging.
//
// Plain English: every AP payment lives in two states for cash
// purposes — uncleared (check still in the mail / ACH still
// pending) and cleared (bank has it). This rolls non-voided AP
// payments into a uncleared-aging snapshot — how long has each
// uncleared payment been sitting? Catches stale checks before
// they age into a stop-payment situation.
//
// Per row: bucket (CURRENT / 1_15 / 16_30 / 31_60 / 60_PLUS),
// uncleared count + cents, cleared count + cents (snapshot).
// Sort: CURRENT → 1_15 → ... → 60_PLUS.
//
// Different from ap-aging-summary (open invoice aging), and
// ap-payment-monthly (per-month volume).
//
// Pure derivation. No persisted records.

import type { ApPayment } from './ap-payment';

export type StaleAgingBucket = 'CURRENT' | 'PAST_1_15' | 'PAST_16_30' | 'PAST_31_60' | 'PAST_60_PLUS';

export interface ApClearedVsUnclearedRow {
  bucket: StaleAgingBucket;
  label: string;
  unclearedCount: number;
  unclearedCents: number;
  clearedCount: number;
  clearedCents: number;
}

export interface ApClearedVsUnclearedRollup {
  paymentsConsidered: number;
  totalUnclearedCents: number;
  totalClearedCents: number;
  voidedSkipped: number;
}

export interface ApClearedVsUnclearedInputs {
  apPayments: ApPayment[];
  /** Reference yyyy-mm-dd. Defaults to today. */
  asOf?: string;
}

const ORDER: StaleAgingBucket[] = ['CURRENT', 'PAST_1_15', 'PAST_16_30', 'PAST_31_60', 'PAST_60_PLUS'];
const LABELS: Record<StaleAgingBucket, string> = {
  CURRENT: 'Current',
  PAST_1_15: '1 – 15 days',
  PAST_16_30: '16 – 30 days',
  PAST_31_60: '31 – 60 days',
  PAST_60_PLUS: '60+ days',
};

export function buildApClearedVsUnclearedAging(
  inputs: ApClearedVsUnclearedInputs,
): {
  rollup: ApClearedVsUnclearedRollup;
  rows: ApClearedVsUnclearedRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');

  type Acc = {
    unclearedCount: number;
    unclearedCents: number;
    clearedCount: number;
    clearedCents: number;
  };
  const accs = new Map<StaleAgingBucket, Acc>();
  for (const b of ORDER) accs.set(b, {
    unclearedCount: 0,
    unclearedCents: 0,
    clearedCount: 0,
    clearedCents: 0,
  });
  let voidedSkipped = 0;
  let paymentsConsidered = 0;

  for (const p of inputs.apPayments) {
    if (p.voided) {
      voidedSkipped += 1;
      continue;
    }
    paymentsConsidered += 1;
    const refMs = Date.parse(p.paidOn + 'T00:00:00Z');
    const days = Math.floor((asOfMs - refMs) / 86_400_000);
    const bucket = bucketize(days);
    const acc = accs.get(bucket)!;
    if (p.cleared) {
      acc.clearedCount += 1;
      acc.clearedCents += p.amountCents;
    } else {
      acc.unclearedCount += 1;
      acc.unclearedCents += p.amountCents;
    }
  }

  const rows: ApClearedVsUnclearedRow[] = [];
  let totalUncleared = 0;
  let totalCleared = 0;
  for (const bucket of ORDER) {
    const acc = accs.get(bucket);
    if (!acc) continue;
    rows.push({
      bucket,
      label: LABELS[bucket],
      unclearedCount: acc.unclearedCount,
      unclearedCents: acc.unclearedCents,
      clearedCount: acc.clearedCount,
      clearedCents: acc.clearedCents,
    });
    totalUncleared += acc.unclearedCents;
    totalCleared += acc.clearedCents;
  }

  return {
    rollup: {
      paymentsConsidered,
      totalUnclearedCents: totalUncleared,
      totalClearedCents: totalCleared,
      voidedSkipped,
    },
    rows,
  };
}

function bucketize(days: number): StaleAgingBucket {
  if (days <= 0) return 'CURRENT';
  if (days <= 15) return 'PAST_1_15';
  if (days <= 30) return 'PAST_16_30';
  if (days <= 60) return 'PAST_31_60';
  return 'PAST_60_PLUS';
}
