// Customer-anchored RFI snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count RFIs across all their jobs, status mix,
// open + overdue, distinct jobs. Drives the right-now per-
// customer RFI overview in the customer-detail page.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi, RfiPriority, RfiStatus } from './rfi';

export interface CustomerRfiSnapshotResult {
  asOf: string;
  customerName: string;
  totalRfis: number;
  byStatus: Partial<Record<RfiStatus, number>>;
  byPriority: Partial<Record<RfiPriority, number>>;
  openCount: number;
  overdueCount: number;
  costImpactCount: number;
  scheduleImpactCount: number;
  distinctJobs: number;
}

export interface CustomerRfiSnapshotInputs {
  customerName: string;
  rfis: Rfi[];
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

export function buildCustomerRfiSnapshot(
  inputs: CustomerRfiSnapshotInputs,
): CustomerRfiSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const jobIdsForCustomer = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIdsForCustomer.add(j.id);
  }

  const byStatus = new Map<RfiStatus, number>();
  const byPriority = new Map<RfiPriority, number>();
  const jobs = new Set<string>();
  let totalRfis = 0;
  let openCount = 0;
  let overdueCount = 0;
  let costImpactCount = 0;
  let scheduleImpactCount = 0;

  for (const r of inputs.rfis) {
    if (!jobIdsForCustomer.has(r.jobId)) continue;
    totalRfis += 1;
    const status: RfiStatus = r.status ?? 'DRAFT';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const pri: RfiPriority = r.priority ?? 'MEDIUM';
    byPriority.set(pri, (byPriority.get(pri) ?? 0) + 1);
    const isOpen = status === 'DRAFT' || status === 'SENT';
    if (isOpen) {
      openCount += 1;
      if (r.responseDueAt && r.responseDueAt < asOf && !r.answeredAt) overdueCount += 1;
    }
    if (r.costImpact) costImpactCount += 1;
    if (r.scheduleImpact) scheduleImpactCount += 1;
    jobs.add(r.jobId);
  }

  const sOut: Partial<Record<RfiStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;
  const pOut: Partial<Record<RfiPriority, number>> = {};
  for (const [k, v] of byPriority) pOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalRfis,
    byStatus: sOut,
    byPriority: pOut,
    openCount,
    overdueCount,
    costImpactCount,
    scheduleImpactCount,
    distinctJobs: jobs.size,
  };
}
