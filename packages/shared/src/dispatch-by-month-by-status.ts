// Dispatch volume by month with status mix.
//
// Plain English: bucket dispatches by yyyy-mm of scheduledFor and
// break the count down by lifecycle status (DRAFT / POSTED /
// COMPLETED / CANCELLED). Tells YGE how the dispatch board is
// flowing month over month — too many DRAFTs that never POST
// means foremen aren't getting day-of plans.
//
// Per row: month, total, draft, posted, completed, cancelled,
// distinctJobs, distinctForemen.
//
// Sort by month asc.
//
// Different from dispatch-monthly-volume (count + crew + equipment
// totals, no status mix), dispatch-utilization (cross-cut % time
// in field).
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';

export interface DispatchByMonthByStatusRow {
  month: string;
  total: number;
  draft: number;
  posted: number;
  completed: number;
  cancelled: number;
  distinctJobs: number;
  distinctForemen: number;
}

export interface DispatchByMonthByStatusRollup {
  monthsConsidered: number;
  totalDispatches: number;
  postedShare: number;
  completedShare: number;
  cancelledShare: number;
}

export interface DispatchByMonthByStatusInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive applied to scheduledFor. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDispatchByMonthByStatus(
  inputs: DispatchByMonthByStatusInputs,
): {
  rollup: DispatchByMonthByStatusRollup;
  rows: DispatchByMonthByStatusRow[];
} {
  type Acc = {
    month: string;
    total: number;
    byStatus: Record<DispatchStatus, number>;
    jobs: Set<string>;
    foremen: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalPosted = 0;
  let totalCompleted = 0;
  let totalCancelled = 0;
  let totalDispatches = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const d of inputs.dispatches) {
    const month = d.scheduledFor.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        byStatus: { DRAFT: 0, POSTED: 0, COMPLETED: 0, CANCELLED: 0 },
        jobs: new Set(),
        foremen: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    const st: DispatchStatus = d.status ?? 'DRAFT';
    a.byStatus[st] += 1;
    a.jobs.add(d.jobId);
    if (d.foremanName) a.foremen.add(d.foremanName);

    if (st === 'POSTED') totalPosted += 1;
    if (st === 'COMPLETED') totalCompleted += 1;
    if (st === 'CANCELLED') totalCancelled += 1;
    totalDispatches += 1;
  }

  const rows: DispatchByMonthByStatusRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      total: a.total,
      draft: a.byStatus.DRAFT,
      posted: a.byStatus.POSTED,
      completed: a.byStatus.COMPLETED,
      cancelled: a.byStatus.CANCELLED,
      distinctJobs: a.jobs.size,
      distinctForemen: a.foremen.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalDispatches,
      postedShare: totalDispatches > 0 ? totalPosted / totalDispatches : 0,
      completedShare: totalDispatches > 0 ? totalCompleted / totalDispatches : 0,
      cancelledShare: totalDispatches > 0 ? totalCancelled / totalDispatches : 0,
    },
    rows,
  };
}
