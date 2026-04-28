// Per-month equipment maintenance volume.
//
// Plain English: walks every equipment piece's
// maintenanceLog[] and buckets by yyyy-mm of performedAt. Per
// month: total maintenance events, total cost spent (where cost
// is recorded), distinct equipment serviced, breakdown by
// MaintenanceKind.
//
// Different from equipment-maintenance-cost (per-equipment
// lifetime) and equipment-service (per-service detail). This
// is the time-series view of fleet maintenance spend.
//
// Pure derivation. No persisted records.

import type { Equipment, MaintenanceKind } from './equipment';

export interface EquipmentMaintenanceMonthRow {
  month: string;
  events: number;
  totalCostCents: number;
  /** Events with no costCents value. Surfaced so the office can
   *  chase missing invoices. */
  costMissingCount: number;
  distinctEquipment: number;
  byKind: Partial<Record<MaintenanceKind, number>>;
}

export interface EquipmentMaintenanceMonthlyRollup {
  monthsConsidered: number;
  totalEvents: number;
  totalCostCents: number;
  monthOverMonthCostChange: number;
}

export interface EquipmentMaintenanceMonthlyInputs {
  equipment: Equipment[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildEquipmentMaintenanceMonthly(
  inputs: EquipmentMaintenanceMonthlyInputs,
): {
  rollup: EquipmentMaintenanceMonthlyRollup;
  rows: EquipmentMaintenanceMonthRow[];
} {
  type Bucket = {
    month: string;
    events: number;
    cost: number;
    missing: number;
    eq: Set<string>;
    byKind: Map<MaintenanceKind, number>;
  };
  const buckets = new Map<string, Bucket>();

  for (const eq of inputs.equipment) {
    for (const entry of eq.maintenanceLog ?? []) {
      const month = entry.performedAt.slice(0, 7);
      if (month.length < 7) continue;
      if (inputs.fromMonth && month < inputs.fromMonth) continue;
      if (inputs.toMonth && month > inputs.toMonth) continue;
      const b = buckets.get(month) ?? {
        month,
        events: 0,
        cost: 0,
        missing: 0,
        eq: new Set<string>(),
        byKind: new Map<MaintenanceKind, number>(),
      };
      b.events += 1;
      if (typeof entry.costCents === 'number') b.cost += entry.costCents;
      else b.missing += 1;
      b.eq.add(eq.id);
      b.byKind.set(entry.kind, (b.byKind.get(entry.kind) ?? 0) + 1);
      buckets.set(month, b);
    }
  }

  const rows: EquipmentMaintenanceMonthRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<MaintenanceKind, number>> = {};
      for (const [k, v] of b.byKind.entries()) obj[k] = v;
      return {
        month: b.month,
        events: b.events,
        totalCostCents: b.cost,
        costMissingCount: b.missing,
        distinctEquipment: b.eq.size,
        byKind: obj,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.totalCostCents - prev.totalCostCents;
  }

  let totalEvents = 0;
  let totalCost = 0;
  for (const r of rows) {
    totalEvents += r.events;
    totalCost += r.totalCostCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalEvents,
      totalCostCents: totalCost,
      monthOverMonthCostChange: mom,
    },
    rows,
  };
}
