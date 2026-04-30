// Portfolio PCO year-over-year.
//
// Plain English: collapse two years of potential change orders
// into a single comparison row with open/converted counts +
// cost impact + schedule impact days + distinct jobs + deltas.
//
// Different from portfolio-pco-monthly (per month).
//
// Pure derivation. No persisted records.

import type { Pco } from './pco';

export interface PortfolioPcoYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorOpenCount: number;
  priorConvertedCount: number;
  priorTotalCostImpactCents: number;
  priorOpenCostImpactCents: number;
  priorTotalScheduleImpactDays: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentOpenCount: number;
  currentConvertedCount: number;
  currentTotalCostImpactCents: number;
  currentOpenCostImpactCents: number;
  currentTotalScheduleImpactDays: number;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface PortfolioPcoYoyInputs {
  pcos: Pco[];
  currentYear: number;
}

export function buildPortfolioPcoYoy(
  inputs: PortfolioPcoYoyInputs,
): PortfolioPcoYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    openCount: number;
    convertedCount: number;
    totalCostImpactCents: number;
    openCostImpactCents: number;
    totalScheduleImpactDays: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      openCount: 0,
      convertedCount: 0,
      totalCostImpactCents: 0,
      openCostImpactCents: 0,
      totalScheduleImpactDays: 0,
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const p of inputs.pcos) {
    const year = Number(p.noticedOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    const status = p.status ?? 'DRAFT';
    const isConverted = status === 'CONVERTED_TO_CO';
    const isOpen = !isConverted && status !== 'REJECTED';
    if (isConverted) b.convertedCount += 1;
    if (isOpen) b.openCount += 1;
    b.totalCostImpactCents += p.costImpactCents ?? 0;
    if (isOpen && (p.costImpactCents ?? 0) > 0) {
      b.openCostImpactCents += p.costImpactCents ?? 0;
    }
    b.totalScheduleImpactDays += p.scheduleImpactDays ?? 0;
    b.jobs.add(p.jobId);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorOpenCount: prior.openCount,
    priorConvertedCount: prior.convertedCount,
    priorTotalCostImpactCents: prior.totalCostImpactCents,
    priorOpenCostImpactCents: prior.openCostImpactCents,
    priorTotalScheduleImpactDays: prior.totalScheduleImpactDays,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentOpenCount: current.openCount,
    currentConvertedCount: current.convertedCount,
    currentTotalCostImpactCents: current.totalCostImpactCents,
    currentOpenCostImpactCents: current.openCostImpactCents,
    currentTotalScheduleImpactDays: current.totalScheduleImpactDays,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
