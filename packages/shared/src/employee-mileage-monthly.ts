// Per-employee mileage by month.
//
// Plain English: for each ACTIVE employee, walk every mileage
// log entry and bucket by yyyy-mm of tripDate. Surfaces month-
// over-month per-employee trend so we can spot:
//   - mileage spikes (potential personal use claimed as business)
//   - mileage dropping to zero on a month an employee was active
//     (paperwork lapse — DR roster says they were on jobs)
//   - employees consistently above the portfolio mean (legitimate
//     "yard → jobsite" drivers vs. office staff)
//
// Different from employee-mileage-rollup (single-window per-
// employee total) — this is the time-series view per employee.
//
// Pure derivation. No persisted records.

import type { Employee } from './employee';
import type { MileageEntry } from './mileage';

export interface EmployeeMileageMonthBucket {
  month: string;
  miles: number;
  tripCount: number;
  /** Sum of irsRateCentsPerMile × miles across the month. Lines
   *  without a rate contribute zero. */
  reimbursementCents: number;
}

export interface EmployeeMileageMonthlyRow {
  employeeId: string;
  employeeName: string;
  totalMiles: number;
  totalReimbursementCents: number;
  monthsWithMileage: number;
  /** Buckets sorted asc by month. */
  buckets: EmployeeMileageMonthBucket[];
  /** Latest month bucket vs prior month (in miles). 0 if fewer
   *  than 2 buckets. */
  latestMonthDelta: number;
}

export interface EmployeeMileageMonthlyRollup {
  employeesConsidered: number;
  totalMiles: number;
  totalReimbursementCents: number;
  /** Distinct months covered across the input. */
  monthsInWindow: number;
}

export interface EmployeeMileageMonthlyInputs {
  employees: Employee[];
  entries: MileageEntry[];
  /** Inclusive yyyy-mm bounds. */
  fromMonth?: string;
  toMonth?: string;
  /** Default false — only ACTIVE employees scored. */
  includeInactive?: boolean;
}

export function buildEmployeeMileageMonthly(
  inputs: EmployeeMileageMonthlyInputs,
): {
  rollup: EmployeeMileageMonthlyRollup;
  rows: EmployeeMileageMonthlyRow[];
} {
  const includeInactive = inputs.includeInactive === true;
  const employees = inputs.employees.filter((e) =>
    includeInactive ? true : e.status === 'ACTIVE',
  );

  // Per-employee per-month accumulator.
  type Acc = Map<string, EmployeeMileageMonthBucket>;
  const accs = new Map<string, Acc>();
  for (const e of employees) accs.set(e.id, new Map());

  const monthsSet = new Set<string>();

  for (const entry of inputs.entries) {
    const month = entry.tripDate.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const acc = accs.get(entry.employeeId);
    if (!acc) continue;
    monthsSet.add(month);
    const bucket = acc.get(month) ?? {
      month,
      miles: 0,
      tripCount: 0,
      reimbursementCents: 0,
    };
    bucket.miles += entry.businessMiles;
    bucket.tripCount += 1;
    if (typeof entry.irsRateCentsPerMile === 'number') {
      bucket.reimbursementCents += Math.round(entry.businessMiles * entry.irsRateCentsPerMile);
    }
    acc.set(month, bucket);
  }

  let totalMiles = 0;
  let totalReimbursement = 0;

  const rows: EmployeeMileageMonthlyRow[] = employees.map((e) => {
    const acc = accs.get(e.id) ?? new Map();
    const buckets = Array.from(acc.values())
      .map((b) => ({
        month: b.month,
        miles: round2(b.miles),
        tripCount: b.tripCount,
        reimbursementCents: b.reimbursementCents,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const empMiles = buckets.reduce((acc, b) => acc + b.miles, 0);
    const empReim = buckets.reduce((acc, b) => acc + b.reimbursementCents, 0);
    totalMiles += empMiles;
    totalReimbursement += empReim;

    let delta = 0;
    if (buckets.length >= 2) {
      const last = buckets[buckets.length - 1];
      const prev = buckets[buckets.length - 2];
      if (last && prev) delta = round2(last.miles - prev.miles);
    }

    return {
      employeeId: e.id,
      employeeName: nameOf(e),
      totalMiles: round2(empMiles),
      totalReimbursementCents: empReim,
      monthsWithMileage: buckets.length,
      buckets,
      latestMonthDelta: delta,
    };
  });

  // Sort: highest total miles first.
  rows.sort((a, b) => {
    if (a.totalMiles !== b.totalMiles) return b.totalMiles - a.totalMiles;
    return a.employeeName.localeCompare(b.employeeName);
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalMiles: round2(totalMiles),
      totalReimbursementCents: totalReimbursement,
      monthsInWindow: monthsSet.size,
    },
    rows,
  };
}

function nameOf(e: Employee): string {
  if (e.displayName && e.displayName.trim().length > 0) {
    return `${e.displayName} ${e.lastName}`;
  }
  return `${e.firstName} ${e.lastName}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
