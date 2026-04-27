// Change-order density per job.
//
// Plain English: a job that has 10 executed change orders worth 35%
// of the original contract is wildly different from one with zero
// COs. CO density signals one of two things:
//   - the plans were bad / scope was a moving target (legitimate)
//   - YGE is bidding low and recovering on COs (risky if the
//     agency notices the pattern)
//
// Either way, the office wants the heatmap. This walks the
// change-order history per job and rolls up:
//   - count of executed + pending COs
//   - total $ impact (executed only)
//   - same as a % of original contract
//   - reason mix (RFI_RESPONSE, DESIGN_REVISION, etc.)
//
// Pure derivation. No persisted records.

import type {
  ChangeOrder,
  ChangeOrderReason,
  ChangeOrderStatus,
} from './change-order';
import type { Job } from './job';

export type CoDensityFlag =
  | 'CLEAN'        // executed CO impact <5% of contract
  | 'NORMAL'       // 5-15%
  | 'HIGH'         // 15-30%
  | 'EXTREME';     // 30%+

export interface CoDensityRow {
  jobId: string;
  projectName: string;
  originalContractCents: number;
  executedCount: number;
  pendingCount: number;
  /** Sum of |totalCostImpactCents| across EXECUTED only. */
  executedImpactCents: number;
  /** Sum of |totalCostImpactCents| across open (PROPOSED / AGENCY_REVIEW
   *  / APPROVED) — money in flight. */
  openImpactCents: number;
  /** executedImpact / originalContract. 0..N. */
  executedImpactPct: number;
  /** Sum of totalScheduleImpactDays across EXECUTED. */
  scheduleImpactDays: number;
  /** Reason mix among executed COs (top 3 by count). */
  topReasons: Array<{ reason: ChangeOrderReason; count: number }>;
  flag: CoDensityFlag;
}

export interface CoDensityRollup {
  jobs: number;
  totalExecutedCount: number;
  totalExecutedImpactCents: number;
  /** Jobs with executed-impact-pct >= 0.15 (HIGH+EXTREME). */
  highImpactJobs: number;
}

export interface CoDensityInputs {
  jobs: Pick<Job, 'id' | 'projectName'>[];
  changeOrders: ChangeOrder[];
  /** Original contract value per job, cents. */
  originalContractByJobId: Map<string, number>;
}

export function buildCoDensity(inputs: CoDensityInputs): {
  rollup: CoDensityRollup;
  rows: CoDensityRow[];
} {
  const byJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    const list = byJob.get(co.jobId) ?? [];
    list.push(co);
    byJob.set(co.jobId, list);
  }

  const rows: CoDensityRow[] = [];
  let totalExecutedCount = 0;
  let totalExecutedImpactCents = 0;
  let highImpactJobs = 0;

  for (const j of inputs.jobs) {
    const cos = byJob.get(j.id) ?? [];
    const original = inputs.originalContractByJobId.get(j.id) ?? 0;

    let executedCount = 0;
    let pendingCount = 0;
    let executedImpact = 0;
    let openImpact = 0;
    let scheduleDays = 0;
    const reasonCounts = new Map<ChangeOrderReason, number>();

    for (const co of cos) {
      const open = isOpen(co.status);
      const executed = co.status === 'EXECUTED';
      const impact = Math.abs(co.totalCostImpactCents);

      if (executed) {
        executedCount += 1;
        executedImpact += impact;
        scheduleDays += co.totalScheduleImpactDays;
        reasonCounts.set(co.reason, (reasonCounts.get(co.reason) ?? 0) + 1);
      } else if (open) {
        pendingCount += 1;
        openImpact += impact;
      }
    }

    const pct = original === 0 ? 0 : executedImpact / original;
    let flag: CoDensityFlag;
    if (pct < 0.05) flag = 'CLEAN';
    else if (pct < 0.15) flag = 'NORMAL';
    else if (pct < 0.30) flag = 'HIGH';
    else flag = 'EXTREME';

    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      originalContractCents: original,
      executedCount,
      pendingCount,
      executedImpactCents: executedImpact,
      openImpactCents: openImpact,
      executedImpactPct: round4(pct),
      scheduleImpactDays: scheduleDays,
      topReasons,
      flag,
    });

    totalExecutedCount += executedCount;
    totalExecutedImpactCents += executedImpact;
    if (flag === 'HIGH' || flag === 'EXTREME') highImpactJobs += 1;
  }

  // Highest impact pct first.
  rows.sort((a, b) => b.executedImpactPct - a.executedImpactPct);

  return {
    rollup: {
      jobs: rows.length,
      totalExecutedCount,
      totalExecutedImpactCents,
      highImpactJobs,
    },
    rows,
  };
}

function isOpen(s: ChangeOrderStatus): boolean {
  return s === 'PROPOSED' || s === 'AGENCY_REVIEW' || s === 'APPROVED';
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
