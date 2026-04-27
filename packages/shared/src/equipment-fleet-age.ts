// Equipment fleet age + replacement-readiness report.
//
// Plain English: every piece of iron has a useful life. A 1998 Cat
// dozer with 18,000 hours on it is on borrowed time; the next major
// repair is going to cost more than the unit is worth. This walks
// the equipment master and surfaces:
//   - units past expected useful life (model year + age threshold)
//   - units approaching usage limits (hours/miles)
//   - units with high recent maintenance spend (>20% of category
//     replacement cost in the last 12 months — repair-or-replace
//     signal)
//
// Pure derivation. No persisted records.

import type { Equipment, EquipmentCategory } from './equipment';

export type FleetAgeFlag =
  | 'YOUNG'        // <50% of useful-life threshold
  | 'MATURE'       // 50-79%
  | 'AGING'        // 80-100%
  | 'OVER_LIFE';   // exceeded threshold

export interface FleetAgeRow {
  equipmentId: string;
  name: string;
  category: EquipmentCategory;
  modelYear: number | null;
  ageYears: number | null;
  /** HOURS or MILES. */
  usageMetric: Equipment['usageMetric'];
  currentUsage: number;
  /** Useful-life ceiling for this category (hours or miles depending). */
  usefulLifeUsage: number;
  usageLifePct: number;
  /** Total maintenance spend in the last 12 months. */
  recentMaintenanceCents: number;
  /** Recent maintenance as % of approximate replacement cost. */
  maintenanceVsReplacementPct: number;
  flag: FleetAgeFlag;
}

export interface FleetAgeRollup {
  unitsConsidered: number;
  young: number;
  mature: number;
  aging: number;
  overLife: number;
  totalRecentMaintenanceCents: number;
}

export interface FleetAgeInputs {
  asOf?: string;
  equipment: Equipment[];
}

/** Useful-life thresholds (hours for heavy iron, miles for trucks). */
const USEFUL_LIFE: Record<EquipmentCategory, { hours?: number; miles?: number }> = {
  TRUCK: { miles: 250_000 },
  TRAILER: { miles: 500_000 },
  DOZER: { hours: 15_000 },
  EXCAVATOR: { hours: 12_000 },
  LOADER: { hours: 12_000 },
  BACKHOE: { hours: 10_000 },
  GRADER: { hours: 15_000 },
  ROLLER: { hours: 8_000 },
  PAVER: { hours: 10_000 },
  COMPACTOR_LARGE: { hours: 6_000 },
  WATER_TRUCK: { miles: 200_000 },
  SWEEPER: { miles: 150_000 },
  GENERATOR_LARGE: { hours: 12_000 },
  SUPPORT: { hours: 8_000, miles: 200_000 },
  OTHER: { hours: 10_000, miles: 200_000 },
};

/** Approximate replacement cost (cents) by category. Used as the
 *  denominator for the "is repair worth it?" ratio. Numbers are
 *  rough mid-range used-equipment market estimates. */
const REPLACEMENT_COST: Record<EquipmentCategory, number> = {
  TRUCK: 80_000_00,
  TRAILER: 30_000_00,
  DOZER: 250_000_00,
  EXCAVATOR: 200_000_00,
  LOADER: 180_000_00,
  BACKHOE: 100_000_00,
  GRADER: 250_000_00,
  ROLLER: 120_000_00,
  PAVER: 200_000_00,
  COMPACTOR_LARGE: 80_000_00,
  WATER_TRUCK: 90_000_00,
  SWEEPER: 100_000_00,
  GENERATOR_LARGE: 50_000_00,
  SUPPORT: 60_000_00,
  OTHER: 50_000_00,
};

export function buildEquipmentFleetAge(inputs: FleetAgeInputs): {
  rollup: FleetAgeRollup;
  rows: FleetAgeRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const oneYearAgo = new Date(refNow);
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const asOfYear = refNow.getUTCFullYear();

  const counts = { young: 0, mature: 0, aging: 0, overLife: 0 };
  let totalRecent = 0;

  const rows: FleetAgeRow[] = [];
  for (const e of inputs.equipment) {
    if (e.status === 'RETIRED' || e.status === 'SOLD') continue;

    const life = USEFUL_LIFE[e.category];
    const lifeUsage = e.usageMetric === 'HOURS'
      ? life.hours ?? 10_000
      : life.miles ?? 200_000;
    const usagePct = lifeUsage === 0 ? 0 : e.currentUsage / lifeUsage;

    let recentMaintenance = 0;
    for (const log of e.maintenanceLog) {
      const performedAt = parseDate(log.performedAt);
      if (!performedAt) continue;
      if (performedAt.getTime() < oneYearAgo.getTime()) continue;
      recentMaintenance += log.costCents ?? 0;
    }

    const replacement = REPLACEMENT_COST[e.category];
    const maintRatio = replacement === 0 ? 0 : recentMaintenance / replacement;

    let flag: FleetAgeFlag;
    if (usagePct >= 1) flag = 'OVER_LIFE';
    else if (usagePct >= 0.8) flag = 'AGING';
    else if (usagePct >= 0.5) flag = 'MATURE';
    else flag = 'YOUNG';

    if (flag === 'YOUNG') counts.young += 1;
    else if (flag === 'MATURE') counts.mature += 1;
    else if (flag === 'AGING') counts.aging += 1;
    else counts.overLife += 1;

    rows.push({
      equipmentId: e.id,
      name: e.name,
      category: e.category,
      modelYear: e.year ?? null,
      ageYears: e.year != null ? asOfYear - e.year : null,
      usageMetric: e.usageMetric,
      currentUsage: e.currentUsage,
      usefulLifeUsage: lifeUsage,
      usageLifePct: round4(usagePct),
      recentMaintenanceCents: recentMaintenance,
      maintenanceVsReplacementPct: round4(maintRatio),
      flag,
    });

    totalRecent += recentMaintenance;
  }

  // Worst (OVER_LIFE) first, then by usage pct desc.
  const tierRank: Record<FleetAgeFlag, number> = {
    OVER_LIFE: 0,
    AGING: 1,
    MATURE: 2,
    YOUNG: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return b.usageLifePct - a.usageLifePct;
  });

  return {
    rollup: {
      unitsConsidered: rows.length,
      young: counts.young,
      mature: counts.mature,
      aging: counts.aging,
      overLife: counts.overLife,
      totalRecentMaintenanceCents: totalRecent,
    },
    rows,
  };
}

function parseDate(s: string): Date | null {
  const head = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return null;
  const d = new Date(`${head}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
