// Portfolio RFI year-over-year.
//
// Plain English: collapse two years of RFIs into a single
// comparison row with priority + impact + answered counts +
// distinct jobs + deltas.
//
// Different from portfolio-rfi-priority-monthly (per month).
//
// Pure derivation. No persisted records.

import type { Rfi, RfiPriority } from './rfi';

export interface PortfolioRfiYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalSent: number;
  priorAnsweredCount: number;
  priorByPriority: Partial<Record<RfiPriority, number>>;
  priorCostImpactCount: number;
  priorScheduleImpactCount: number;
  priorDistinctJobs: number;
  currentTotalSent: number;
  currentAnsweredCount: number;
  currentByPriority: Partial<Record<RfiPriority, number>>;
  currentCostImpactCount: number;
  currentScheduleImpactCount: number;
  currentDistinctJobs: number;
  totalSentDelta: number;
}

export interface PortfolioRfiYoyInputs {
  rfis: Rfi[];
  currentYear: number;
}

export function buildPortfolioRfiYoy(
  inputs: PortfolioRfiYoyInputs,
): PortfolioRfiYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    totalSent: number;
    answeredCount: number;
    byPriority: Map<RfiPriority, number>;
    costImpactCount: number;
    scheduleImpactCount: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      totalSent: 0,
      answeredCount: 0,
      byPriority: new Map(),
      costImpactCount: 0,
      scheduleImpactCount: 0,
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const r of inputs.rfis) {
    if (!r.sentAt) continue;
    const year = Number(r.sentAt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.totalSent += 1;
    if (r.answeredAt) b.answeredCount += 1;
    const pri: RfiPriority = r.priority ?? 'MEDIUM';
    b.byPriority.set(pri, (b.byPriority.get(pri) ?? 0) + 1);
    if (r.costImpact) b.costImpactCount += 1;
    if (r.scheduleImpact) b.scheduleImpactCount += 1;
    b.jobs.add(r.jobId);
  }

  function toRecord(m: Map<RfiPriority, number>): Partial<Record<RfiPriority, number>> {
    const out: Partial<Record<RfiPriority, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalSent: prior.totalSent,
    priorAnsweredCount: prior.answeredCount,
    priorByPriority: toRecord(prior.byPriority),
    priorCostImpactCount: prior.costImpactCount,
    priorScheduleImpactCount: prior.scheduleImpactCount,
    priorDistinctJobs: prior.jobs.size,
    currentTotalSent: current.totalSent,
    currentAnsweredCount: current.answeredCount,
    currentByPriority: toRecord(current.byPriority),
    currentCostImpactCount: current.costImpactCount,
    currentScheduleImpactCount: current.scheduleImpactCount,
    currentDistinctJobs: current.jobs.size,
    totalSentDelta: current.totalSent - prior.totalSent,
  };
}
