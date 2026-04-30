// Portfolio equipment fleet YoY (year-end snapshot).
//
// Plain English: take a year-end snapshot of equipment that
// existed by year-end (createdAt on/before Dec 31), grouped
// by status. YoY tracks fleet growth or contraction.
//
// Per row: prior + current totals, active vs inactive, plus
// delta. Active = IN_YARD / ASSIGNED / IN_SERVICE.
//
// Different from equipment-fleet-by-status-monthly (per
// month), portfolio-equipment-yoy (dispatch + maintenance
// activity, not snapshot). This is the fleet-size YoY.
//
// Pure derivation. No persisted records.

import type { Equipment, EquipmentStatus } from './equipment';

const ACTIVE_STATUSES: ReadonlyArray<EquipmentStatus> = [
  'IN_YARD',
  'ASSIGNED',
  'IN_SERVICE',
];

export interface PortfolioEquipmentFleetYoyBucket {
  totalUnits: number;
  activeCount: number;
  inactiveCount: number;
  byStatus: Partial<Record<EquipmentStatus, number>>;
}

export interface PortfolioEquipmentFleetYoyResult {
  priorYear: number;
  currentYear: number;
  prior: PortfolioEquipmentFleetYoyBucket;
  current: PortfolioEquipmentFleetYoyBucket;
  totalUnitsDelta: number;
}

export interface PortfolioEquipmentFleetYoyInputs {
  equipment: Equipment[];
  currentYear: number;
}

function snapshot(equipment: Equipment[], asOf: string): PortfolioEquipmentFleetYoyBucket {
  let totalUnits = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  const byStatus = new Map<EquipmentStatus, number>();
  const activeSet = new Set<EquipmentStatus>(ACTIVE_STATUSES);

  for (const eq of equipment) {
    if (eq.createdAt > `${asOf}T23:59:59.999Z`) continue;
    totalUnits += 1;
    const status: EquipmentStatus = eq.status ?? 'IN_YARD';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    if (activeSet.has(status)) activeCount += 1;
    else inactiveCount += 1;
  }

  const out: Partial<Record<EquipmentStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;
  return { totalUnits, activeCount, inactiveCount, byStatus: out };
}

export function buildPortfolioEquipmentFleetYoy(
  inputs: PortfolioEquipmentFleetYoyInputs,
): PortfolioEquipmentFleetYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = snapshot(inputs.equipment, `${priorYear}-12-31`);
  const current = snapshot(inputs.equipment, `${inputs.currentYear}-12-31`);
  return {
    priorYear,
    currentYear: inputs.currentYear,
    prior,
    current,
    totalUnitsDelta: current.totalUnits - prior.totalUnits,
  };
}
