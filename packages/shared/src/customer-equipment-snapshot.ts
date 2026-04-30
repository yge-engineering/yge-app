// Customer-anchored equipment footprint snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, surface which equipment units have been
// dispatched against any of their jobs. Counts distinct units +
// dispatches + jobs.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface CustomerEquipmentSnapshotResult {
  asOf: string;
  customerName: string;
  distinctUnits: number;
  totalDispatchSlots: number;
  distinctJobs: number;
  lastDispatchDate: string | null;
}

export interface CustomerEquipmentSnapshotInputs {
  customerName: string;
  jobs: Job[];
  dispatches: Dispatch[];
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

export function buildCustomerEquipmentSnapshot(
  inputs: CustomerEquipmentSnapshotInputs,
): CustomerEquipmentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const units = new Set<string>();
  const jobs = new Set<string>();
  let totalDispatchSlots = 0;
  let lastDispatchDate: string | null = null;

  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    if (d.scheduledFor > asOf) continue;
    for (const slot of d.equipment ?? []) {
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      if (key) units.add(key);
      totalDispatchSlots += 1;
    }
    jobs.add(d.jobId);
    if (lastDispatchDate == null || d.scheduledFor > lastDispatchDate) lastDispatchDate = d.scheduledFor;
  }

  return {
    asOf,
    customerName: inputs.customerName,
    distinctUnits: units.size,
    totalDispatchSlots,
    distinctJobs: jobs.size,
    lastDispatchDate,
  };
}
