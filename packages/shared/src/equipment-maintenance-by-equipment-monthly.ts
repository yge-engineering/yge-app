// Per (equipment, month) maintenance event rollup.
//
// Plain English: walks every equipment piece's maintenanceLog
// and buckets by (equipmentId, yyyy-mm of performedAt). Counts
// events, sums recorded cost cents, breaks down by
// MaintenanceKind. Per-unit time-series cousin of
// equipment-maintenance-monthly (portfolio per month) and
// equipment-maintenance-by-make (per make, lifetime).
//
// Per row: equipmentId, name, month, events, totalCostCents,
// costMissingCount, byKind.
//
// Sort: equipmentId asc, month asc.
//
// Different from equipment-maintenance-cost (per-equipment
// lifetime), equipment-maintenance-monthly (portfolio per
// month), equipment-maintenance-by-make (per make, lifetime).
//
// Pure derivation. No persisted records.

import type { Equipment, MaintenanceKind } from './equipment';

export interface EquipmentMaintenanceByEquipmentMonthlyRow {
  equipmentId: string;
  name: string;
  month: string;
  events: number;
  totalCostCents: number;
  costMissingCount: number;
  byKind: Partial<Record<MaintenanceKind, number>>;
}

export interface EquipmentMaintenanceByEquipmentMonthlyRollup {
  equipmentConsidered: number;
  monthsConsidered: number;
  totalEvents: number;
  totalCostCents: number;
  totalCostMissing: number;
}

export interface EquipmentMaintenanceByEquipmentMonthlyInputs {
  equipment: Equipment[];
  /** Optional yyyy-mm bounds inclusive applied to performedAt. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEquipmentMaintenanceByEquipmentMonthly(
  inputs: EquipmentMaintenanceByEquipmentMonthlyInputs,
): {
  rollup: EquipmentMaintenanceByEquipmentMonthlyRollup;
  rows: EquipmentMaintenanceByEquipmentMonthlyRow[];
} {
  type Acc = {
    equipmentId: string;
    name: string;
    month: string;
    events: number;
    totalCostCents: number;
    costMissingCount: number;
    byKind: Map<MaintenanceKind, number>;
  };
  const accs = new Map<string, Acc>();
  const equipmentIds = new Set<string>();
  const months = new Set<string>();

  let totalEvents = 0;
  let totalCostCents = 0;
  let totalCostMissing = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const eq of inputs.equipment) {
    const log = eq.maintenanceLog ?? [];
    for (const entry of log) {
      const month = entry.performedAt.slice(0, 7);
      if (fromM && month < fromM) continue;
      if (toM && month > toM) continue;
      const key = `${eq.id}__${month}`;
      let a = accs.get(key);
      if (!a) {
        a = {
          equipmentId: eq.id,
          name: eq.name,
          month,
          events: 0,
          totalCostCents: 0,
          costMissingCount: 0,
          byKind: new Map(),
        };
        accs.set(key, a);
      }
      a.events += 1;
      if (entry.costCents != null) {
        a.totalCostCents += entry.costCents;
      } else {
        a.costMissingCount += 1;
      }
      a.byKind.set(entry.kind, (a.byKind.get(entry.kind) ?? 0) + 1);

      equipmentIds.add(eq.id);
      months.add(month);
      totalEvents += 1;
      if (entry.costCents != null) {
        totalCostCents += entry.costCents;
      } else {
        totalCostMissing += 1;
      }
    }
  }

  const rows: EquipmentMaintenanceByEquipmentMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byKind: Partial<Record<MaintenanceKind, number>> = {};
      for (const [k, v] of a.byKind) byKind[k] = v;
      return {
        equipmentId: a.equipmentId,
        name: a.name,
        month: a.month,
        events: a.events,
        totalCostCents: a.totalCostCents,
        costMissingCount: a.costMissingCount,
        byKind,
      };
    })
    .sort((x, y) => {
      if (x.equipmentId !== y.equipmentId) {
        return x.equipmentId.localeCompare(y.equipmentId);
      }
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      equipmentConsidered: equipmentIds.size,
      monthsConsidered: months.size,
      totalEvents,
      totalCostCents,
      totalCostMissing,
    },
    rows,
  };
}
