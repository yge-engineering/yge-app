// Per-job change-order volume by month.
//
// Plain English: bucket COs by (jobId, yyyy-mm of executedAt or
// approvedAt fallback) — count and total cost impact per pair.
// Long-format. Useful for tracing CO velocity on a single job.
//
// Per row: jobId, month, total, executedCount, approvedCount,
// proposedCount, totalCostImpactCents, totalScheduleImpactDays.
//
// Sort: jobId asc, month asc.
//
// Different from co-origin-monthly (per-month with reason axis,
// no job axis), co-density (count per job no month), job-co-
// summary (per-job rollup).
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderStatus } from './change-order';

export interface JobCoByMonthRow {
  jobId: string;
  month: string;
  total: number;
  executedCount: number;
  approvedCount: number;
  proposedCount: number;
  totalCostImpactCents: number;
  totalScheduleImpactDays: number;
}

export interface JobCoByMonthRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalCos: number;
}

export interface JobCoByMonthInputs {
  changeOrders: ChangeOrder[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobCoByMonth(
  inputs: JobCoByMonthInputs,
): {
  rollup: JobCoByMonthRollup;
  rows: JobCoByMonthRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    counts: Record<ChangeOrderStatus, number>;
    cost: number;
    days: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalCos = 0;

  for (const co of inputs.changeOrders) {
    const ref = co.executedAt ?? co.approvedAt ?? co.proposedAt ?? co.createdAt.slice(0, 10);
    const month = ref.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${co.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: co.jobId,
      month,
      counts: {
        PROPOSED: 0,
        AGENCY_REVIEW: 0,
        APPROVED: 0,
        EXECUTED: 0,
        REJECTED: 0,
        WITHDRAWN: 0,
      } as Record<ChangeOrderStatus, number>,
      cost: 0,
      days: 0,
    };
    acc.counts[co.status] = (acc.counts[co.status] ?? 0) + 1;
    if (co.status === 'EXECUTED' || co.status === 'APPROVED') {
      acc.cost += co.totalCostImpactCents;
      acc.days += co.totalScheduleImpactDays;
    }
    accs.set(key, acc);
    jobSet.add(co.jobId);
    monthSet.add(month);
    totalCos += 1;
  }

  const rows: JobCoByMonthRow[] = [];
  for (const acc of accs.values()) {
    let total = 0;
    for (const v of Object.values(acc.counts)) total += v;
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total,
      executedCount: acc.counts.EXECUTED ?? 0,
      approvedCount: acc.counts.APPROVED ?? 0,
      proposedCount: acc.counts.PROPOSED ?? 0,
      totalCostImpactCents: acc.cost,
      totalScheduleImpactDays: acc.days,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalCos,
    },
    rows,
  };
}
