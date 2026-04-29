// Lien waiver volume by month.
//
// Plain English: bucket lien waivers by yyyy-mm of throughDate
// and break down by Civil Code form kind (§8132 conditional
// progress / §8134 unconditional progress / §8136 conditional
// final / §8138 unconditional final). Tracks signing + delivery
// completion. Useful for the AR review — every payment we accept
// should have a matching waiver delivered downstream.
//
// Per row: month, total, conditionalProgress, unconditionalProgress,
// conditionalFinal, unconditionalFinal, signedCount,
// deliveredCount, totalAmountCents, distinctJobs.
//
// Sort by month asc.
//
// Different from lien-waiver-chase (chase list per AR payment),
// customer-waiver-cadence (per-customer cadence),
// job-waiver-delivery-rate (per-job delivery rate).
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind } from './lien-waiver';

export interface LienWaiverMonthlyRow {
  month: string;
  total: number;
  conditionalProgress: number;
  unconditionalProgress: number;
  conditionalFinal: number;
  unconditionalFinal: number;
  signedCount: number;
  deliveredCount: number;
  voidedCount: number;
  totalAmountCents: number;
  distinctJobs: number;
}

export interface LienWaiverMonthlyRollup {
  monthsConsidered: number;
  totalWaivers: number;
  totalDelivered: number;
  totalAmountCents: number;
}

export interface LienWaiverMonthlyInputs {
  lienWaivers: LienWaiver[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildLienWaiverMonthly(
  inputs: LienWaiverMonthlyInputs,
): {
  rollup: LienWaiverMonthlyRollup;
  rows: LienWaiverMonthlyRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<LienWaiverKind, number>;
    signed: number;
    delivered: number;
    voided: number;
    amount: number;
    jobs: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: {
      CONDITIONAL_PROGRESS: 0,
      UNCONDITIONAL_PROGRESS: 0,
      CONDITIONAL_FINAL: 0,
      UNCONDITIONAL_FINAL: 0,
    },
    signed: 0,
    delivered: 0,
    voided: 0,
    amount: 0,
    jobs: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const w of inputs.lienWaivers) {
    const month = w.throughDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[w.kind] += 1;
    if (w.status === 'SIGNED' || w.status === 'DELIVERED') b.signed += 1;
    if (w.status === 'DELIVERED') b.delivered += 1;
    if (w.status === 'VOIDED') b.voided += 1;
    b.amount += w.paymentAmountCents;
    b.jobs.add(w.jobId);
    buckets.set(month, b);
  }

  const rows: LienWaiverMonthlyRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        conditionalProgress: b.counts.CONDITIONAL_PROGRESS,
        unconditionalProgress: b.counts.UNCONDITIONAL_PROGRESS,
        conditionalFinal: b.counts.CONDITIONAL_FINAL,
        unconditionalFinal: b.counts.UNCONDITIONAL_FINAL,
        signedCount: b.signed,
        deliveredCount: b.delivered,
        voidedCount: b.voided,
        totalAmountCents: b.amount,
        distinctJobs: b.jobs.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let totalWaivers = 0;
  let totalDelivered = 0;
  let totalAmount = 0;
  for (const r of rows) {
    totalWaivers += r.total;
    totalDelivered += r.deliveredCount;
    totalAmount += r.totalAmountCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalWaivers,
      totalDelivered,
      totalAmountCents: totalAmount,
    },
    rows,
  };
}
