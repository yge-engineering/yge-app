// Equipment-anchored per-job utilization detail snapshot.
//
// Plain English: for one equipment unit (matched by equipmentId
// or case-insensitive name), return one row per job it appeared
// on the dispatch board: dispatch slot count, distinct days,
// distinct operators, last dispatch date. Sorted by slots desc.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentUtilizationDetailRow {
  jobId: string;
  slots: number;
  distinctDays: number;
  distinctOperators: number;
  lastDispatchDate: string | null;
}

export interface EquipmentUtilizationDetailSnapshotResult {
  asOf: string;
  equipmentId: string;
  rows: EquipmentUtilizationDetailRow[];
}

export interface EquipmentUtilizationDetailSnapshotInputs {
  equipmentId: string;
  /** Optional name to match when the dispatch slot is name-only. */
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

export function buildEquipmentUtilizationDetailSnapshot(
  inputs: EquipmentUtilizationDetailSnapshotInputs,
): EquipmentUtilizationDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.equipmentName);

  type Acc = {
    slots: number;
    days: Set<string>;
    operators: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { slots: 0, days: new Set(), operators: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    if (!d.equipment || d.equipment.length === 0) continue;
    let touched = false;
    for (const slot of d.equipment) {
      const idMatch = slot.equipmentId === inputs.equipmentId;
      const nameMatch = targetName.length > 0 && norm(slot.name) === targetName;
      if (!idMatch && !nameMatch) continue;
      const a = getAcc(d.jobId);
      a.slots += 1;
      a.days.add(d.scheduledFor);
      if (slot.operatorName) a.operators.add(norm(slot.operatorName));
      if (a.lastDate == null || d.scheduledFor > a.lastDate) a.lastDate = d.scheduledFor;
      touched = true;
    }
    void touched;
  }

  const rows: EquipmentUtilizationDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      slots: a.slots,
      distinctDays: a.days.size,
      distinctOperators: a.operators.size,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.slots - a.slots || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    rows,
  };
}
