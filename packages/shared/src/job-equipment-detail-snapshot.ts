// Job-anchored per-equipment-unit detail snapshot.
//
// Plain English: for one job, return one row per equipment unit
// that appeared on its dispatch board: dispatch slot count,
// distinct days, distinct operators, last dispatch date. Sorted
// by slots desc.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface JobEquipmentDetailRow {
  equipmentKey: string;
  slots: number;
  distinctDays: number;
  distinctOperators: number;
  lastDispatchDate: string | null;
}

export interface JobEquipmentDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobEquipmentDetailRow[];
}

export interface JobEquipmentDetailSnapshotInputs {
  jobId: string;
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

export function buildJobEquipmentDetailSnapshot(
  inputs: JobEquipmentDetailSnapshotInputs,
): JobEquipmentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    slots: number;
    days: Set<string>;
    operators: Set<string>;
    lastDate: string | null;
  };
  const byEq = new Map<string, Acc>();
  function getAcc(key: string): Acc {
    let a = byEq.get(key);
    if (!a) {
      a = { slots: 0, days: new Set(), operators: new Set(), lastDate: null };
      byEq.set(key, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    if (d.scheduledFor > asOf) continue;
    if (!d.equipment || d.equipment.length === 0) continue;
    for (const slot of d.equipment) {
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      const a = getAcc(key);
      a.slots += 1;
      a.days.add(d.scheduledFor);
      if (slot.operatorName) a.operators.add(norm(slot.operatorName));
      if (a.lastDate == null || d.scheduledFor > a.lastDate) a.lastDate = d.scheduledFor;
    }
  }

  const rows: JobEquipmentDetailRow[] = [...byEq.entries()]
    .map(([equipmentKey, a]) => ({
      equipmentKey,
      slots: a.slots,
      distinctDays: a.days.size,
      distinctOperators: a.operators.size,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.slots - a.slots || a.equipmentKey.localeCompare(b.equipmentKey));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
