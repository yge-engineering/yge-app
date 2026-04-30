// Job-anchored dispatch year-over-year.
//
// Plain English: for one job, collapse two years of dispatches
// into a comparison: counts, crew + equipment slots, status
// mix, distinct foremen, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';

export interface JobDispatchYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorCrewSeats: number;
  priorEquipmentSlots: number;
  priorByStatus: Partial<Record<DispatchStatus, number>>;
  priorDistinctForemen: number;
  currentTotal: number;
  currentCrewSeats: number;
  currentEquipmentSlots: number;
  currentByStatus: Partial<Record<DispatchStatus, number>>;
  currentDistinctForemen: number;
  totalDelta: number;
}

export interface JobDispatchYoyInputs {
  jobId: string;
  dispatches: Dispatch[];
  currentYear: number;
}

export function buildJobDispatchYoy(inputs: JobDispatchYoyInputs): JobDispatchYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    crew: number;
    equip: number;
    byStatus: Map<DispatchStatus, number>;
    foremen: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, crew: 0, equip: 0, byStatus: new Map(), foremen: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.crew += d.crew?.length ?? 0;
    b.equip += d.equipment?.length ?? 0;
    b.byStatus.set(d.status, (b.byStatus.get(d.status) ?? 0) + 1);
    if (d.foremanName) b.foremen.add(d.foremanName.trim().toLowerCase());
  }

  function statusRecord(m: Map<DispatchStatus, number>): Partial<Record<DispatchStatus, number>> {
    const out: Partial<Record<DispatchStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorCrewSeats: prior.crew,
    priorEquipmentSlots: prior.equip,
    priorByStatus: statusRecord(prior.byStatus),
    priorDistinctForemen: prior.foremen.size,
    currentTotal: current.total,
    currentCrewSeats: current.crew,
    currentEquipmentSlots: current.equip,
    currentByStatus: statusRecord(current.byStatus),
    currentDistinctForemen: current.foremen.size,
    totalDelta: current.total - prior.total,
  };
}
