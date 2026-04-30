// Job-anchored PCO snapshot.
//
// Plain English: for one job, as-of today, count PCOs by
// status, count open and converted-to-CO, sum cost impact +
// open cost exposure, sum schedule impact days. Drives the
// right-now per-job potential-change-order overview.
//
// Pure derivation. No persisted records.

import type { Pco, PcoStatus } from './pco';

export interface JobPcoSnapshotResult {
  asOf: string;
  jobId: string;
  totalPcos: number;
  byStatus: Partial<Record<PcoStatus, number>>;
  openCount: number;
  convertedCount: number;
  totalCostImpactCents: number;
  openCostImpactCents: number;
  totalScheduleImpactDays: number;
}

export interface JobPcoSnapshotInputs {
  jobId: string;
  pcos: Pco[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildJobPcoSnapshot(
  inputs: JobPcoSnapshotInputs,
): JobPcoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<PcoStatus, number>();
  let totalPcos = 0;
  let openCount = 0;
  let convertedCount = 0;
  let totalCostImpactCents = 0;
  let openCostImpactCents = 0;
  let totalScheduleImpactDays = 0;

  for (const p of inputs.pcos) {
    if (p.jobId !== inputs.jobId) continue;
    totalPcos += 1;
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
  }

  const out: Partial<Record<PcoStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalPcos,
    byStatus: out,
    openCount,
    convertedCount,
    totalCostImpactCents,
    openCostImpactCents,
    totalScheduleImpactDays,
  };
}
