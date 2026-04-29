// Portfolio headcount activity by month.
//
// Plain English: per yyyy-mm, how many distinct employees did
// any work — appeared on a time card entry, a daily report
// crew row, or a dispatch crew row? Counts also break down
// the active workforce by classification and role. Drives
// the owner's "how big is the crew really running this
// month" view, which often differs from the formal
// roster headcount.
//
// Per row: month, activeEmployees, byClassification, byRole,
// distinctJobs.
//
// Sort: month asc.
//
// Different from workforce-headcount-monthly (roster snapshot,
// not activity-based), employee-classification-monthly (mix
// only), employee-by-foreman-monthly (per foreman).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type {
  DirClassification,
  Employee,
  EmployeeRole,
} from './employee';
import type { TimeCard } from './time-card';

export interface PortfolioHeadcountMonthlyRow {
  month: string;
  activeEmployees: number;
  byClassification: Partial<Record<DirClassification, number>>;
  byRole: Partial<Record<EmployeeRole, number>>;
  distinctJobs: number;
}

export interface PortfolioHeadcountMonthlyRollup {
  monthsConsidered: number;
  totalActiveEmployees: number;
  unmatchedEmployeeIds: number;
}

export interface PortfolioHeadcountMonthlyInputs {
  employees: Employee[];
  timecards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive applied to all activity dates. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioHeadcountMonthly(
  inputs: PortfolioHeadcountMonthlyInputs,
): {
  rollup: PortfolioHeadcountMonthlyRollup;
  rows: PortfolioHeadcountMonthlyRow[];
} {
  const empIndex = new Map<string, Employee>();
  for (const e of inputs.employees) {
    empIndex.set(e.id, e);
  }

  type Acc = {
    month: string;
    employees: Set<string>;
    byClassification: Map<DirClassification, Set<string>>;
    byRole: Map<EmployeeRole, Set<string>>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  let unmatchedEmployeeIds = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function get(month: string): Acc {
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        employees: new Set(),
        byClassification: new Map(),
        byRole: new Map(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    return a;
  }

  function bump(month: string, employeeId: string, jobId?: string): void {
    if (fromM && month < fromM) return;
    if (toM && month > toM) return;
    const a = get(month);
    if (a.employees.has(employeeId)) {
      if (jobId) a.jobs.add(jobId);
      return;
    }
    a.employees.add(employeeId);
    if (jobId) a.jobs.add(jobId);

    const emp = empIndex.get(employeeId);
    if (!emp) {
      unmatchedEmployeeIds += 1;
      return;
    }
    const klass: DirClassification = emp.classification ?? 'NOT_APPLICABLE';
    const role: EmployeeRole = emp.role;
    let kSet = a.byClassification.get(klass);
    if (!kSet) {
      kSet = new Set();
      a.byClassification.set(klass, kSet);
    }
    kSet.add(employeeId);
    let rSet = a.byRole.get(role);
    if (!rSet) {
      rSet = new Set();
      a.byRole.set(role, rSet);
    }
    rSet.add(employeeId);
  }

  for (const tc of inputs.timecards) {
    for (const entry of tc.entries ?? []) {
      bump(entry.date.slice(0, 7), tc.employeeId, entry.jobId);
    }
  }
  for (const dr of inputs.dailyReports) {
    const month = dr.date.slice(0, 7);
    for (const row of dr.crewOnSite ?? []) {
      bump(month, row.employeeId, dr.jobId);
    }
  }
  for (const d of inputs.dispatches) {
    const month = d.scheduledFor.slice(0, 7);
    for (const c of d.crew ?? []) {
      if (c.employeeId) bump(month, c.employeeId, d.jobId);
    }
  }

  let totalActiveEmployees = 0;
  const rows: PortfolioHeadcountMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byClassification: Partial<Record<DirClassification, number>> = {};
      for (const [k, v] of a.byClassification) byClassification[k] = v.size;
      const byRole: Partial<Record<EmployeeRole, number>> = {};
      for (const [k, v] of a.byRole) byRole[k] = v.size;
      totalActiveEmployees += a.employees.size;
      return {
        month: a.month,
        activeEmployees: a.employees.size,
        byClassification,
        byRole,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalActiveEmployees,
      unmatchedEmployeeIds,
    },
    rows,
  };
}
