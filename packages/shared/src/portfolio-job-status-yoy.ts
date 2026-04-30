// Portfolio job creation year-over-year.
//
// Plain English: collapse two years of job creation activity
// (createdAt) into a YoY comparison with status mix + project
// type mix + distinct owners + delta.
//
// Different from portfolio-job-status-monthly (per month).
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';
import type { PtoEProjectType } from './plans-to-estimate-output';

export interface PortfolioJobStatusYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<JobStatus, number>>;
  priorByProjectType: Partial<Record<PtoEProjectType, number>>;
  priorDistinctOwners: number;
  currentTotal: number;
  currentByStatus: Partial<Record<JobStatus, number>>;
  currentByProjectType: Partial<Record<PtoEProjectType, number>>;
  currentDistinctOwners: number;
  totalDelta: number;
}

export interface PortfolioJobStatusYoyInputs {
  jobs: Job[];
  currentYear: number;
}

export function buildPortfolioJobStatusYoy(
  inputs: PortfolioJobStatusYoyInputs,
): PortfolioJobStatusYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byStatus: Map<JobStatus, number>;
    byProjectType: Map<PtoEProjectType, number>;
    owners: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      byStatus: new Map(),
      byProjectType: new Map(),
      owners: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const j of inputs.jobs) {
    const year = Number(j.createdAt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status: JobStatus = j.status ?? 'PURSUING';
    b.byStatus.set(status, (b.byStatus.get(status) ?? 0) + 1);
    b.byProjectType.set(j.projectType, (b.byProjectType.get(j.projectType) ?? 0) + 1);
    if (j.ownerAgency) b.owners.add(j.ownerAgency.toLowerCase().trim());
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
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorByProjectType: typeRecord(prior.byProjectType),
    priorDistinctOwners: prior.owners.size,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentByProjectType: typeRecord(current.byProjectType),
    currentDistinctOwners: current.owners.size,
    totalDelta: current.total - prior.total,
  };
}
