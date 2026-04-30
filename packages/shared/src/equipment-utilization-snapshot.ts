// Equipment-anchored utilization snapshot.
//
// Plain English: for one equipment unit, as-of today, count
// dispatches where the unit was assigned, distinct jobs +
// foremen + operators, last dispatch date. Drives the right-
// now per-unit utilization overview.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentUtilizationSnapshotResult {
  asOf: string;
  equipmentId: string;
  totalDispatches: number;
  ytdDispatches: number;
  distinctJobs: number;
  distinctForemen: number;
  distinctOperators: number;
  lastDispatchDate: string | null;
}

export interface EquipmentUtilizationSnapshotInputs {
  equipmentId: string;
  /** Optional printed name fallback for matching dispatch slots that
   *  reference the unit by name only. */
  equipmentName?: string;
  dispatches: Dispatch[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
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

export function buildEquipmentUtilizationSnapshot(
  inputs: EquipmentUtilizationSnapshotInputs,
): EquipmentUtilizationSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const targetName = norm(inputs.equipmentName);

  const jobs = new Set<string>();
  const foremen = new Set<string>();
  const operators = new Set<string>();
  let totalDispatches = 0;
  let ytdDispatches = 0;
  let lastDispatchDate: string | null = null;

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = false;
    let opName: string | undefined;
    for (const slot of d.equipment ?? []) {
      const idMatch = slot.equipmentId === inputs.equipmentId;
      const nameMatch = !slot.equipmentId && targetName && norm(slot.name) === targetName;
      if (idMatch || nameMatch) {
        appeared = true;
        opName = slot.operatorName ?? opName;
        break;
      }
    }
    if (!appeared) continue;
    totalDispatches += 1;
    jobs.add(d.jobId);
    if (d.foremanName) foremen.add(d.foremanName.trim().toLowerCase());
    if (opName) operators.add(opName.trim().toLowerCase());
    if (Number(d.scheduledFor.slice(0, 4)) === logYear) ytdDispatches += 1;
    if (lastDispatchDate == null || d.scheduledFor > lastDispatchDate) lastDispatchDate = d.scheduledFor;
  }

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    totalDispatches,
    ytdDispatches,
    distinctJobs: jobs.size,
    distinctForemen: foremen.size,
    distinctOperators: operators.size,
    lastDispatchDate,
  };
}
