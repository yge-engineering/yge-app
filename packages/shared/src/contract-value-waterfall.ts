// Job contract value waterfall.
//
// Plain English: every job has an original contract value. Executed
// change orders add (or sometimes subtract) from that. Open COs
// (PROPOSED, AGENCY_REVIEW, APPROVED) represent dollars in flight —
// money YGE expects to capture if the agency executes them.
//
// This module rolls each active job into a four-line waterfall:
//   original  →  executed adds  →  current value  →  open upside
//                                                  →  potential value
//
// Drives the "what's this job worth, today and at full conversion?"
// view in Brook's portfolio dashboard.
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderStatus } from './change-order';
import type { Job } from './job';

export interface ContractWaterfallRow {
  jobId: string;
  projectName: string;
  originalContractCents: number;
  /** Sum of totalCostImpactCents across EXECUTED COs (signed). */
  executedAddsCents: number;
  /** original + executedAdds. */
  currentContractCents: number;
  /** Sum of totalCostImpactCents across PROPOSED + AGENCY_REVIEW +
   *  APPROVED COs (signed). */
  openCoUpsideCents: number;
  /** current + open. The "if everything lands" ceiling. */
  potentialContractCents: number;
  /** openUpside / current. Hint at how much of the value is still
   *  in flight. 0 when current contract is 0. */
  openUpsidePct: number;
  /** Counts of each CO bucket so the row tells the story. */
  executedCoCount: number;
  openCoCount: number;
  /** Net schedule days added across executed COs. */
  netScheduleDaysAdded: number;
}

export interface ContractWaterfallRollup {
  jobs: number;
  totalOriginalCents: number;
  totalExecutedAddsCents: number;
  totalCurrentCents: number;
  totalOpenUpsideCents: number;
  totalPotentialCents: number;
}

export interface ContractWaterfallInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  changeOrders: ChangeOrder[];
  /** Original contract value per job, cents. */
  originalContractByJobId: Map<string, number>;
  /** When false (default), only includes AWARDED jobs. */
  includeAllStatuses?: boolean;
}

export function buildContractWaterfall(inputs: ContractWaterfallInputs): {
  rollup: ContractWaterfallRollup;
  rows: ContractWaterfallRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }

  const rows: ContractWaterfallRow[] = [];
  let totalOriginal = 0;
  let totalExecutedAdds = 0;
  let totalCurrent = 0;
  let totalOpenUpside = 0;
  let totalPotential = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;

    const original = inputs.originalContractByJobId.get(j.id) ?? 0;
    const cos = cosByJob.get(j.id) ?? [];
    let executedAdds = 0;
    let openUpside = 0;
    let executedCount = 0;
    let openCount = 0;
    let scheduleDays = 0;

    for (const co of cos) {
      if (co.status === 'EXECUTED') {
        executedAdds += co.totalCostImpactCents;
        executedCount += 1;
        scheduleDays += co.totalScheduleImpactDays;
      } else if (isOpen(co.status)) {
        openUpside += co.totalCostImpactCents;
        openCount += 1;
      }
    }

    const current = original + executedAdds;
    const potential = current + openUpside;
    const openUpsidePct = current === 0 ? 0 : round4(openUpside / current);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      originalContractCents: original,
      executedAddsCents: executedAdds,
      currentContractCents: current,
      openCoUpsideCents: openUpside,
      potentialContractCents: potential,
      openUpsidePct,
      executedCoCount: executedCount,
      openCoCount: openCount,
      netScheduleDaysAdded: scheduleDays,
    });

    totalOriginal += original;
    totalExecutedAdds += executedAdds;
    totalCurrent += current;
    totalOpenUpside += openUpside;
    totalPotential += potential;
  }

  // Highest current contract first.
  rows.sort((a, b) => b.currentContractCents - a.currentContractCents);

  return {
    rollup: {
      jobs: rows.length,
      totalOriginalCents: totalOriginal,
      totalExecutedAddsCents: totalExecutedAdds,
      totalCurrentCents: totalCurrent,
      totalOpenUpsideCents: totalOpenUpside,
      totalPotentialCents: totalPotential,
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
