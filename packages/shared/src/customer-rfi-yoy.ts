// Customer-anchored RFI year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of RFI logs into a comparison: counts,
// answered counts, priority mix, cost+schedule impact counts,
// distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi, RfiPriority } from './rfi';

export interface CustomerRfiYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorAnswered: number;
  priorByPriority: Partial<Record<RfiPriority, number>>;
  priorCostImpact: number;
  priorScheduleImpact: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentAnswered: number;
  currentByPriority: Partial<Record<RfiPriority, number>>;
  currentCostImpact: number;
  currentScheduleImpact: number;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface CustomerRfiYoyInputs {
  customerName: string;
  rfis: Rfi[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerRfiYoy(
  inputs: CustomerRfiYoyInputs,
): CustomerRfiYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    answered: number;
    byPriority: Map<RfiPriority, number>;
    costImpact: number;
    scheduleImpact: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      answered: 0,
      byPriority: new Map(),
      costImpact: 0,
      scheduleImpact: 0,
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const r of inputs.rfis) {
    if (!customerJobs.has(r.jobId)) continue;
    const sentAt = r.sentAt ?? r.createdAt;
    if (!sentAt) continue;
    const year = Number(sentAt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    if (r.status === 'ANSWERED' || r.answeredAt) b.answered += 1;
    const pri: RfiPriority = r.priority ?? 'MEDIUM';
    b.byPriority.set(pri, (b.byPriority.get(pri) ?? 0) + 1);
    if (r.costImpact) b.costImpact += 1;
    if (r.scheduleImpact) b.scheduleImpact += 1;
    b.jobs.add(r.jobId);
  }

  function priRecord(m: Map<RfiPriority, number>): Partial<Record<RfiPriority, number>> {
    const out: Partial<Record<RfiPriority, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorAnswered: prior.answered,
    priorByPriority: priRecord(prior.byPriority),
    priorCostImpact: prior.costImpact,
    priorScheduleImpact: prior.scheduleImpact,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentAnswered: current.answered,
    currentByPriority: priRecord(current.byPriority),
    currentCostImpact: current.costImpact,
    currentScheduleImpact: current.scheduleImpact,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
