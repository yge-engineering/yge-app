// Equipment fleet by make.
//
// Plain English: roll the equipment master up by `make` field —
// CAT, Komatsu, John Deere, Volvo, Ford, etc. Useful for the
// "all our heavy iron is one make → vendor risk" review and the
// service-shop coverage check.
//
// Per row: make, total, byCategory mix, activeCount.
//
// Sort by total desc.
//
// Different from equipment-by-status (status mix),
// equipment-fleet-age (per-piece age), equipment-cost-per-day.
//
// Pure derivation. No persisted records.

import type {
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
} from './equipment';

const ACTIVE_STATUSES: ReadonlyArray<EquipmentStatus> = ['IN_YARD', 'ASSIGNED', 'IN_SERVICE'];

export interface EquipmentByMakeRow {
  make: string;
  total: number;
  activeCount: number;
  byCategory: Partial<Record<EquipmentCategory, number>>;
}

export interface EquipmentByMakeRollup {
  makesConsidered: number;
  totalUnits: number;
  unattributed: number;
}

export interface EquipmentByMakeInputs {
  equipment: Equipment[];
}

export function buildEquipmentByMake(
  inputs: EquipmentByMakeInputs,
): {
  rollup: EquipmentByMakeRollup;
  rows: EquipmentByMakeRow[];
} {
  type Acc = {
    display: string;
    total: number;
    active: number;
    cats: Map<EquipmentCategory, number>;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;

  for (const eq of inputs.equipment) {
    const display = (eq.make ?? '').trim();
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = display.toLowerCase();
    const acc = accs.get(key) ?? {
      display,
      total: 0,
      active: 0,
      cats: new Map<EquipmentCategory, number>(),
    };
    acc.total += 1;
    if (ACTIVE_STATUSES.includes(eq.status)) acc.active += 1;
    acc.cats.set(eq.category, (acc.cats.get(eq.category) ?? 0) + 1);
    accs.set(key, acc);
  }

  const rows: EquipmentByMakeRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<EquipmentCategory, number>> = {};
    for (const [k, v] of acc.cats.entries()) obj[k] = v;
    rows.push({
      make: acc.display,
      total: acc.total,
      activeCount: acc.active,
      byCategory: obj,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      makesConsidered: rows.length,
      totalUnits: inputs.equipment.length,
      unattributed,
    },
    rows,
  };
}
