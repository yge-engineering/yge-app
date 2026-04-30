// Customer-anchored dispatch snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count dispatches across all their jobs, sum
// crew + equipment slots, status mix, distinct foremen + jobs,
// last dispatch date.
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';
import type { Job } from './job';

export interface CustomerDispatchSnapshotResult {
  asOf: string;
  customerName: string;
  totalDispatches: number;
  totalCrewSeats: number;
  totalEquipmentSlots: number;
  byStatus: Partial<Record<DispatchStatus, number>>;
  distinctForemen: number;
  distinctJobs: number;
  lastDispatchDate: string | null;
}

export interface CustomerDispatchSnapshotInputs {
  customerName: string;
  dispatches: Dispatch[];
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

export function buildCustomerDispatchSnapshot(
  inputs: CustomerDispatchSnapshotInputs,
): CustomerDispatchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const byStatus = new Map<DispatchStatus, number>();
  const foremen = new Set<string>();
  const jobs = new Set<string>();
  let totalDispatches = 0;
  let totalCrewSeats = 0;
  let totalEquipmentSlots = 0;
  let lastDispatchDate: string | null = null;

  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    if (d.scheduledFor > asOf) continue;
    totalDispatches += 1;
    totalCrewSeats += d.crew?.length ?? 0;
    totalEquipmentSlots += d.equipment?.length ?? 0;
    byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
    if (d.foremanName) foremen.add(d.foremanName.trim().toLowerCase());
    jobs.add(d.jobId);
    if (lastDispatchDate == null || d.scheduledFor > lastDispatchDate) lastDispatchDate = d.scheduledFor;
  }

  const out: Partial<Record<DispatchStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalDispatches,
    totalCrewSeats,
    totalEquipmentSlots,
    byStatus: out,
    distinctForemen: foremen.size,
    distinctJobs: jobs.size,
    lastDispatchDate,
  };
}
