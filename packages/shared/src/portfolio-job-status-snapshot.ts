// Portfolio job-status snapshot.
//
// Plain English: point-in-time count of every Job in the
// system, broken down by JobStatus + project type + owner
// agency mix. Drives the "what's in flight today" overview.
//
// Different from portfolio-job-status-monthly (per month
// activity) and portfolio-job-status-yoy (year-over-year
// activity). This is the right-now snapshot.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';
import type { PtoEProjectType } from './plans-to-estimate-output';

export interface PortfolioJobStatusSnapshotResult {
  totalJobs: number;
  byStatus: Partial<Record<JobStatus, number>>;
  byProjectType: Partial<Record<PtoEProjectType, number>>;
  distinctOwners: number;
  pursuitInFlight: number;
  awardedActive: number;
}

export interface PortfolioJobStatusSnapshotInputs {
  jobs: Job[];
}

export function buildPortfolioJobStatusSnapshot(
  inputs: PortfolioJobStatusSnapshotInputs,
): PortfolioJobStatusSnapshotResult {
  const byStatus = new Map<JobStatus, number>();
  const byProjectType = new Map<PtoEProjectType, number>();
  const owners = new Set<string>();
  let pursuitInFlight = 0;
  let awardedActive = 0;

  for (const j of inputs.jobs) {
    const status: JobStatus = j.status ?? 'PURSUING';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byProjectType.set(j.projectType, (byProjectType.get(j.projectType) ?? 0) + 1);
    if (j.ownerAgency) owners.add(j.ownerAgency.toLowerCase().trim());
    if (
      status === 'PROSPECT' ||
      status === 'PURSUING' ||
      status === 'BID_SUBMITTED'
    ) {
      pursuitInFlight += 1;
    }
    if (status === 'AWARDED') awardedActive += 1;
  }

  function statusRecord(m: Map<JobStatus, number>): Partial<Record<JobStatus, number>> {
    const out: Partial<Record<JobStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function typeRecord(m: Map<PtoEProjectType, number>): Partial<Record<PtoEProjectType, number>> {
    const out: Partial<Record<PtoEProjectType, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalJobs: inputs.jobs.length,
    byStatus: statusRecord(byStatus),
    byProjectType: typeRecord(byProjectType),
    distinctOwners: owners.size,
    pursuitInFlight,
    awardedActive,
  };
}
