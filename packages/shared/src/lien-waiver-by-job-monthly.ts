// Per (job, month) lien waiver rollup.
//
// Plain English: bucket lien waivers by (jobId, yyyy-mm of
// throughDate). Counts waivers, breaks down by Civil Code kind
// (§8132 / §8134 / §8136 / §8138) and by status (DRAFT / SIGNED
// / DELIVERED / VOIDED). Sums waiver paymentAmountCents.
//
// Per row: jobId, month, total, totalAmountCents, byKind,
// signedCount, deliveredCount, voidedCount.
//
// Sort: jobId asc, month asc.
//
// Different from lien-waiver-monthly (portfolio per month, no
// job axis), job-waiver-delivery-rate (per-job lifetime
// delivery rate, no month axis), customer-waiver-cadence
// (per-customer), lien-waiver-chase (per-payment chase list).
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind } from './lien-waiver';

export interface LienWaiverByJobMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  totalAmountCents: number;
  byKind: Partial<Record<LienWaiverKind, number>>;
  signedCount: number;
  deliveredCount: number;
  voidedCount: number;
}

export interface LienWaiverByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalWaivers: number;
  totalAmountCents: number;
  totalSigned: number;
  totalDelivered: number;
  totalVoided: number;
}

export interface LienWaiverByJobMonthlyInputs {
  lienWaivers: LienWaiver[];
  /** Optional yyyy-mm bounds inclusive applied to throughDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildLienWaiverByJobMonthly(
  inputs: LienWaiverByJobMonthlyInputs,
): {
  rollup: LienWaiverByJobMonthlyRollup;
  rows: LienWaiverByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    totalAmountCents: number;
    byKind: Map<LienWaiverKind, number>;
    signedCount: number;
    deliveredCount: number;
    voidedCount: number;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalWaivers = 0;
  let totalAmount = 0;
  let totalSigned = 0;
  let totalDelivered = 0;
  let totalVoided = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const w of inputs.lienWaivers) {
    const month = w.throughDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const key = `${w.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: w.jobId,
        month,
        total: 0,
        totalAmountCents: 0,
        byKind: new Map(),
        signedCount: 0,
        deliveredCount: 0,
        voidedCount: 0,
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.totalAmountCents += w.paymentAmountCents;
    a.byKind.set(w.kind, (a.byKind.get(w.kind) ?? 0) + 1);
    const status = w.status ?? 'DRAFT';
    if (status === 'SIGNED' || status === 'DELIVERED') {
      a.signedCount += 1;
      totalSigned += 1;
    }
    if (status === 'DELIVERED') {
      a.deliveredCount += 1;
      totalDelivered += 1;
    }
    if (status === 'VOIDED') {
      a.voidedCount += 1;
      totalVoided += 1;
    }

    jobs.add(w.jobId);
    months.add(month);
    totalWaivers += 1;
    totalAmount += w.paymentAmountCents;
  }

  const rows: LienWaiverByJobMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byKind: Partial<Record<LienWaiverKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return {
        jobId: a.jobId,
        month: a.month,
        total: a.total,
        totalAmountCents: a.totalAmountCents,
        byKind,
        signedCount: a.signedCount,
        deliveredCount: a.deliveredCount,
        voidedCount: a.voidedCount,
      };
    })
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalWaivers,
      totalAmountCents: totalAmount,
      totalSigned,
      totalDelivered,
      totalVoided,
    },
    rows,
  };
}
