// Customer-anchored PCO year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of PCOs into a comparison: counts, status
// mix, cost impact (positive only), schedule impact days,
// distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Pco, PcoStatus } from './pco';

export interface CustomerPcoYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByStatus: Partial<Record<PcoStatus, number>>;
  priorCostImpactCents: number;
  priorScheduleImpactDays: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentByStatus: Partial<Record<PcoStatus, number>>;
  currentCostImpactCents: number;
  currentScheduleImpactDays: number;
  currentDistinctJobs: number;
  totalDelta: number;
  costImpactDelta: number;
}

export interface CustomerPcoYoyInputs {
  customerName: string;
  pcos: Pco[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerPcoYoy(
  inputs: CustomerPcoYoyInputs,
): CustomerPcoYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    byStatus: Map<PcoStatus, number>;
    costImpact: number;
    scheduleImpact: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { total: 0, byStatus: new Map(), costImpact: 0, scheduleImpact: 0, jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.pcos) {
    if (!customerJobs.has(p.jobId)) continue;
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
    b.jobs.add(p.jobId);
  }

  function statusRecord(m: Map<PcoStatus, number>): Partial<Record<PcoStatus, number>> {
    const out: Partial<Record<PcoStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByStatus: statusRecord(prior.byStatus),
    priorCostImpactCents: prior.costImpact,
    priorScheduleImpactDays: prior.scheduleImpact,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentByStatus: statusRecord(current.byStatus),
    currentCostImpactCents: current.costImpact,
    currentScheduleImpactDays: current.scheduleImpact,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
    costImpactDelta: current.costImpact - prior.costImpact,
  };
}
