// Job-anchored PCO year-over-year.
//
// Plain English: for one job, collapse two years of PCOs into
// a comparison: counts, status mix, cost impact cents,
// schedule impact days, plus deltas.
//
// Pure derivation. No persisted records.

import type { Pco, PcoStatus } from './pco';

export interface JobPcoYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<PcoStatus, number>>;
  priorCostImpactCents: number;
  priorScheduleImpactDays: number;
  currentTotal: number;
  currentByStatus: Partial<Record<PcoStatus, number>>;
  currentCostImpactCents: number;
  currentScheduleImpactDays: number;
  totalDelta: number;
  costImpactDelta: number;
}

export interface JobPcoYoyInputs {
  jobId: string;
  pcos: Pco[];
  currentYear: number;
}

export function buildJobPcoYoy(inputs: JobPcoYoyInputs): JobPcoYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byStatus: Map<PcoStatus, number>;
    costImpact: number;
    scheduleImpact: number;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byStatus: new Map(), costImpact: 0, scheduleImpact: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.pcos) {
    if (p.jobId !== inputs.jobId) continue;
    const dt = p.noticedOn;
    if (!dt) continue;
    const year = Number(dt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status: PcoStatus = p.status ?? 'DRAFT';
    b.byStatus.set(status, (b.byStatus.get(status) ?? 0) + 1);
    b.costImpact += p.costImpactCents ?? 0;
    b.scheduleImpact += p.scheduleImpactDays ?? 0;
  }

  function statusRecord(m: Map<PcoStatus, number>): Partial<Record<PcoStatus, number>> {
    const out: Partial<Record<PcoStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorCostImpactCents: prior.costImpact,
    priorScheduleImpactDays: prior.scheduleImpact,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentCostImpactCents: current.costImpact,
    currentScheduleImpactDays: current.scheduleImpact,
    totalDelta: current.total - prior.total,
    costImpactDelta: current.costImpact - prior.costImpact,
  };
}
