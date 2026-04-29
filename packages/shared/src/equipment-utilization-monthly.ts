// Per (equipment, month) dispatch utilization.
//
// Plain English: for each piece of iron we have on the schedule,
// roll up by yyyy-mm of the dispatch day — how many days that
// unit was scheduled, how many distinct jobs it touched. Per-
// unit version of dispatch-equipment-monthly (which is per
// category) and the time-axis cousin of equipment-dispatch-days
// (which is lifetime, no time axis).
//
// "Working days" is approximated as the count of distinct
// scheduledFor dates the unit appeared on; only POSTED +
// COMPLETED dispatches count (DRAFT and CANCELLED do not).
//
// Per row: equipmentId, name, month, dispatchDays, distinctJobs,
// distinctOperators.
//
// Sort: equipmentId asc, month asc.
//
// Different from dispatch-equipment-monthly (per category, not
// per unit), equipment-dispatch-days (lifetime, no month axis),
// job-equipment-monthly (per-job dispatch days, no per-unit).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentUtilizationMonthlyRow {
  equipmentId: string;
  name: string;
  month: string;
  dispatchDays: number;
  distinctJobs: number;
  distinctOperators: number;
}

export interface EquipmentUtilizationMonthlyRollup {
  unitsConsidered: number;
  monthsConsidered: number;
  totalDispatchDays: number;
  draftSkipped: number;
  cancelledSkipped: number;
}

export interface EquipmentUtilizationMonthlyInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive applied to scheduledFor. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEquipmentUtilizationMonthly(
  inputs: EquipmentUtilizationMonthlyInputs,
): {
  rollup: EquipmentUtilizationMonthlyRollup;
  rows: EquipmentUtilizationMonthlyRow[];
} {
  type Acc = {
    equipmentId: string;
    name: string;
    month: string;
    dates: Set<string>;
    jobs: Set<string>;
    operators: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const units = new Set<string>();
  const months = new Set<string>();

  let totalDays = 0;
  let draftSkipped = 0;
  let cancelledSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const d of inputs.dispatches) {
    const status = d.status ?? 'DRAFT';
    if (status === 'DRAFT') {
      draftSkipped += 1;
      continue;
    }
    if (status === 'CANCELLED') {
      cancelledSkipped += 1;
      continue;
    }

    const month = d.scheduledFor.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    for (const e of d.equipment ?? []) {
      const equipmentId = e.equipmentId ?? `name:${e.name.toLowerCase().trim()}`;
      const key = `${equipmentId}__${month}`;
      let a = accs.get(key);
      if (!a) {
        a = {
          equipmentId,
          name: e.name,
          month,
          dates: new Set(),
          jobs: new Set(),
          operators: new Set(),
        };
        accs.set(key, a);
      }
      a.dates.add(d.scheduledFor);
      a.jobs.add(d.jobId);
      if (e.operatorName) a.operators.add(e.operatorName);

      units.add(equipmentId);
      months.add(month);
    }
  }

  const rows: EquipmentUtilizationMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const dispatchDays = a.dates.size;
      totalDays += dispatchDays;
      return {
        equipmentId: a.equipmentId,
        name: a.name,
        month: a.month,
        dispatchDays,
        distinctJobs: a.jobs.size,
        distinctOperators: a.operators.size,
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
      unitsConsidered: units.size,
      monthsConsidered: months.size,
      totalDispatchDays: totalDays,
      draftSkipped,
      cancelledSkipped,
    },
    rows,
  };
}
