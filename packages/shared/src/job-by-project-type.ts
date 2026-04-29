// Jobs by project type with win rate.
//
// Plain English: roll the Job table up by ProjectType
// (ROAD_RECONSTRUCTION / DRAINAGE / BRIDGE / GRADING /
// FIRE_FUEL_REDUCTION / OTHER), with status mix per type.
// Computes a win rate over decided pursuits — AWARDED / (AWARDED
// + LOST + NO_BID).
//
// Per row: projectType, total, prospect, pursuing, bidSubmitted,
// awarded, lost, noBid, archived, winRate.
//
// Sort by total desc.
//
// Different from customer-job-pipeline (per customer status),
// bid-result-by-month (per month outcomes), and bid-win-rate-
// by-customer (per customer outcomes).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { PtoEProjectType } from './plans-to-estimate-output';

export interface JobByProjectTypeRow {
  projectType: PtoEProjectType;
  total: number;
  prospect: number;
  pursuing: number;
  bidSubmitted: number;
  awarded: number;
  lost: number;
  noBid: number;
  archived: number;
  /** awarded / (awarded + lost + noBid). */
  winRate: number;
}

export interface JobByProjectTypeRollup {
  typesConsidered: number;
  totalJobs: number;
  totalAwarded: number;
}

export interface JobByProjectTypeInputs {
  jobs: Job[];
}

export function buildJobByProjectType(
  inputs: JobByProjectTypeInputs,
): {
  rollup: JobByProjectTypeRollup;
  rows: JobByProjectTypeRow[];
} {
  type Acc = {
    counts: Record<Job['status'], number>;
  };
  const accs = new Map<PtoEProjectType, Acc>();
  let totalAwarded = 0;

  for (const j of inputs.jobs) {
    const acc = accs.get(j.projectType) ?? {
      counts: {
        PROSPECT: 0,
        PURSUING: 0,
        BID_SUBMITTED: 0,
        AWARDED: 0,
        LOST: 0,
        NO_BID: 0,
        ARCHIVED: 0,
      },
    };
    acc.counts[j.status] += 1;
    if (j.status === 'AWARDED') totalAwarded += 1;
    accs.set(j.projectType, acc);
  }

  const rows: JobByProjectTypeRow[] = [];
  for (const [projectType, acc] of accs.entries()) {
    let total = 0;
    for (const v of Object.values(acc.counts)) total += v;
    const decided = acc.counts.AWARDED + acc.counts.LOST + acc.counts.NO_BID;
    const winRate = decided === 0
      ? 0
      : Math.round((acc.counts.AWARDED / decided) * 10_000) / 10_000;
    rows.push({
      projectType,
      total,
      prospect: acc.counts.PROSPECT,
      pursuing: acc.counts.PURSUING,
      bidSubmitted: acc.counts.BID_SUBMITTED,
      awarded: acc.counts.AWARDED,
      lost: acc.counts.LOST,
      noBid: acc.counts.NO_BID,
      archived: acc.counts.ARCHIVED,
      winRate,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      typesConsidered: rows.length,
      totalJobs: inputs.jobs.length,
      totalAwarded,
    },
    rows,
  };
}
