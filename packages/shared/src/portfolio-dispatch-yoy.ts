// Portfolio dispatch year-over-year.
//
// Plain English: collapse two years of dispatch volume into a
// comparison row with status mix + crew/equipment lines +
// distinct foremen/jobs + deltas.
//
// Different from portfolio-dispatch-monthly (per month).
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';

export interface PortfolioDispatchYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorPosted: number;
  priorCompleted: number;
  priorCancelled: number;
  priorDraft: number;
  priorTotalCrewLines: number;
  priorTotalEquipmentLines: number;
  priorDistinctForemen: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentPosted: number;
  currentCompleted: number;
  currentCancelled: number;
  currentDraft: number;
  currentTotalCrewLines: number;
  currentTotalEquipmentLines: number;
  currentDistinctForemen: number;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface PortfolioDispatchYoyInputs {
  dispatches: Dispatch[];
  currentYear: number;
}

export function buildPortfolioDispatchYoy(
  inputs: PortfolioDispatchYoyInputs,
): PortfolioDispatchYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byStatus: Record<DispatchStatus, number>;
    crewLines: number;
    equipmentLines: number;
    foremen: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      byStatus: { DRAFT: 0, POSTED: 0, COMPLETED: 0, CANCELLED: 0 },
      crewLines: 0,
      equipmentLines: 0,
      foremen: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const st: DispatchStatus = d.status ?? 'DRAFT';
    b.byStatus[st] += 1;
    b.crewLines += (d.crew ?? []).length;
    b.equipmentLines += (d.equipment ?? []).length;
    if (d.foremanName) b.foremen.add(d.foremanName);
    b.jobs.add(d.jobId);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorPosted: prior.byStatus.POSTED,
    priorCompleted: prior.byStatus.COMPLETED,
    priorCancelled: prior.byStatus.CANCELLED,
    priorDraft: prior.byStatus.DRAFT,
    priorTotalCrewLines: prior.crewLines,
    priorTotalEquipmentLines: prior.equipmentLines,
    priorDistinctForemen: prior.foremen.size,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentPosted: current.byStatus.POSTED,
    currentCompleted: current.byStatus.COMPLETED,
    currentCancelled: current.byStatus.CANCELLED,
    currentDraft: current.byStatus.DRAFT,
    currentTotalCrewLines: current.crewLines,
    currentTotalEquipmentLines: current.equipmentLines,
    currentDistinctForemen: current.foremen.size,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
