// Equipment-anchored operator footprint snapshot.
//
// Plain English: for one equipment unit, as-of today, count
// distinct operators who appeared as operatorName on dispatch
// slots referencing the unit. Surface dispatch count per
// operator (top operator) + total dispatches.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentOperatorRow {
  operatorName: string;
  dispatches: number;
}

export interface EquipmentOperatorSnapshotResult {
  asOf: string;
  equipmentId: string;
  distinctOperators: number;
  totalDispatches: number;
  topOperators: EquipmentOperatorRow[];
}

export interface EquipmentOperatorSnapshotInputs {
  equipmentId: string;
  equipmentName?: string;
  dispatches: Dispatch[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Top-N operators by dispatch count. Default 5. */
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

export function buildEquipmentOperatorSnapshot(inputs: EquipmentOperatorSnapshotInputs): EquipmentOperatorSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.equipmentName);
  const topN = inputs.topN ?? 5;

  const counts = new Map<string, number>();
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
    if (opName) {
      const key = opName.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()]
    .map(([operatorName, dispatches]) => ({ operatorName, dispatches }))
    .sort((a, b) => b.dispatches - a.dispatches || a.operatorName.localeCompare(b.operatorName));

  return {
    asOf,
    equipmentId: inputs.equipmentId,
    distinctOperators: counts.size,
    totalDispatches,
    topOperators: sorted.slice(0, topN),
  };
}
