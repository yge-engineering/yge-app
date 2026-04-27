// Equipment maintenance cost rollup.
//
// Plain English: for each piece of equipment, what's the total
// maintenance burn over a period? Broken down by maintenance kind
// (oil change vs engine major vs breakdown repair). Drives the
// "is this truck worth keeping?" decision.
//
// Pure derivation. No persisted records.

import type { Equipment, MaintenanceKind } from './equipment';

export interface EquipmentMaintenanceRow {
  equipmentId: string;
  name: string;
  category: Equipment['category'];
  /** Total maintenance cost (cents) in the window. */
  totalCostCents: number;
  /** Cost broken down by maintenance kind. */
  byKind: Partial<Record<MaintenanceKind, number>>;
  /** Number of maintenance events. */
  eventCount: number;
  /** Earliest event date. */
  firstEventOn: string | null;
  /** Latest event date. */
  lastEventOn: string | null;
}

export interface EquipmentMaintenanceCostRollup {
  totalCostCents: number;
  byKind: Partial<Record<MaintenanceKind, number>>;
  unitCount: number;
}

export interface EquipmentMaintenanceCostReport {
  start: string;
  end: string;
  rows: EquipmentMaintenanceRow[];
  rollup: EquipmentMaintenanceCostRollup;
}

export interface EquipmentMaintenanceCostInputs {
  /** ISO yyyy-mm-dd inclusive. */
  start: string;
  end: string;
  equipment: Equipment[];
}

export function buildEquipmentMaintenanceCost(
  inputs: EquipmentMaintenanceCostInputs,
): EquipmentMaintenanceCostReport {
  const { start, end, equipment } = inputs;

  const rows: EquipmentMaintenanceRow[] = [];
  let portfolioTotal = 0;
  const portfolioByKind: Partial<Record<MaintenanceKind, number>> = {};
  let unitsWithActivity = 0;

  for (const eq of equipment) {
    let total = 0;
    let count = 0;
    let firstOn: string | null = null;
    let lastOn: string | null = null;
    const byKind: Partial<Record<MaintenanceKind, number>> = {};

    for (const m of eq.maintenanceLog ?? []) {
      const date = (m.performedAt ?? '').slice(0, 10);
      if (date < start || date > end) continue;
      const cost = m.costCents ?? 0;
      total += cost;
      count += 1;
      byKind[m.kind] = (byKind[m.kind] ?? 0) + cost;
      portfolioByKind[m.kind] = (portfolioByKind[m.kind] ?? 0) + cost;
      if (!firstOn || date < firstOn) firstOn = date;
      if (!lastOn || date > lastOn) lastOn = date;
    }

    if (count === 0) continue;

    unitsWithActivity += 1;
    portfolioTotal += total;
    rows.push({
      equipmentId: eq.id,
      name: eq.name,
      category: eq.category,
      totalCostCents: total,
      byKind,
      eventCount: count,
      firstEventOn: firstOn,
      lastEventOn: lastOn,
    });
  }

  rows.sort((a, b) => b.totalCostCents - a.totalCostCents);

  return {
    start,
    end,
    rows,
    rollup: {
      totalCostCents: portfolioTotal,
      byKind: portfolioByKind,
      unitCount: unitsWithActivity,
    },
  };
}
