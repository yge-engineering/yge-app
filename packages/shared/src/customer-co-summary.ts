// Per-customer change-order summary.
//
// Plain English: every change order rolls up to a job, every job
// rolls up to an owner agency. Some customers (Caltrans D2)
// quietly add scope mid-job — every CO is a fair add and we
// charge it. Others (small county PWs) treat any CO as a
// negotiation and trim relentlessly. This rolls executed COs up
// by customer so we know who's a CO-friendly customer for next
// pursuit pricing.
//
// Per row: customerName (canonical from job.ownerAgency), jobs
// (distinct), executedCount, totalCostImpactCents (signed sum),
// totalAddsCents (positive impacts only), totalDeductsCents
// (negative impacts only, expressed positive),
// totalScheduleImpactDays.
//
// "Executed" = status APPROVED or EXECUTED.
//
// Sort by totalCostImpactCents desc.
//
// Different from contract-value-waterfall (per-job),
// co-stale-tracker (per-CO staleness), co-density (count/job),
// co-origin-monthly (by month + reason), and pco-vs-co-analysis
// (PCO → CO conversion).
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export interface CustomerCoSummaryRow {
  customerName: string;
  distinctJobs: number;
  executedCount: number;
  totalCostImpactCents: number;
  totalAddsCents: number;
  totalDeductsCents: number;
  totalScheduleImpactDays: number;
}

export interface CustomerCoSummaryRollup {
  customersConsidered: number;
  executedCount: number;
  totalCostImpactCents: number;
  totalScheduleImpactDays: number;
  unattributed: number;
}

export interface CustomerCoSummaryInputs {
  jobs: Job[];
  changeOrders: ChangeOrder[];
  /** Optional yyyy-mm-dd window applied to executedAt (or
   *  approvedAt fallback). */
  fromDate?: string;
  toDate?: string;
}

export function buildCustomerCoSummary(
  inputs: CustomerCoSummaryInputs,
): {
  rollup: CustomerCoSummaryRollup;
  rows: CustomerCoSummaryRow[];
} {
  const ownerByJob = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) ownerByJob.set(j.id, j.ownerAgency);
  }

  type Acc = {
    display: string;
    jobs: Set<string>;
    count: number;
    cost: number;
    adds: number;
    deducts: number;
    days: number;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;
  let totalCount = 0;
  let totalCost = 0;
  let totalDays = 0;

  for (const co of inputs.changeOrders) {
    if (co.status !== 'APPROVED' && co.status !== 'EXECUTED') continue;
    const ref = co.executedAt ?? co.approvedAt;
    if (inputs.fromDate && ref && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref && ref > inputs.toDate) continue;
    totalCount += 1;
    totalCost += co.totalCostImpactCents;
    totalDays += co.totalScheduleImpactDays;
    const owner = ownerByJob.get(co.jobId);
    if (!owner) {
      unattributed += 1;
      continue;
    }
    const key = canonicalize(owner);
    const acc = accs.get(key) ?? {
      display: owner,
      jobs: new Set<string>(),
      count: 0,
      cost: 0,
      adds: 0,
      deducts: 0,
      days: 0,
    };
    acc.jobs.add(co.jobId);
    acc.count += 1;
    acc.cost += co.totalCostImpactCents;
    if (co.totalCostImpactCents > 0) acc.adds += co.totalCostImpactCents;
    if (co.totalCostImpactCents < 0) acc.deducts += -co.totalCostImpactCents;
    acc.days += co.totalScheduleImpactDays;
    accs.set(key, acc);
  }

  const rows: CustomerCoSummaryRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      customerName: acc.display,
      distinctJobs: acc.jobs.size,
      executedCount: acc.count,
      totalCostImpactCents: acc.cost,
      totalAddsCents: acc.adds,
      totalDeductsCents: acc.deducts,
      totalScheduleImpactDays: acc.days,
    });
  }

  rows.sort((a, b) => b.totalCostImpactCents - a.totalCostImpactCents);

  return {
    rollup: {
      customersConsidered: rows.length,
      executedCount: totalCount,
      totalCostImpactCents: totalCost,
      totalScheduleImpactDays: totalDays,
      unattributed,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
