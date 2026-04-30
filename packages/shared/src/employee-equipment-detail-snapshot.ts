// Employee-anchored per-job equipment detail snapshot.
//
// Plain English: for one employee (matched by employeeId on
// the dispatch crew row OR by case-insensitive name match on
// the equipment.operatorName), return one row per job they
// drove equipment on: distinct units operated, total dispatch
// slots, last dispatch date. Sorted by distinct units desc.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EmployeeEquipmentDetailRow {
  jobId: string;
  distinctUnits: number;
  totalSlots: number;
  lastDispatchDate: string | null;
}

export interface EmployeeEquipmentDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeEquipmentDetailRow[];
}

export interface EmployeeEquipmentDetailSnapshotInputs {
  employeeId: string;
  /** Optional name to match against operatorName when the dispatch
   *  row stores a free-form name without a linked employeeId. */
  employeeName?: string;
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

export function buildEmployeeEquipmentDetailSnapshot(
  inputs: EmployeeEquipmentDetailSnapshotInputs,
): EmployeeEquipmentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  type Acc = {
    units: Set<string>;
    slots: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { units: new Set(), slots: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    if (!d.equipment || d.equipment.length === 0) continue;

    // Was this employee on this dispatch's crew?
    const onCrew = d.crew.some(
      (c) =>
        c.employeeId === inputs.employeeId ||
        (targetName.length > 0 && norm(c.name) === targetName),
    );

    let touched = false;
    for (const slot of d.equipment) {
      const opName = norm(slot.operatorName);
      const matches =
        (targetName.length > 0 && opName === targetName) ||
        (onCrew && opName.length === 0);
      if (!matches) continue;
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      const a = getAcc(d.jobId);
      a.units.add(key);
      a.slots += 1;
      touched = true;
      if (a.lastDate == null || d.scheduledFor > a.lastDate) a.lastDate = d.scheduledFor;
    }
    void touched;
  }

  const rows: EmployeeEquipmentDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      distinctUnits: a.units.size,
      totalSlots: a.slots,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.distinctUnits - a.distinctUnits || b.totalSlots - a.totalSlots || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
