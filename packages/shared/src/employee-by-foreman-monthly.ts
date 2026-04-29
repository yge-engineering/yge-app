// Per (foreman, month) crew show-up rollup.
//
// Plain English: per (foreman, month), count distinct employees
// who showed up on dispatches under that foreman. Useful for
// the foreman crew-stability review — small turnover month over
// month is a good sign, big turnover means foremen are
// constantly retraining.
//
// Per row: foremanName, month, distinctEmployees, dispatches,
// dispatchDays.
//
// Sort: foremanName asc, month asc.
//
// Different from foreman-crew-turnover (per-foreman lifetime),
// dispatch-by-foreman (per-foreman lifetime), dispatch-foreman-
// monthly (per (foreman, month) dispatch volume).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EmployeeByForemanMonthlyRow {
  foremanName: string;
  month: string;
  distinctEmployees: number;
  dispatches: number;
  dispatchDays: number;
}

export interface EmployeeByForemanMonthlyRollup {
  foremenConsidered: number;
  monthsConsidered: number;
  totalDispatches: number;
}

export interface EmployeeByForemanMonthlyInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEmployeeByForemanMonthly(
  inputs: EmployeeByForemanMonthlyInputs,
): {
  rollup: EmployeeByForemanMonthlyRollup;
  rows: EmployeeByForemanMonthlyRow[];
} {
  type Acc = {
    display: string;
    month: string;
    employees: Set<string>;
    dispatches: number;
    dates: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const foremanSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (!d.foremanName.trim()) continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const canonical = d.foremanName.trim().toLowerCase();
    const key = `${canonical}|${month}`;
    const acc = accs.get(key) ?? {
      display: d.foremanName.trim(),
      month,
      employees: new Set<string>(),
      dispatches: 0,
      dates: new Set<string>(),
    };
    for (const c of d.crew) {
      const empKey = c.employeeId ?? `name:${c.name.trim().toLowerCase()}`;
      acc.employees.add(empKey);
    }
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    accs.set(key, acc);
    foremanSet.add(canonical);
    monthSet.add(month);
    totalDispatches += 1;
  }

  const rows: EmployeeByForemanMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      foremanName: acc.display,
      month: acc.month,
      distinctEmployees: acc.employees.size,
      dispatches: acc.dispatches,
      dispatchDays: acc.dates.size,
    });
  }

  rows.sort((a, b) => {
    if (a.foremanName !== b.foremanName) return a.foremanName.localeCompare(b.foremanName);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      foremenConsidered: foremanSet.size,
      monthsConsidered: monthSet.size,
      totalDispatches,
    },
    rows,
  };
}
