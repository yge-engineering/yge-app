// Portfolio equipment activity year-over-year.
//
// Plain English: collapse two years of dispatched-equipment
// activity + maintenance events into a single comparison.
// Sized for the fleet manager's annual review.
//
// Different from portfolio-equipment-monthly (per month).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

export interface PortfolioEquipmentYoyResult {
  priorYear: number;
  currentYear: number;
  priorDispatchedUnits: number;
  priorDispatchDays: number;
  priorMaintenanceEvents: number;
  priorMaintenanceCostCents: number;
  currentDispatchedUnits: number;
  currentDispatchDays: number;
  currentMaintenanceEvents: number;
  currentMaintenanceCostCents: number;
  dispatchDaysDelta: number;
  maintenanceCostCentsDelta: number;
}

export interface PortfolioEquipmentYoyInputs {
  dispatches: Dispatch[];
  equipment: Equipment[];
  currentYear: number;
}

export function buildPortfolioEquipmentYoy(
  inputs: PortfolioEquipmentYoyInputs,
): PortfolioEquipmentYoyResult {
  const priorYear = inputs.currentYear - 1;

  const priorUnits = new Set<string>();
  const priorDayKeys = new Set<string>();
  const currentUnits = new Set<string>();
  const currentDayKeys = new Set<string>();

  let priorMaintEvents = 0;
  let priorMaintCost = 0;
  let currentMaintEvents = 0;
  let currentMaintCost = 0;

  for (const d of inputs.dispatches) {
    const status = d.status ?? 'DRAFT';
    if (status === 'DRAFT' || status === 'CANCELLED') continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let units: Set<string> | null = null;
    let dayKeys: Set<string> | null = null;
    if (year === priorYear) {
      units = priorUnits;
      dayKeys = priorDayKeys;
    } else if (year === inputs.currentYear) {
      units = currentUnits;
      dayKeys = currentDayKeys;
    }
    if (!units || !dayKeys) continue;
    for (const e of d.equipment ?? []) {
      const unitKey = e.equipmentId ?? `name:${e.name.toLowerCase().trim()}`;
      units.add(unitKey);
      dayKeys.add(`${unitKey}__${d.scheduledFor}`);
    }
  }

  for (const eq of inputs.equipment) {
    for (const log of eq.maintenanceLog ?? []) {
      const year = Number(log.performedAt.slice(0, 4));
      if (year === priorYear) {
        priorMaintEvents += 1;
        priorMaintCost += log.costCents ?? 0;
      } else if (year === inputs.currentYear) {
        currentMaintEvents += 1;
        currentMaintCost += log.costCents ?? 0;
      }
    }
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorDispatchedUnits: priorUnits.size,
    priorDispatchDays: priorDayKeys.size,
    priorMaintenanceEvents: priorMaintEvents,
    priorMaintenanceCostCents: priorMaintCost,
    currentDispatchedUnits: currentUnits.size,
    currentDispatchDays: currentDayKeys.size,
    currentMaintenanceEvents: currentMaintEvents,
    currentMaintenanceCostCents: currentMaintCost,
    dispatchDaysDelta: currentDayKeys.size - priorDayKeys.size,
    maintenanceCostCentsDelta: currentMaintCost - priorMaintCost,
  };
}
