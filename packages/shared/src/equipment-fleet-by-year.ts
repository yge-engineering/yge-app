// Equipment fleet by model year.
//
// Plain English: roll the equipment master up by `year` (model
// year) — useful for spotting the iron-aging trend and the
// "we've been buying older every year" decision pattern.
//
// Per row: year, total, byCategory, activeCount.
//
// Sort by year asc.
//
// Different from equipment-fleet-age (per-piece age), equipment-
// by-make (manufacturer mix), equipment-by-status (status mix).
//
// Pure derivation. No persisted records.

import type {
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
} from './equipment';

const ACTIVE: ReadonlyArray<EquipmentStatus> = ['IN_YARD', 'ASSIGNED', 'IN_SERVICE'];

export interface EquipmentFleetByYearRow {
  year: number;
  total: number;
  activeCount: number;
  byCategory: Partial<Record<EquipmentCategory, number>>;
}

export interface EquipmentFleetByYearRollup {
  yearsConsidered: number;
  totalUnits: number;
  unattributed: number;
}

export interface EquipmentFleetByYearInputs {
  equipment: Equipment[];
}

export function buildEquipmentFleetByYear(
  inputs: EquipmentFleetByYearInputs,
): {
  rollup: EquipmentFleetByYearRollup;
  rows: EquipmentFleetByYearRow[];
} {
  type Acc = {
    year: number;
    total: number;
    active: number;
    cats: Map<EquipmentCategory, number>;
  };
  const accs = new Map<number, Acc>();
  let unattributed = 0;

  for (const eq of inputs.equipment) {
    if (eq.year == null) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(eq.year) ?? {
      year: eq.year,
      total: 0,
      active: 0,
      cats: new Map<EquipmentCategory, number>(),
    };
    acc.total += 1;
    if (ACTIVE.includes(eq.status)) acc.active += 1;
    acc.cats.set(eq.category, (acc.cats.get(eq.category) ?? 0) + 1);
    accs.set(eq.year, acc);
  }

  const rows: EquipmentFleetByYearRow[] = [];
  for (const acc of Array.from(accs.values()).sort((a, b) => a.year - b.year)) {
    const obj: Partial<Record<EquipmentCategory, number>> = {};
    for (const [k, v] of acc.cats.entries()) obj[k] = v;
    rows.push({
      year: acc.year,
      total: acc.total,
      activeCount: acc.active,
      byCategory: obj,
    });
  }

  return {
    rollup: {
      yearsConsidered: rows.length,
      totalUnits: inputs.equipment.length,
      unattributed,
    },
    rows,
  };
}
