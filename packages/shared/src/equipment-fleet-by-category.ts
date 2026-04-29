// Equipment fleet snapshot by category.
//
// Plain English: roll the equipment master up by EquipmentCategory
// (EXCAVATOR / DOZER / LOADER / SCRAPER / GRADER / ROLLER /
// DUMP_TRUCK / SERVICE_TRUCK / etc.). Counts active vs inactive
// units per category and the avg / max age. Drives the fleet
// review — "we have 4 dozers averaging 18 years old, time to
// rotate one."
//
// Active = status in [IN_YARD, ASSIGNED, IN_SERVICE]. Inactive =
// OUT_FOR_REPAIR / RETIRED / SOLD.
//
// Per row: category, total, activeCount, inactiveCount, avgAgeYears,
// maxAgeYears, makeMix.
//
// Sort: total desc.
//
// Different from equipment-by-make (per make), equipment-fleet-age
// (per piece), equipment-fleet-by-year (per model year),
// equipment-by-status (status mix).
//
// Pure derivation. No persisted records.

import type { Equipment, EquipmentCategory, EquipmentStatus } from './equipment';

const ACTIVE_STATUSES: ReadonlyArray<EquipmentStatus> = [
  'IN_YARD',
  'ASSIGNED',
  'IN_SERVICE',
];

export interface EquipmentFleetByCategoryRow {
  category: EquipmentCategory;
  total: number;
  activeCount: number;
  inactiveCount: number;
  avgAgeYears: number;
  maxAgeYears: number;
  /** Per-make count within the category. */
  makeMix: Partial<Record<string, number>>;
}

export interface EquipmentFleetByCategoryRollup {
  categoriesConsidered: number;
  totalUnits: number;
  totalActive: number;
  totalInactive: number;
}

export interface EquipmentFleetByCategoryInputs {
  equipment: Equipment[];
  /** Reference 'now' for age calc. Defaults to today. */
  asOf?: Date;
}

export function buildEquipmentFleetByCategory(
  inputs: EquipmentFleetByCategoryInputs,
): {
  rollup: EquipmentFleetByCategoryRollup;
  rows: EquipmentFleetByCategoryRow[];
} {
  const asOf = inputs.asOf ?? new Date();
  const refYear = asOf.getUTCFullYear();
  const activeSet = new Set<EquipmentStatus>(ACTIVE_STATUSES);

  type Acc = {
    category: EquipmentCategory;
    total: number;
    activeCount: number;
    inactiveCount: number;
    ageSum: number;
    ageCount: number;
    maxAge: number;
    makeMix: Map<string, number>;
  };
  const accs = new Map<EquipmentCategory, Acc>();

  let totalUnits = 0;
  let totalActive = 0;
  let totalInactive = 0;

  for (const eq of inputs.equipment) {
    let a = accs.get(eq.category);
    if (!a) {
      a = {
        category: eq.category,
        total: 0,
        activeCount: 0,
        inactiveCount: 0,
        ageSum: 0,
        ageCount: 0,
        maxAge: 0,
        makeMix: new Map(),
      };
      accs.set(eq.category, a);
    }
    a.total += 1;
    const status: EquipmentStatus = eq.status ?? 'IN_YARD';
    if (activeSet.has(status)) {
      a.activeCount += 1;
      totalActive += 1;
    } else {
      a.inactiveCount += 1;
      totalInactive += 1;
    }
    if (eq.year) {
      const age = Math.max(0, refYear - eq.year);
      a.ageSum += age;
      a.ageCount += 1;
      if (age > a.maxAge) a.maxAge = age;
    }
    const makeKey = (eq.make ?? 'Unknown').trim();
    a.makeMix.set(makeKey, (a.makeMix.get(makeKey) ?? 0) + 1);

    totalUnits += 1;
  }

  const rows: EquipmentFleetByCategoryRow[] = [...accs.values()]
    .map((a) => {
      const makeMix: Partial<Record<string, number>> = {};
      for (const [k, v] of a.makeMix) makeMix[k] = v;
      return {
        category: a.category,
        total: a.total,
        activeCount: a.activeCount,
        inactiveCount: a.inactiveCount,
        avgAgeYears:
          a.ageCount > 0 ? Math.round((a.ageSum / a.ageCount) * 10) / 10 : 0,
        maxAgeYears: a.maxAge,
        makeMix,
      };
    })
    .sort((x, y) => {
      if (y.total !== x.total) return y.total - x.total;
      return x.category.localeCompare(y.category);
    });

  return {
    rollup: {
      categoriesConsidered: rows.length,
      totalUnits,
      totalActive,
      totalInactive,
    },
    rows,
  };
}
