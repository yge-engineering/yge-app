// Equipment-anchored per-job detail snapshot.
//
// Plain English: for one equipment unit, return one row per
// job the unit was dispatched against with: dispatch count,
// last dispatch date. Sorted by dispatch count descending.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentJobDetailRow {
  jobId: string;
  dispatches: number;
  lastDispatchDate: string | null;
}

export interface EquipmentJobDetailSnapshotResult {
  asOf: string;
  equipmentId: string;
  rows: EquipmentJobDetailRow[];
}

export interface EquipmentJobDetailSnapshotInputs {
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

export function buildEquipmentJobDetailSnapshot(
  inputs: EquipmentJobDetailSnapshotInputs,
): EquipmentJobDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.equipmentName);

  type Acc = { count: number; lastDate: string | null };
  const byJob = new Map<string, Acc>();

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
    const cur = byJob.get(d.jobId) ?? { count: 0, lastDate: null };
    cur.count += 1;
    if (cur.lastDate == null || d.scheduledFor > cur.lastDate) cur.lastDate = d.scheduledFor;
    byJob.set(d.jobId, cur);
  }

  const rows: EquipmentJobDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      dispatches: a.count,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.dispatches - a.dispatches || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    rows,
  };
}
