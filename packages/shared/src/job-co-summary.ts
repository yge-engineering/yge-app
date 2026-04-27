// Per-job change-order summary.
//
// Plain English: contract-value-waterfall + co-density + co-stale
// each tell part of the CO story. This module is the lean one-
// row-per-job CO snapshot for the project dashboard header — the
// numbers a PM wants in a single glance:
//   - executed CO count + total $
//   - open CO count + total $ (in flight)
//   - rejected/withdrawn count
//   - net schedule days from executed COs
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderStatus } from './change-order';
import type { Job } from './job';

export interface JobCoSummaryRow {
  jobId: string;
  projectName: string;
  executedCount: number;
  executedTotalCents: number;
  openCount: number;
  openTotalCents: number;
  rejectedCount: number;
  withdrawnCount: number;
  netScheduleDaysExecuted: number;
}

export interface JobCoSummaryRollup {
  jobsConsidered: number;
  totalExecutedCount: number;
  totalExecutedCents: number;
  totalOpenCount: number;
  totalOpenCents: number;
}

export interface JobCoSummaryInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  changeOrders: ChangeOrder[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobCoSummary(inputs: JobCoSummaryInputs): {
  rollup: JobCoSummaryRollup;
  rows: JobCoSummaryRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const byJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    const list = byJob.get(co.jobId) ?? [];
    list.push(co);
    byJob.set(co.jobId, list);
  }

  const rows: JobCoSummaryRow[] = [];
  let totalExecutedCount = 0;
  let totalExecutedCents = 0;
  let totalOpenCount = 0;
  let totalOpenCents = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const cos = byJob.get(j.id) ?? [];
    let executedCount = 0;
    let executedTotal = 0;
    let openCount = 0;
    let openTotal = 0;
    let rejected = 0;
    let withdrawn = 0;
    let scheduleDays = 0;

    for (const co of cos) {
      if (co.status === 'EXECUTED') {
        executedCount += 1;
        executedTotal += co.totalCostImpactCents;
        scheduleDays += co.totalScheduleImpactDays;
      } else if (isOpen(co.status)) {
        openCount += 1;
        openTotal += co.totalCostImpactCents;
      } else if (co.status === 'REJECTED') {
        rejected += 1;
      } else if (co.status === 'WITHDRAWN') {
        withdrawn += 1;
      }
    }

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      executedCount,
      executedTotalCents: executedTotal,
      openCount,
      openTotalCents: openTotal,
      rejectedCount: rejected,
      withdrawnCount: withdrawn,
      netScheduleDaysExecuted: scheduleDays,
    });

    totalExecutedCount += executedCount;
    totalExecutedCents += executedTotal;
    totalOpenCount += openCount;
    totalOpenCents += openTotal;
  }

  // Highest open-CO dollars first (most pressing follow-up
  // exposure), tied by executed-total desc.
  rows.sort((a, b) => {
    if (a.openTotalCents !== b.openTotalCents) {
      return b.openTotalCents - a.openTotalCents;
    }
    return b.executedTotalCents - a.executedTotalCents;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalExecutedCount,
      totalExecutedCents,
      totalOpenCount,
      totalOpenCents,
    },
    rows,
  };
}

function isOpen(s: ChangeOrderStatus): boolean {
  return s === 'PROPOSED' || s === 'AGENCY_REVIEW' || s === 'APPROVED';
}
