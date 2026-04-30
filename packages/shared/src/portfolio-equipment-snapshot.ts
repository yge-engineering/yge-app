// Portfolio equipment snapshot.
//
// Plain English: point-in-time count of every piece of
// equipment, broken down by status, category, make, plus
// active vs inactive count and average + max age. Drives the
// fleet-manager's right-now overview.
//
// Active = IN_YARD / ASSIGNED / IN_SERVICE.
//
// Pure derivation. No persisted records.

import type {
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
} from './equipment';

const ACTIVE_STATUSES: ReadonlyArray<EquipmentStatus> = [
  'IN_YARD',
  'ASSIGNED',
  'IN_SERVICE',
];

export interface PortfolioEquipmentSnapshotResult {
  totalUnits: number;
  activeCount: number;
  inactiveCount: number;
  byStatus: Partial<Record<EquipmentStatus, number>>;
  byCategory: Partial<Record<EquipmentCategory, number>>;
  byMake: Partial<Record<string, number>>;
  avgAgeYears: number;
  maxAgeYears: number;
}

export interface PortfolioEquipmentSnapshotInputs {
  equipment: Equipment[];
  /** Reference 'now' for age calc. Defaults to today. */
  asOf?: Date;
}

export function buildPortfolioEquipmentSnapshot(
  inputs: PortfolioEquipmentSnapshotInputs,
): PortfolioEquipmentSnapshotResult {
  const asOf = inputs.asOf ?? new Date();
  const refYear = asOf.getUTCFullYear();
  const activeSet = new Set<EquipmentStatus>(ACTIVE_STATUSES);

  const byStatus = new Map<EquipmentStatus, number>();
  const byCategory = new Map<EquipmentCategory, number>();
  const byMake = new Map<string, number>();
  let activeCount = 0;
  let inactiveCount = 0;
  let ageSum = 0;
  let ageCount = 0;
  let maxAge = 0;

  for (const eq of inputs.equipment) {
    const status: EquipmentStatus = eq.status ?? 'IN_YARD';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byCategory.set(eq.category, (byCategory.get(eq.category) ?? 0) + 1);
    const make = (eq.make ?? 'Unknown').trim();
    byMake.set(make, (byMake.get(make) ?? 0) + 1);
    if (activeSet.has(status)) activeCount += 1;
    else inactiveCount += 1;
    if (eq.year) {
      const age = Math.max(0, refYear - eq.year);
      ageSum += age;
      ageCount += 1;
      if (age > maxAge) maxAge = age;
    }
  }

  function statusRecord(m: Map<EquipmentStatus, number>): Partial<Record<EquipmentStatus, number>> {
    const out: Partial<Record<EquipmentStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function catRecord(m: Map<EquipmentCategory, number>): Partial<Record<EquipmentCategory, number>> {
    const out: Partial<Record<EquipmentCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function makeRecord(m: Map<string, number>): Partial<Record<string, number>> {
    const out: Partial<Record<string, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalUnits: inputs.equipment.length,
    activeCount,
    inactiveCount,
    byStatus: statusRecord(byStatus),
    byCategory: catRecord(byCategory),
    byMake: makeRecord(byMake),
    avgAgeYears: ageCount > 0 ? Math.round((ageSum / ageCount) * 10) / 10 : 0,
    maxAgeYears: maxAge,
  };
}
