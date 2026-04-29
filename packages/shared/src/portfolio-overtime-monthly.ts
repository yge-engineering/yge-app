// Portfolio overtime hours by month with classification mix.
//
// Plain English: walk every TimeCard's entries, accumulate
// daily hours per (employee, date), then per yyyy-mm sum
// daily OT (hours > 8), Saturday OT (hours on Saturday),
// Sunday OT (hours on Sunday — most CA prevailing-wage
// jurisdictions treat Sunday as 1.5×/2×). Drives the IIPP
// + payroll OT trend.
//
// Per row: month, dailyOtHours, sundayOtHours, saturdayOtHours,
// totalOtHours, distinctEmployees, byClassification.
//
// Sort: month asc.
//
// Different from overtime-monthly (no daily/weekend split),
// employee-overtime-monthly (per employee), employee-
// overtime-by-job (per job).
//
// Pure derivation. No persisted records.

import type {
  DirClassification,
  Employee,
} from './employee';
import type { TimeCard, TimeEntry } from './time-card';
import { entryWorkedHours } from './time-card';

export interface PortfolioOvertimeMonthlyRow {
  month: string;
  dailyOtHours: number;
  saturdayOtHours: number;
  sundayOtHours: number;
  totalOtHours: number;
  distinctEmployees: number;
  byClassification: Partial<Record<DirClassification, number>>;
}

export interface PortfolioOvertimeMonthlyRollup {
  monthsConsidered: number;
  totalOtHours: number;
}

export interface PortfolioOvertimeMonthlyInputs {
  timecards: TimeCard[];
  employees: Employee[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioOvertimeMonthly(
  inputs: PortfolioOvertimeMonthlyInputs,
): {
  rollup: PortfolioOvertimeMonthlyRollup;
  rows: PortfolioOvertimeMonthlyRow[];
} {
  const empIndex = new Map<string, Employee>();
  for (const e of inputs.employees) {
    empIndex.set(e.id, e);
  }

  // Sum hours per (employeeId, date).
  const dailyHours = new Map<string, number>();
  for (const tc of inputs.timecards) {
    for (const entry of (tc.entries ?? []) as TimeEntry[]) {
      const key = `${tc.employeeId}__${entry.date}`;
      dailyHours.set(key, (dailyHours.get(key) ?? 0) + entryWorkedHours(entry));
    }
  }

  type Acc = {
    month: string;
    dailyOtHours: number;
    saturdayOtHours: number;
    sundayOtHours: number;
    employees: Set<string>;
    byClassification: Map<DirClassification, number>;
  };
  const accs = new Map<string, Acc>();

  let totalOtHours = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const [key, hours] of dailyHours) {
    const [employeeId = '', date = ''] = key.split('__');
    const month = date.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    let dailyOt = Math.max(0, hours - 8);
    let saturdayOt = 0;
    let sundayOt = 0;
    if (dow === 6) {
      saturdayOt = hours;
      dailyOt = 0;
    } else if (dow === 0) {
      sundayOt = hours;
      dailyOt = 0;
    }
    const totalOt = dailyOt + saturdayOt + sundayOt;
    if (totalOt <= 0) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        dailyOtHours: 0,
        saturdayOtHours: 0,
        sundayOtHours: 0,
        employees: new Set(),
        byClassification: new Map(),
      };
      accs.set(month, a);
    }
    a.dailyOtHours += dailyOt;
    a.saturdayOtHours += saturdayOt;
    a.sundayOtHours += sundayOt;
    a.employees.add(employeeId);
    const emp = empIndex.get(employeeId);
    const klass: DirClassification = emp?.classification ?? 'NOT_APPLICABLE';
    a.byClassification.set(klass, (a.byClassification.get(klass) ?? 0) + totalOt);
    totalOtHours += totalOt;
  }

  const rows: PortfolioOvertimeMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byClassification: Partial<Record<DirClassification, number>> = {};
      for (const [k, v] of a.byClassification) {
        byClassification[k] = Math.round(v * 100) / 100;
      }
      return {
        month: a.month,
        dailyOtHours: Math.round(a.dailyOtHours * 100) / 100,
        saturdayOtHours: Math.round(a.saturdayOtHours * 100) / 100,
        sundayOtHours: Math.round(a.sundayOtHours * 100) / 100,
        totalOtHours:
          Math.round((a.dailyOtHours + a.saturdayOtHours + a.sundayOtHours) * 100) / 100,
        distinctEmployees: a.employees.size,
        byClassification,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalOtHours: Math.round(totalOtHours * 100) / 100,
    },
    rows,
  };
}
