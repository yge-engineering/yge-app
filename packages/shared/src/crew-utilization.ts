// Crew utilization report — per-employee billable vs overhead vs
// target hours over a date range.
//
// Plain English: "Are we billing all our crew time?" If a $90/hour
// loaded operator sat in the shop for two weeks because the foreman
// didn't have a job ready, that's pure overhead bleed. This report
// surfaces that — by employee, with the dollar weight of overhead
// hours when the caller passes labor rates.
//
// Pure derivation. Inputs are the existing time-card and employee
// records plus a few caller-controlled knobs (period bounds, the set
// of jobs that count as overhead, optional labor rates).
//
// Phase 1 simplification: "available hours" = workdays × 8, where
// workdays = Mon-Fri count in the requested period. PTO, sick days,
// holidays, and part-time employees are not yet first-class — when
// they are (Phase 2 payroll module), the available-hours derivation
// drops in here without changing the report shape.

import {
  type Employee,
  classificationLabel,
  fullName,
} from './employee';
import {
  entryWorkedMinutes,
  type TimeCard,
} from './time-card';

export type CrewUtilizationFlag =
  | 'NO_TIMECARD'         // no entries recorded for this employee in the period
  | 'UNDER_UTILIZED'      // billable / target < 50%
  | 'WELL_UTILIZED'       // 50% <= billable / target <= 95%
  | 'OVER_TARGET';        // actual hours > target × 1.1 (running OT)

export interface CrewUtilizationRow {
  employeeId: string;
  employeeName: string;
  classificationLabel: string;

  /** All entry hours across the period. */
  actualHours: number;
  /** Hours on jobs NOT in overheadJobIds. */
  billableHours: number;
  /** Hours on jobs in overheadJobIds. */
  overheadHours: number;
  /** Expected workable hours in the period (workdays × 8). */
  targetHours: number;

  /** billableHours / targetHours. 0 when targetHours == 0. */
  utilization: number;
  /** billableHours / actualHours. 0 when actualHours == 0. The "of the
   *  time they DID record, what fraction was billable" view. */
  recordedBillableShare: number;

  /** Optional dollar weight when caller passes labor rates per
   *  classification. Set to undefined when no rates given. */
  overheadCostCents?: number;
  billableCostCents?: number;

  flag: CrewUtilizationFlag;
}

export interface CrewUtilizationRollup {
  employees: number;
  totalActualHours: number;
  totalBillableHours: number;
  totalOverheadHours: number;
  totalTargetHours: number;
  /** Sum across rows. */
  blendedUtilization: number;
  /** Sum of overheadCostCents across rows when rates supplied. */
  totalOverheadCostCents?: number;
}

export interface CrewUtilizationInputs {
  /** Period start, yyyy-mm-dd inclusive. */
  start: string;
  /** Period end, yyyy-mm-dd inclusive. */
  end: string;
  employees: Employee[];
  timeCards: TimeCard[];
  /** Job ids to treat as overhead/admin/training. Anything not in
   *  this set is considered billable to a job. */
  overheadJobIds?: Iterable<string>;
  /** Optional cents/hour by employee classification. When provided,
   *  rows include billable/overhead dollar splits. */
  laborRatesByClassification?: Map<string, number>;
}

/** Build the per-employee utilization rows + a top-level rollup. */
export function buildCrewUtilization(
  inputs: CrewUtilizationInputs,
): { rows: CrewUtilizationRow[]; rollup: CrewUtilizationRollup } {
  const {
    start,
    end,
    employees,
    timeCards,
    overheadJobIds,
    laborRatesByClassification,
  } = inputs;

  const overhead = new Set(overheadJobIds ?? []);
  const targetHours = workdayHoursBetween(start, end);

  // Bucket time-card entries by employee, filtered to the period.
  const cardsByEmployee = new Map<string, TimeCard[]>();
  for (const card of timeCards) {
    const list = cardsByEmployee.get(card.employeeId) ?? [];
    list.push(card);
    cardsByEmployee.set(card.employeeId, list);
  }

  const rows: CrewUtilizationRow[] = [];
  let totalActualHours = 0;
  let totalBillableHours = 0;
  let totalOverheadHours = 0;
  let totalOverheadCostCents = 0;
  const haveRates = !!laborRatesByClassification;

  for (const emp of employees) {
    const cards = cardsByEmployee.get(emp.id) ?? [];

    let actualMinutes = 0;
    let billableMinutes = 0;
    let overheadMinutes = 0;
    for (const card of cards) {
      for (const e of card.entries) {
        if (e.date < start || e.date > end) continue;
        const m = entryWorkedMinutes(e);
        actualMinutes += m;
        if (overhead.has(e.jobId)) overheadMinutes += m;
        else billableMinutes += m;
      }
    }

    const actualHours = round2(actualMinutes / 60);
    const billableHours = round2(billableMinutes / 60);
    const overheadHours = round2(overheadMinutes / 60);

    const utilization =
      targetHours === 0 ? 0 : billableHours / targetHours;
    const recordedBillableShare =
      actualHours === 0 ? 0 : billableHours / actualHours;

    let flag: CrewUtilizationFlag;
    if (actualHours === 0) flag = 'NO_TIMECARD';
    else if (utilization < 0.5) flag = 'UNDER_UTILIZED';
    else if (actualHours > targetHours * 1.1) flag = 'OVER_TARGET';
    else flag = 'WELL_UTILIZED';

    let overheadCostCents: number | undefined;
    let billableCostCents: number | undefined;
    if (haveRates) {
      const rate = laborRatesByClassification.get(emp.classification) ?? 0;
      overheadCostCents = Math.round(overheadHours * rate);
      billableCostCents = Math.round(billableHours * rate);
      totalOverheadCostCents += overheadCostCents;
    }

    rows.push({
      employeeId: emp.id,
      employeeName: fullName(emp),
      classificationLabel: classificationLabel(emp.classification),
      actualHours,
      billableHours,
      overheadHours,
      targetHours,
      utilization,
      recordedBillableShare,
      overheadCostCents,
      billableCostCents,
      flag,
    });

    totalActualHours += actualHours;
    totalBillableHours += billableHours;
    totalOverheadHours += overheadHours;
  }

  // Worst utilization first — that's where the management leverage is.
  rows.sort((a, b) => {
    // NO_TIMECARD always at the bottom (we can't act on it the same way).
    if (a.flag === 'NO_TIMECARD' && b.flag !== 'NO_TIMECARD') return 1;
    if (b.flag === 'NO_TIMECARD' && a.flag !== 'NO_TIMECARD') return -1;
    return a.utilization - b.utilization;
  });

  const totalTargetHours = targetHours * employees.length;
  const blendedUtilization =
    totalTargetHours === 0 ? 0 : totalBillableHours / totalTargetHours;

  const rollup: CrewUtilizationRollup = {
    employees: employees.length,
    totalActualHours: round2(totalActualHours),
    totalBillableHours: round2(totalBillableHours),
    totalOverheadHours: round2(totalOverheadHours),
    totalTargetHours,
    blendedUtilization,
  };
  if (haveRates) rollup.totalOverheadCostCents = totalOverheadCostCents;

  return { rows, rollup };
}

/** Count Mon-Fri workdays in [start, end] (inclusive) and multiply by
 *  8 to get target hours. UTC math so DST never shifts the count. */
export function workdayHoursBetween(start: string, end: string): number {
  return workdaysBetween(start, end) * 8;
}

/** Count Mon-Fri days in [start, end] (inclusive) using UTC. */
export function workdaysBetween(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  let count = 0;
  for (let t = s; t <= e; t += msPerDay) {
    const dow = new Date(t).getUTCDay(); // 0 = Sun, 6 = Sat
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
