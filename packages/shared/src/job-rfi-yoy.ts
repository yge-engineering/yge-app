// Job-anchored RFI year-over-year.
//
// Plain English: for one job, collapse two years of RFIs into
// a comparison: counts, answered, priority mix, cost+schedule
// impact, plus deltas.
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority } from './rfi';

export interface JobRfiYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorAnswered: number;
  priorByPriority: Partial<Record<RfiPriority, number>>;
  priorCostImpact: number;
  priorScheduleImpact: number;
  currentTotal: number;
  currentAnswered: number;
  currentByPriority: Partial<Record<RfiPriority, number>>;
  currentCostImpact: number;
  currentScheduleImpact: number;
  totalDelta: number;
}

export interface JobRfiYoyInputs {
  jobId: string;
  rfis: Rfi[];
  currentYear: number;
}

export function buildJobRfiYoy(inputs: JobRfiYoyInputs): JobRfiYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    answered: number;
    byPriority: Map<RfiPriority, number>;
    costImpact: number;
    scheduleImpact: number;
  };
  function emptyBucket(): Bucket {
    return { total: 0, answered: 0, byPriority: new Map(), costImpact: 0, scheduleImpact: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const r of inputs.rfis) {
    if (r.jobId !== inputs.jobId) continue;
    const dt = r.sentAt ?? r.createdAt;
    if (!dt) continue;
    const year = Number(dt.slice(0, 4));
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
  }

  function priRecord(m: Map<RfiPriority, number>): Partial<Record<RfiPriority, number>> {
    const out: Partial<Record<RfiPriority, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorAnswered: prior.answered,
    priorByPriority: priRecord(prior.byPriority),
    priorCostImpact: prior.costImpact,
    priorScheduleImpact: prior.scheduleImpact,
    currentTotal: current.total,
    currentAnswered: current.answered,
    currentByPriority: priRecord(current.byPriority),
    currentCostImpact: current.costImpact,
    currentScheduleImpact: current.scheduleImpact,
    totalDelta: current.total - prior.total,
  };
}
