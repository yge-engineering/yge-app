// Equipment count by status × category.
//
// Plain English: roll the equipment master up by EquipmentStatus
// (ACTIVE / IN_SHOP / SOLD / RETIRED / RESERVED), with category
// breakdown per status. Useful for the fleet review.
//
// Per row: status, total, byCategory (TRUCK / EXCAVATOR /
// LOADER / etc.).
//
// Sort: ACTIVE → IN_SHOP → RESERVED → RETIRED → SOLD.
//
// Different from equipment-fleet-age (per-piece), equipment-idle
// (idle days), equipment-cost-per-day. This is the snapshot mix.
//
// Pure derivation. No persisted records.

import type {
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
} from './equipment';

export interface EquipmentByStatusRow {
  status: EquipmentStatus;
  total: number;
  byCategory: Partial<Record<EquipmentCategory, number>>;
}

export interface EquipmentByStatusRollup {
  statusesConsidered: number;
  totalUnits: number;
  activeCount: number;
}

export interface EquipmentByStatusInputs {
  equipment: Equipment[];
}

const ORDER: EquipmentStatus[] = ['IN_YARD', 'ASSIGNED', 'IN_SERVICE', 'OUT_FOR_REPAIR', 'RETIRED', 'SOLD'];

export function buildEquipmentByStatus(
  inputs: EquipmentByStatusInputs,
): {
  rollup: EquipmentByStatusRollup;
  rows: EquipmentByStatusRow[];
} {
  type Acc = {
    total: number;
    cats: Map<EquipmentCategory, number>;
  };
  const accs = new Map<EquipmentStatus, Acc>();
  for (const s of ORDER) accs.set(s, { total: 0, cats: new Map() });
  let active = 0;

  for (const eq of inputs.equipment) {
    const acc = accs.get(eq.status);
    if (!acc) continue;
    acc.total += 1;
    acc.cats.set(eq.category, (acc.cats.get(eq.category) ?? 0) + 1);
    if (eq.status === 'IN_YARD' || eq.status === 'ASSIGNED' || eq.status === 'IN_SERVICE') active += 1;
  }

  const rows: EquipmentByStatusRow[] = [];
  for (const status of ORDER) {
    const acc = accs.get(status);
    if (!acc) continue;
    const obj: Partial<Record<EquipmentCategory, number>> = {};
    for (const [k, v] of acc.cats.entries()) obj[k] = v;
    rows.push({
      status,
      total: acc.total,
      byCategory: obj,
    });
  }

  return {
    rollup: {
      statusesConsidered: rows.length,
      totalUnits: inputs.equipment.length,
      activeCount: active,
    },
    rows,
  };
}
