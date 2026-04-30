// Equipment-anchored employee footprint snapshot.
//
// Plain English: alias for equipment-operator-snapshot framing
// — for one equipment unit, surface employees who appeared as
// the operator on dispatches. Returns a richer per-employee
// row with name + dispatch count + last dispatch date.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentEmployeeRow {
  operatorName: string;
  dispatches: number;
  lastDispatchDate: string | null;
}

export interface EquipmentEmployeeSnapshotResult {
  asOf: string;
  equipmentId: string;
  distinctEmployees: number;
  totalDispatches: number;
  rows: EquipmentEmployeeRow[];
}

export interface EquipmentEmployeeSnapshotInputs {
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

export function buildEquipmentEmployeeSnapshot(
  inputs: EquipmentEmployeeSnapshotInputs,
): EquipmentEmployeeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.equipmentName);

  type Row = { name: string; dispatches: number; lastDate: string | null };
  const byOp = new Map<string, Row>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let opName: string | undefined;
    let appeared = false;
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
    if (!opName) continue;
    const key = opName.trim();
    const cur = byOp.get(key) ?? { name: key, dispatches: 0, lastDate: null };
    cur.dispatches += 1;
    if (cur.lastDate == null || d.scheduledFor > cur.lastDate) cur.lastDate = d.scheduledFor;
    byOp.set(key, cur);
  }

  const rows = [...byOp.values()]
    .map((r) => ({
      operatorName: r.name,
      dispatches: r.dispatches,
      lastDispatchDate: r.lastDate,
    }))
    .sort((a, b) => b.dispatches - a.dispatches || a.operatorName.localeCompare(b.operatorName));

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    distinctEmployees: byOp.size,
    totalDispatches,
    rows,
  };
}
