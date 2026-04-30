// Equipment-anchored maintenance year-over-year.
//
// Plain English: for one equipment unit, collapse two years of
// maintenance log entries into a comparison: counts, total
// cost cents, kind mix, plus deltas.
//
// Pure derivation. No persisted records.

import type { Equipment, MaintenanceKind } from './equipment';

export interface EquipmentMaintenanceYoyResult {
  equipmentId: string;
  priorYear: number;
  currentYear: number;
  priorEntries: number;
  priorCostCents: number;
  priorByKind: Partial<Record<MaintenanceKind, number>>;
  currentEntries: number;
  currentCostCents: number;
  currentByKind: Partial<Record<MaintenanceKind, number>>;
  entriesDelta: number;
  costCentsDelta: number;
}

export interface EquipmentMaintenanceYoyInputs {
  equipment: Equipment | undefined;
  currentYear: number;
}

export function buildEquipmentMaintenanceYoy(
  inputs: EquipmentMaintenanceYoyInputs,
): EquipmentMaintenanceYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    entries: number;
    cost: number;
    byKind: Map<MaintenanceKind, number>;
  };
  function emptyBucket(): Bucket {
    return { entries: 0, cost: 0, byKind: new Map() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const entry of inputs.equipment?.maintenanceLog ?? []) {
    const ymd = entry.performedAt?.slice(0, 4);
    const year = Number(ymd);
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.entries += 1;
    b.cost += entry.costCents ?? 0;
    b.byKind.set(entry.kind, (b.byKind.get(entry.kind) ?? 0) + 1);
  }

  function kindRecord(m: Map<MaintenanceKind, number>): Partial<Record<MaintenanceKind, number>> {
    const out: Partial<Record<MaintenanceKind, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    equipmentId: inputs.equipment?.id ?? '',
    priorYear,
    currentYear: inputs.currentYear,
    priorEntries: prior.entries,
    priorCostCents: prior.cost,
    priorByKind: kindRecord(prior.byKind),
    currentEntries: current.entries,
    currentCostCents: current.cost,
    currentByKind: kindRecord(current.byKind),
    entriesDelta: current.entries - prior.entries,
    costCentsDelta: current.cost - prior.cost,
  };
}
