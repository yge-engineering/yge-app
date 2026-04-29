// Portfolio lien waiver activity by month with kind + status mix.
//
// Plain English: per yyyy-mm of throughDate, count lien waivers
// by Civil Code kind (§8132 / §8134 / §8136 / §8138), status
// (DRAFT / SIGNED / DELIVERED / VOIDED), sum payment amount
// cents, distinct jobs.
//
// Per row: month, total, totalAmountCents, byKind, signedCount,
// deliveredCount, voidedCount, distinctJobs.
//
// Sort: month asc.
//
// Different from lien-waiver-monthly (no signed/delivered/
// voided counts), lien-waiver-by-job-monthly (per job),
// lien-waiver-chase (chase list).
//
// Pure derivation. No persisted records.

import type { LienWaiver, LienWaiverKind } from './lien-waiver';

export interface PortfolioLienWaiverMonthlyRow {
  month: string;
  total: number;
  totalAmountCents: number;
  byKind: Partial<Record<LienWaiverKind, number>>;
  signedCount: number;
  deliveredCount: number;
  voidedCount: number;
  distinctJobs: number;
}

export interface PortfolioLienWaiverMonthlyRollup {
  monthsConsidered: number;
  totalWaivers: number;
  totalAmountCents: number;
}

export interface PortfolioLienWaiverMonthlyInputs {
  lienWaivers: LienWaiver[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioLienWaiverMonthly(
  inputs: PortfolioLienWaiverMonthlyInputs,
): {
  rollup: PortfolioLienWaiverMonthlyRollup;
  rows: PortfolioLienWaiverMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    totalAmountCents: number;
    byKind: Map<LienWaiverKind, number>;
    signedCount: number;
    deliveredCount: number;
    voidedCount: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalWaivers = 0;
  let totalAmount = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const w of inputs.lienWaivers) {
    const month = w.throughDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        totalAmountCents: 0,
        byKind: new Map(),
        signedCount: 0,
        deliveredCount: 0,
        voidedCount: 0,
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    a.totalAmountCents += w.paymentAmountCents;
    a.byKind.set(w.kind, (a.byKind.get(w.kind) ?? 0) + 1);
    const status = w.status ?? 'DRAFT';
    if (status === 'SIGNED' || status === 'DELIVERED') a.signedCount += 1;
    if (status === 'DELIVERED') a.deliveredCount += 1;
    if (status === 'VOIDED') a.voidedCount += 1;
    a.jobs.add(w.jobId);

    totalWaivers += 1;
    totalAmount += w.paymentAmountCents;
  }

  const rows: PortfolioLienWaiverMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byKind: Partial<Record<LienWaiverKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return {
        month: a.month,
        total: a.total,
        totalAmountCents: a.totalAmountCents,
        byKind,
        signedCount: a.signedCount,
        deliveredCount: a.deliveredCount,
        voidedCount: a.voidedCount,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalWaivers,
      totalAmountCents: totalAmount,
    },
    rows,
  };
}
