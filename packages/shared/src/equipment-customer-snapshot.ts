// Equipment-anchored customer footprint snapshot.
//
// Plain English: for one equipment unit, as-of today, surface
// which customers' jobs the unit has been dispatched against
// (joined via Job.ownerAgency). Counts distinct customers + jobs
// + total dispatch slots.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface EquipmentCustomerSnapshotResult {
  asOf: string;
  equipmentId: string;
  distinctCustomers: number;
  distinctJobs: number;
  totalDispatches: number;
  customers: string[];
}

export interface EquipmentCustomerSnapshotInputs {
  equipmentId: string;
  equipmentName?: string;
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

export function buildEquipmentCustomerSnapshot(
  inputs: EquipmentCustomerSnapshotInputs,
): EquipmentCustomerSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.equipmentName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, j.ownerAgency);
  }

  const jobs = new Set<string>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = false;
    for (const slot of d.equipment ?? []) {
      const idMatch = slot.equipmentId === inputs.equipmentId;
      const nameMatch = !slot.equipmentId && targetName && norm(slot.name) === targetName;
      if (idMatch || nameMatch) {
        appeared = true;
        break;
      }
    }
    if (!appeared) continue;
    totalDispatches += 1;
    jobs.add(d.jobId);
  }

  const customers = new Set<string>();
  for (const jid of jobs) {
    const owner = jobOwner.get(jid);
    if (owner) customers.add(owner);
  }

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    distinctCustomers: customers.size,
    distinctJobs: jobs.size,
    totalDispatches,
    customers: [...customers].sort((a, b) => a.localeCompare(b)),
  };
}
