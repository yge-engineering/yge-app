// Per-job overhead allocation.
//
// Plain English: every active job pays for a slice of the
// company-wide overhead it consumes — the office rent, owner
// salaries, accounting software, the truck Brook drives between
// sites, the office phone bill. The standard allocation method
// for a contractor is "share of direct-cost spend" — the bigger
// the job's direct costs, the bigger its share of overhead.
//
// This module takes:
//   - direct cost per job (caller supplies the map; typically
//     job-billing-cadence + AP totals get this number)
//   - total overhead pool for the period
//
// And returns:
//   - per-job overhead share
//   - per-job direct + overhead = loaded cost
//   - per-job % of total direct spend
//
// Pure derivation. No persisted records.

import type { Job } from './job';

export interface JobOverheadRow {
  jobId: string;
  projectName: string;
  directCostCents: number;
  /** This job's share of company direct-cost spend. 0..1. */
  directShare: number;
  /** allocated overhead = totalOverheadCents * directShare. */
  allocatedOverheadCents: number;
  /** direct + overhead. */
  loadedCostCents: number;
}

export interface JobOverheadRollup {
  jobsConsidered: number;
  totalDirectCostCents: number;
  totalOverheadCents: number;
  totalLoadedCostCents: number;
  /** Total allocated. Should equal totalOverheadCents within
   *  a few cents (rounding). */
  totalAllocatedCents: number;
}

export interface JobOverheadInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  /** Map<jobId, direct cost cents>. */
  directCostByJobId: Map<string, number>;
  /** Total overhead pool to allocate (cents). */
  totalOverheadCents: number;
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobOverheadAllocation(
  inputs: JobOverheadInputs,
): {
  rollup: JobOverheadRollup;
  rows: JobOverheadRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // First pass: collect direct costs for jobs that pass the
  // status filter, compute total.
  type Bucket = { jobId: string; projectName: string; direct: number };
  const buckets: Bucket[] = [];
  let totalDirect = 0;
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const direct = inputs.directCostByJobId.get(j.id) ?? 0;
    buckets.push({ jobId: j.id, projectName: j.projectName, direct });
    totalDirect += direct;
  }

  const rows: JobOverheadRow[] = [];
  let allocated = 0;
  for (const b of buckets) {
    const share = totalDirect === 0 ? 0 : b.direct / totalDirect;
    const overhead = Math.round(inputs.totalOverheadCents * share);
    const loaded = b.direct + overhead;
    rows.push({
      jobId: b.jobId,
      projectName: b.projectName,
      directCostCents: b.direct,
      directShare: round4(share),
      allocatedOverheadCents: overhead,
      loadedCostCents: loaded,
    });
    allocated += overhead;
  }

  // Highest loaded cost first.
  rows.sort((a, b) => b.loadedCostCents - a.loadedCostCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDirectCostCents: totalDirect,
      totalOverheadCents: inputs.totalOverheadCents,
      totalLoadedCostCents: totalDirect + allocated,
      totalAllocatedCents: allocated,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
