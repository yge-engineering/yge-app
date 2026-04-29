// Portfolio equipment activity by month.
//
// Plain English: per yyyy-mm, how many distinct equipment
// units showed up on a posted/completed dispatch, how many
// dispatch days landed across the fleet, how many maintenance
// events fired, and how much maintenance cost was recorded.
// Drives the fleet manager's monthly review.
//
// Per row: month, dispatchedUnits, dispatchDays, maintenanceEvents,
// maintenanceCostCents, distinctJobs.
//
// Sort: month asc.
//
// Different from equipment-utilization-monthly (per unit per
// month), equipment-maintenance-monthly (maintenance only),
// dispatch-equipment-monthly (per category per month).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

export interface PortfolioEquipmentMonthlyRow {
  month: string;
  dispatchedUnits: number;
  dispatchDays: number;
  maintenanceEvents: number;
  maintenanceCostCents: number;
  distinctJobs: number;
}

export interface PortfolioEquipmentMonthlyRollup {
  monthsConsidered: number;
  totalDispatchDays: number;
  totalMaintenanceEvents: number;
  totalMaintenanceCostCents: number;
}

export interface PortfolioEquipmentMonthlyInputs {
  dispatches: Dispatch[];
  equipment: Equipment[];
  /** Optional yyyy-mm bounds inclusive applied to scheduledFor / performedAt. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioEquipmentMonthly(
  inputs: PortfolioEquipmentMonthlyInputs,
): {
  rollup: PortfolioEquipmentMonthlyRollup;
  rows: PortfolioEquipmentMonthlyRow[];
} {
  type Acc = {
    month: string;
    units: Set<string>;
    dispatchDayKeys: Set<string>;
    jobs: Set<string>;
    maintenanceEvents: number;
    maintenanceCostCents: number;
  };
  const accs = new Map<string, Acc>();

  let totalDispatchDays = 0;
  let totalMaintenanceEvents = 0;
  let totalMaintenanceCostCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function get(month: string): Acc {
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        units: new Set(),
        dispatchDayKeys: new Set(),
        jobs: new Set(),
        maintenanceEvents: 0,
        maintenanceCostCents: 0,
      };
      accs.set(month, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    const status = d.status ?? 'DRAFT';
    if (status === 'DRAFT' || status === 'CANCELLED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const a = get(month);
    a.jobs.add(d.jobId);
    for (const e of d.equipment ?? []) {
      const unitKey = e.equipmentId ?? `name:${e.name.toLowerCase().trim()}`;
      a.units.add(unitKey);
      a.dispatchDayKeys.add(`${unitKey}__${d.scheduledFor}`);
    }
  }

  for (const eq of inputs.equipment) {
    for (const log of eq.maintenanceLog ?? []) {
      const month = log.performedAt.slice(0, 7);
      if (fromM && month < fromM) continue;
      if (toM && month > toM) continue;
      const a = get(month);
      a.maintenanceEvents += 1;
      a.maintenanceCostCents += log.costCents ?? 0;
      totalMaintenanceEvents += 1;
      totalMaintenanceCostCents += log.costCents ?? 0;
    }
  }

  const rows: PortfolioEquipmentMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const dispatchDays = a.dispatchDayKeys.size;
      totalDispatchDays += dispatchDays;
      return {
        month: a.month,
        dispatchedUnits: a.units.size,
        dispatchDays,
        maintenanceEvents: a.maintenanceEvents,
        maintenanceCostCents: a.maintenanceCostCents,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalDispatchDays,
      totalMaintenanceEvents,
      totalMaintenanceCostCents,
    },
    rows,
  };
}
