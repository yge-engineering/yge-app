// Equipment dispatched by (month, status) snapshot.
//
// Plain English: for each yyyy-mm in the dispatch window, count
// distinct units actually dispatched, broken down by their
// current status. Useful for the "we're dispatching IN_SHOP
// equipment, that's a planning bug" check.
//
// Per row: month, status, distinctUnits, dispatches.
//
// Sort: month asc, status asc.
//
// Different from equipment-by-status (current snapshot, no
// month axis), equipment-utilization-summary (utilization
// tier).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment, EquipmentStatus } from './equipment';

export interface EquipmentFleetByStatusMonthlyRow {
  month: string;
  status: EquipmentStatus;
  distinctUnits: number;
  dispatches: number;
}

export interface EquipmentFleetByStatusMonthlyRollup {
  monthsConsidered: number;
  statusesConsidered: number;
  totalDispatches: number;
  unmatchedLines: number;
}

export interface EquipmentFleetByStatusMonthlyInputs {
  dispatches: Dispatch[];
  equipment: Equipment[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEquipmentFleetByStatusMonthly(
  inputs: EquipmentFleetByStatusMonthlyInputs,
): {
  rollup: EquipmentFleetByStatusMonthlyRollup;
  rows: EquipmentFleetByStatusMonthlyRow[];
} {
  const statusById = new Map<string, EquipmentStatus>();
  for (const eq of inputs.equipment) statusById.set(eq.id, eq.status);

  type Acc = {
    month: string;
    status: EquipmentStatus;
    units: Set<string>;
    dispatches: number;
  };
  const accs = new Map<string, Acc>();
  const monthSet = new Set<string>();
  const statusSet = new Set<EquipmentStatus>();
  let totalDispatches = 0;
  let unmatchedLines = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    for (const e of d.equipment) {
      if (!e.equipmentId) {
        unmatchedLines += 1;
        continue;
      }
      const status = statusById.get(e.equipmentId);
      if (!status) {
        unmatchedLines += 1;
        continue;
      }
      const key = `${month}|${status}`;
      const acc = accs.get(key) ?? {
        month,
        status,
        units: new Set<string>(),
        dispatches: 0,
      };
      acc.units.add(e.equipmentId);
      acc.dispatches += 1;
      accs.set(key, acc);
      monthSet.add(month);
      statusSet.add(status);
      totalDispatches += 1;
    }
  }

  const rows: EquipmentFleetByStatusMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      month: acc.month,
      status: acc.status,
      distinctUnits: acc.units.size,
      dispatches: acc.dispatches,
    });
  }

  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.status.localeCompare(b.status);
  });

  return {
    rollup: {
      monthsConsidered: monthSet.size,
      statusesConsidered: statusSet.size,
      totalDispatches,
      unmatchedLines,
    },
    rows,
  };
}
