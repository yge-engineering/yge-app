// Portfolio PCO snapshot (point-in-time).
//
// Plain English: as-of today, count PCOs by status mix
// (DRAFT / SUBMITTED / UNDER_REVIEW / APPROVED_PENDING_CO /
// REJECTED / WITHDRAWN / CONVERTED_TO_CO), open-and-aging,
// total + open cost exposure, distinct jobs.
//
// Pure derivation. No persisted records.

import type { Pco, PcoStatus } from './pco';

export interface PortfolioPcoSnapshotResult {
  totalPcos: number;
  byStatus: Partial<Record<PcoStatus, number>>;
  openCount: number;
  convertedCount: number;
  totalCostImpactCents: number;
  openCostImpactCents: number;
  totalScheduleImpactDays: number;
  distinctJobs: number;
}

export interface PortfolioPcoSnapshotInputs {
  pcos: Pco[];
}

export function buildPortfolioPcoSnapshot(
  inputs: PortfolioPcoSnapshotInputs,
): PortfolioPcoSnapshotResult {
  const byStatus = new Map<PcoStatus, number>();
  let openCount = 0;
  let convertedCount = 0;
  let totalCostImpactCents = 0;
  let openCostImpactCents = 0;
  let totalScheduleImpactDays = 0;
  const jobs = new Set<string>();

  for (const p of inputs.pcos) {
    const status: PcoStatus = p.status ?? 'DRAFT';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const isConverted = status === 'CONVERTED_TO_CO';
    const isOpen = !isConverted && status !== 'REJECTED' && status !== 'WITHDRAWN';
    if (isConverted) convertedCount += 1;
    if (isOpen) openCount += 1;
    totalCostImpactCents += p.costImpactCents ?? 0;
    if (isOpen && (p.costImpactCents ?? 0) > 0) {
      openCostImpactCents += p.costImpactCents ?? 0;
    }
    totalScheduleImpactDays += p.scheduleImpactDays ?? 0;
    jobs.add(p.jobId);
  }

  function toRecord(m: Map<PcoStatus, number>): Partial<Record<PcoStatus, number>> {
    const out: Partial<Record<PcoStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalPcos: inputs.pcos.length,
    byStatus: toRecord(byStatus),
    openCount,
    convertedCount,
    totalCostImpactCents,
    openCostImpactCents,
    totalScheduleImpactDays,
    distinctJobs: jobs.size,
  };
}
