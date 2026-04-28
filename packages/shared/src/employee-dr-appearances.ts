// Per-employee daily-report appearances.
//
// Plain English: walk every submitted DR's crewOnSite roster and
// surface each ACTIVE employee's appearance count + worked hours
// over a window. Different from:
//   - employee-mileage-rollup (mileage-specific)
//   - employee-labor-cost (\$ via timecards, not DRs)
//   - dispatch-utilization (planned vs actual via Dispatch)
//   - employee-cooccurrence (which employees show up together)
//
// This is the simple "where has this person been on the books?"
// view — useful to validate timecards against DR rosters and to
// verify CPR rosters when Cal Fire / Caltrans audit.
//
// Pure derivation. Pulls hours from the DR row math
// (crewRowWorkedMinutes) so it stays consistent with the report
// itself.

import type { DailyReport } from './daily-report';
import { crewRowWorkedMinutes } from './daily-report';
import type { Employee } from './employee';

export interface EmployeeDrAppearancesRow {
  employeeId: string;
  employeeName: string;
  appearanceCount: number;
  /** Worked hours summed across appearances. Decimal-2 rounded. */
  totalHours: number;
  /** Distinct days the employee was on a submitted DR. */
  distinctDays: number;
  /** Distinct jobs the employee touched. */
  distinctJobs: number;
  /** Most-recent DR date the employee appeared on. Null if zero. */
  lastSeenDate: string | null;
  /** Days from lastSeenDate to asOf. Null when never seen. */
  daysSinceLastSeen: number | null;
}

export interface EmployeeDrAppearancesRollup {
  employeesConsidered: number;
  totalAppearances: number;
  totalHours: number;
  /** Active employees with zero appearances in the window. */
  employeesWithoutAppearances: number;
}

export interface EmployeeDrAppearancesInputs {
  employees: Employee[];
  reports: DailyReport[];
  /** Inclusive yyyy-mm-dd bounds applied to DR.date. */
  fromDate?: string;
  toDate?: string;
  /** Reference date for "days since last seen" math. Defaults to
   *  the latest DR.date observed; falls back to fromDate or
   *  '1970-01-01'. */
  asOf?: string;
  /** Include LAID_OFF / TERMINATED / ON_LEAVE employees too.
   *  Default false. */
  includeInactive?: boolean;
}

export function buildEmployeeDrAppearances(
  inputs: EmployeeDrAppearancesInputs,
): {
  rollup: EmployeeDrAppearancesRollup;
  rows: EmployeeDrAppearancesRow[];
} {
  const includeInactive = inputs.includeInactive === true;

  const employees = inputs.employees.filter((e) =>
    includeInactive ? true : e.status === 'ACTIVE',
  );

  // Window-filter the reports once.
  const reports = inputs.reports.filter((r) => {
    if (!r.submitted) return false;
    if (inputs.fromDate && r.date < inputs.fromDate) return false;
    if (inputs.toDate && r.date > inputs.toDate) return false;
    return true;
  });

  // asOf default
  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const r of reports) {
      if (r.date > latest) latest = r.date;
    }
    asOf = latest || inputs.fromDate || '1970-01-01';
  }

  // Per-employee accumulator.
  type Acc = {
    appearanceCount: number;
    minutes: number;
    days: Set<string>;
    jobs: Set<string>;
    lastSeenDate: string;
  };
  const accs = new Map<string, Acc>();
  for (const e of employees) {
    accs.set(e.id, {
      appearanceCount: 0,
      minutes: 0,
      days: new Set<string>(),
      jobs: new Set<string>(),
      lastSeenDate: '',
    });
  }

  for (const r of reports) {
    for (const row of r.crewOnSite) {
      const acc = accs.get(row.employeeId);
      if (!acc) continue; // not in considered employee set
      acc.appearanceCount += 1;
      acc.minutes += crewRowWorkedMinutes(row);
      acc.days.add(r.date);
      acc.jobs.add(r.jobId);
      if (r.date > acc.lastSeenDate) acc.lastSeenDate = r.date;
    }
  }

  let employeesWithoutAppearances = 0;
  let totalAppearances = 0;
  let totalMinutes = 0;

  const rows: EmployeeDrAppearancesRow[] = employees.map((e) => {
    const acc = accs.get(e.id);
    if (!acc || acc.appearanceCount === 0) {
      employeesWithoutAppearances += 1;
      return {
        employeeId: e.id,
        employeeName: nameOf(e),
        appearanceCount: 0,
        totalHours: 0,
        distinctDays: 0,
        distinctJobs: 0,
        lastSeenDate: null,
        daysSinceLastSeen: null,
      };
    }
    totalAppearances += acc.appearanceCount;
    totalMinutes += acc.minutes;
    const totalHours = Math.round((acc.minutes / 60) * 100) / 100;
    const lastSeen = acc.lastSeenDate;
    const daysSince = daysBetween(lastSeen, asOf);
    return {
      employeeId: e.id,
      employeeName: nameOf(e),
      appearanceCount: acc.appearanceCount,
      totalHours,
      distinctDays: acc.days.size,
      distinctJobs: acc.jobs.size,
      lastSeenDate: lastSeen,
      daysSinceLastSeen: daysSince,
    };
  });

  // Sort: active workers (highest appearance count) first, then by
  // hours, then by name. Employees with zero appearances drop to
  // the bottom by appearance count alone.
  rows.sort((a, b) => {
    if (a.appearanceCount !== b.appearanceCount) {
      return b.appearanceCount - a.appearanceCount;
    }
    if (a.totalHours !== b.totalHours) return b.totalHours - a.totalHours;
    return a.employeeName.localeCompare(b.employeeName);
  });

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalAppearances,
      totalHours,
      employeesWithoutAppearances,
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

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
