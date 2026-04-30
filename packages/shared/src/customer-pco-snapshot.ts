// Customer-anchored PCO snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count PCOs across all their jobs, status mix,
// open vs converted, total + open cost exposure, total
// schedule impact days, distinct jobs.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Pco, PcoStatus } from './pco';

export interface CustomerPcoSnapshotResult {
  asOf: string;
  customerName: string;
  totalPcos: number;
  byStatus: Partial<Record<PcoStatus, number>>;
  openCount: number;
  convertedCount: number;
  totalCostImpactCents: number;
  openCostImpactCents: number;
  totalScheduleImpactDays: number;
  distinctJobs: number;
}

export interface CustomerPcoSnapshotInputs {
  customerName: string;
  pcos: Pco[];
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerPcoSnapshot(
  inputs: CustomerPcoSnapshotInputs,
): CustomerPcoSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const jobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIds.add(j.id);
  }

  const byStatus = new Map<PcoStatus, number>();
  const jobs = new Set<string>();

  let totalPcos = 0;
  let openCount = 0;
  let convertedCount = 0;
  let totalCostImpactCents = 0;
  let openCostImpactCents = 0;
  let totalScheduleImpactDays = 0;

  for (const p of inputs.pcos) {
    if (!jobIds.has(p.jobId)) continue;
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
    jobs.add(p.jobId);
  }

  const out: Partial<Record<PcoStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalPcos,
    byStatus: out,
    openCount,
    convertedCount,
    totalCostImpactCents,
    openCostImpactCents,
    totalScheduleImpactDays,
    distinctJobs: jobs.size,
  };
}
