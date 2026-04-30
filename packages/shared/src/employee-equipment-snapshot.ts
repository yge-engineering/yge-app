// Employee-anchored equipment footprint snapshot.
//
// Plain English: for one employee, as-of today, surface which
// equipment units they were named operator for on dispatches.
// Counts distinct units, top-N units by dispatch count, total
// dispatches.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EmployeeEquipmentRow {
  equipmentKey: string;
  unitName: string;
  dispatches: number;
}

export interface EmployeeEquipmentSnapshotResult {
  asOf: string;
  employeeName: string;
  distinctUnits: number;
  totalDispatches: number;
  topUnits: EmployeeEquipmentRow[];
}

export interface EmployeeEquipmentSnapshotInputs {
  /** Printed name to match against equipment slot operatorName. */
  employeeName: string;
  dispatches: Dispatch[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Top-N units. Default 5. */
  topN?: number;
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

export function buildEmployeeEquipmentSnapshot(inputs: EmployeeEquipmentSnapshotInputs): EmployeeEquipmentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.employeeName);
  const topN = inputs.topN ?? 5;

  const byUnit = new Map<string, { name: string; count: number }>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    for (const slot of d.equipment ?? []) {
      if (norm(slot.operatorName) !== target) continue;
      totalDispatches += 1;
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      if (!key) continue;
      const cur = byUnit.get(key) ?? { name: slot.name ?? key, count: 0 };
      cur.count += 1;
      byUnit.set(key, cur);
    }
  }

  const sorted = [...byUnit.entries()]
    .map(([equipmentKey, v]) => ({ equipmentKey, unitName: v.name, dispatches: v.count }))
    .sort((a, b) => b.dispatches - a.dispatches || a.unitName.localeCompare(b.unitName));

  return {
    asOf,
    employeeName: inputs.employeeName,
    distinctUnits: byUnit.size,
    totalDispatches,
    topUnits: sorted.slice(0, topN),
  };
}
