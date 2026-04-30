// Portfolio equipment fleet snapshot.
//
// Plain English: as-of today, count units in fleet, break down
// by category + status, count active vs retired/sold, count
// units due for service, and surface fleet age (avg model
// year). Drives the right-now equipment-readiness overview.
//
// Pure derivation. No persisted records.

import type { Equipment, EquipmentCategory, EquipmentStatus } from './equipment';

import { isServiceDue } from './equipment';

export interface PortfolioEquipmentFleetSnapshotResult {
  asOf: string;
  totalUnits: number;
  activeUnits: number;
  retiredOrSoldUnits: number;
  inYardUnits: number;
  assignedUnits: number;
  inServiceUnits: number;
  outForRepairUnits: number;
  serviceDueUnits: number;
  byCategory: Partial<Record<EquipmentCategory, number>>;
  byStatus: Partial<Record<EquipmentStatus, number>>;
  /** Average model year across active fleet (rounded). null if no
   *  active unit has a model year. */
  averageActiveModelYear: number | null;
}

export interface PortfolioEquipmentFleetSnapshotInputs {
  equipment: Equipment[];
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

export function buildPortfolioEquipmentFleetSnapshot(
  inputs: PortfolioEquipmentFleetSnapshotInputs,
): PortfolioEquipmentFleetSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byCategory = new Map<EquipmentCategory, number>();
  const byStatus = new Map<EquipmentStatus, number>();

  let totalUnits = 0;
  let activeUnits = 0;
  let retiredOrSoldUnits = 0;
  let inYardUnits = 0;
  let assignedUnits = 0;
  let inServiceUnits = 0;
  let outForRepairUnits = 0;
  let serviceDueUnits = 0;
  let modelYearSum = 0;
  let modelYearCount = 0;

  for (const eq of inputs.equipment) {
    totalUnits += 1;
    byCategory.set(eq.category, (byCategory.get(eq.category) ?? 0) + 1);
    const status: EquipmentStatus = eq.status ?? 'IN_YARD';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (status === 'IN_YARD') inYardUnits += 1;
    else if (status === 'ASSIGNED') assignedUnits += 1;
    else if (status === 'IN_SERVICE') inServiceUnits += 1;
    else if (status === 'OUT_FOR_REPAIR') outForRepairUnits += 1;
    if (status === 'RETIRED' || status === 'SOLD') {
      retiredOrSoldUnits += 1;
    } else {
      activeUnits += 1;
      if (eq.year) {
        modelYearSum += eq.year;
        modelYearCount += 1;
      }
      if (isServiceDue(eq)) serviceDueUnits += 1;
    }
  }

  const cOut: Partial<Record<EquipmentCategory, number>> = {};
  for (const [k, v] of byCategory) cOut[k] = v;
  const sOut: Partial<Record<EquipmentStatus, number>> = {};
  for (const [k, v] of byStatus) sOut[k] = v;

  return {
    asOf,
    totalUnits,
    activeUnits,
    retiredOrSoldUnits,
    inYardUnits,
    assignedUnits,
    inServiceUnits,
    outForRepairUnits,
    serviceDueUnits,
    byCategory: cOut,
    byStatus: sOut,
    averageActiveModelYear: modelYearCount > 0
      ? Math.round(modelYearSum / modelYearCount)
      : null,
  };
}
