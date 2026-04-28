// Per-job change-order approval rate.
//
// Plain English: out of all the COs we propose on a job, what
// share reach APPROVED or EXECUTED? Low rates mean either the
// agency is rejecting our scope arguments, or we're proposing
// too many speculative COs that get withdrawn / rejected. High
// rates mean our paper trail (RFI → PCO → CO) is solid.
//
// Per AWARDED job:
//   - proposedCount: total CO records (all statuses)
//   - approvedCount: APPROVED + EXECUTED
//   - rejectedCount, withdrawnCount, agencyReviewCount
//   - approvalRate (0..1): approved / proposed
//   - approvedDollarImpactCents: sum on approved + executed
//   - flag tier: STRONG / OK / WEAK / POOR
//
// Different from co-density (jobs/COs ratio), pco-vs-co-analysis
// (PCO → CO conversion), and bid-to-award-variance (bid number
// vs awarded number). This is the per-job "do our CO proposals
// stick?" view.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export type JobCoWinFlag = 'STRONG' | 'OK' | 'WEAK' | 'POOR';

export interface JobCoWinRateRow {
  jobId: string;
  projectName: string;
  proposedCount: number;
  approvedCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  agencyReviewCount: number;
  /** approvedCount / proposedCount. 0 when proposedCount is 0. */
  approvalRate: number;
  approvedDollarImpactCents: number;
  flag: JobCoWinFlag;
}

export interface JobCoWinRateRollup {
  jobsConsidered: number;
  totalProposed: number;
  totalApproved: number;
  /** Blended approval rate across the portfolio. */
  blendedApprovalRate: number;
  strong: number;
  ok: number;
  weak: number;
  poor: number;
}

export interface JobCoWinRateInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  changeOrders: ChangeOrder[];
  /** Default false — only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
  /** Minimum proposed COs before scoring. Below this, the row is
   *  always tier OK (small samples are noisy). Default 3. */
  minProposedForFlag?: number;
}

export function buildJobCoWinRate(inputs: JobCoWinRateInputs): {
  rollup: JobCoWinRateRollup;
  rows: JobCoWinRateRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const minN = inputs.minProposedForFlag ?? 3;

  // Bucket COs by jobId.
  const cosByJob = new Map<string, ChangeOrder[]>();
  for (const co of inputs.changeOrders) {
    const list = cosByJob.get(co.jobId) ?? [];
    list.push(co);
    cosByJob.set(co.jobId, list);
  }

  let totalProposed = 0;
  let totalApproved = 0;
  let strong = 0;
  let ok = 0;
  let weak = 0;
  let poor = 0;

  const rows: JobCoWinRateRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const cos = cosByJob.get(j.id) ?? [];

    let approved = 0;
    let rejected = 0;
    let withdrawn = 0;
    let agencyReview = 0;
    let approvedDollar = 0;

    for (const co of cos) {
      if (co.status === 'APPROVED' || co.status === 'EXECUTED') {
        approved += 1;
        approvedDollar += co.totalCostImpactCents;
      } else if (co.status === 'REJECTED') {
        rejected += 1;
      } else if (co.status === 'WITHDRAWN') {
        withdrawn += 1;
      } else if (co.status === 'AGENCY_REVIEW') {
        agencyReview += 1;
      }
    }

    const proposed = cos.length;
    const rate = proposed === 0 ? 0 : approved / proposed;
    const flag = scoreFlag(rate, proposed, minN);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      proposedCount: proposed,
      approvedCount: approved,
      rejectedCount: rejected,
      withdrawnCount: withdrawn,
      agencyReviewCount: agencyReview,
      approvalRate: round4(rate),
      approvedDollarImpactCents: approvedDollar,
      flag,
    });

    totalProposed += proposed;
    totalApproved += approved;
    if (flag === 'STRONG') strong += 1;
    else if (flag === 'OK') ok += 1;
    else if (flag === 'WEAK') weak += 1;
    else poor += 1;
  }

  // Sort: lowest approval rate first (most attention-needed), then
  // by proposedCount desc (bigger samples first within the same rate).
  rows.sort((a, b) => {
    if (a.approvalRate !== b.approvalRate) return a.approvalRate - b.approvalRate;
    return b.proposedCount - a.proposedCount;
  });

  const blended = totalProposed === 0 ? 0 : round4(totalApproved / totalProposed);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalProposed,
      totalApproved,
      blendedApprovalRate: blended,
      strong,
      ok,
      weak,
      poor,
    },
    rows,
  };
}

function scoreFlag(rate: number, proposed: number, minN: number): JobCoWinFlag {
  if (proposed < minN) return 'OK'; // small sample, don't shame
  if (rate >= 0.8) return 'STRONG';
  if (rate >= 0.5) return 'OK';
  if (rate >= 0.25) return 'WEAK';
  return 'POOR';
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
