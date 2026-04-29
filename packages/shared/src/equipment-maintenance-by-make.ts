// Equipment maintenance cost rolled up by make.
//
// Plain English: total maintenance \$ + event count grouped by
// manufacturer make. Drives "CAT iron costs less per dollar
// than Komatsu in our fleet" or vendor-shop reliability checks.
//
// Per row: make, totalCostCents, eventCount, byKind, units.
//
// Sort by totalCostCents desc.
//
// Different from equipment-maintenance-cost (per-piece),
// equipment-by-make (count by make).
//
// Pure derivation. No persisted records.

import type { Equipment, MaintenanceKind } from './equipment';

export interface EquipmentMaintenanceByMakeRow {
  make: string;
  totalCostCents: number;
  eventCount: number;
  byKind: Partial<Record<MaintenanceKind, number>>;
  units: number;
}

export interface EquipmentMaintenanceByMakeRollup {
  makesConsidered: number;
  totalCostCents: number;
  totalEvents: number;
  unattributed: number;
}

export interface EquipmentMaintenanceByMakeInputs {
  equipment: Equipment[];
  /** Optional yyyy-mm-dd window applied to performedAt slice. */
  fromDate?: string;
  toDate?: string;
}

export function buildEquipmentMaintenanceByMake(
  inputs: EquipmentMaintenanceByMakeInputs,
): {
  rollup: EquipmentMaintenanceByMakeRollup;
  rows: EquipmentMaintenanceByMakeRow[];
} {
  type Acc = {
    display: string;
    cost: number;
    events: number;
    byKind: Map<MaintenanceKind, number>;
    units: number;
  };
  const accs = new Map<string, Acc>();
  let totalCost = 0;
  let totalEvents = 0;
  let unattributed = 0;

  for (const eq of inputs.equipment) {
    const make = (eq.make ?? '').trim();
    if (!make) {
      unattributed += 1;
      continue;
    }
    const key = make.toLowerCase();
    const acc = accs.get(key) ?? {
      display: make,
      cost: 0,
      events: 0,
      byKind: new Map<MaintenanceKind, number>(),
      units: 0,
    };
    acc.units += 1;
    for (const m of eq.maintenanceLog) {
      const slice = m.performedAt.slice(0, 10);
      if (inputs.fromDate && slice < inputs.fromDate) continue;
      if (inputs.toDate && slice > inputs.toDate) continue;
      acc.cost += m.costCents ?? 0;
      acc.events += 1;
      acc.byKind.set(m.kind, (acc.byKind.get(m.kind) ?? 0) + 1);
      totalCost += m.costCents ?? 0;
      totalEvents += 1;
    }
    accs.set(key, acc);
  }

  const rows: EquipmentMaintenanceByMakeRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<MaintenanceKind, number>> = {};
    for (const [k, v] of acc.byKind.entries()) obj[k] = v;
    rows.push({
      make: acc.display,
      totalCostCents: acc.cost,
      eventCount: acc.events,
      byKind: obj,
      units: acc.units,
    });
  }

  rows.sort((a, b) => b.totalCostCents - a.totalCostCents);

  return {
    rollup: {
      makesConsidered: rows.length,
      totalCostCents: totalCost,
      totalEvents,
      unattributed,
    },
    rows,
  };
}
