// Equipment-anchored job footprint snapshot.
//
// Plain English: for one equipment unit, as-of today, count
// distinct jobs the unit has been dispatched against, total
// slots, last-dispatched date.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentJobSnapshotResult {
  asOf: string;
  equipmentId: string;
  distinctJobs: number;
  totalDispatches: number;
  lastDispatchDate: string | null;
}

export interface EquipmentJobSnapshotInputs {
  equipmentId: string;
  equipmentName?: string;
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

export function buildEquipmentJobSnapshot(inputs: EquipmentJobSnapshotInputs): EquipmentJobSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.equipmentName);

  const jobs = new Set<string>();
  let totalDispatches = 0;
  let lastDispatchDate: string | null = null;

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
    if (lastDispatchDate == null || d.scheduledFor > lastDispatchDate) lastDispatchDate = d.scheduledFor;
  }

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    distinctJobs: jobs.size,
    totalDispatches,
    lastDispatchDate,
  };
}
