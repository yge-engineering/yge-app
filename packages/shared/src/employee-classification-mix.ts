// Per-employee DIR classification mix from certified payroll history.
//
// Plain English: for each ACTIVE employee, look at every CPR row
// they appear on across the portfolio and break down which DIR
// classifications they've actually been paid under. Compare each
// row's classification to the employee's *primary* classification
// (the one on their Employee record).
//
// Why this matters at YGE:
//   - When a Group-3 Operator runs a Group-5 piece of equipment for
//     a day, the CPR row is supposed to carry GROUP_5 — and the
//     pay is supposed to bump for that day. Missing those bumps is
//     a DLSE complaint waiting to happen.
//   - Conversely, if the office accidentally runs an employee
//     under a higher classification than they hold, the agency may
//     audit and demand repayment.
//   - "Never appeared on any CPR" is its own signal — for an
//     ACTIVE employee on a public-works run, that's odd.
//
// Pure derivation. No persisted records.

import type { CertifiedPayroll } from './certified-payroll';
import type { DirClassification, Employee } from './employee';

export interface EmployeeClassificationCount {
  classification: DirClassification;
  /** True iff this matches the employee's primary classification. */
  isPrimary: boolean;
  payrollCount: number;
  straightHours: number;
  overtimeHours: number;
  totalHours: number;
  grossPayCents: number;
  /** Distinct jobIds this employee worked under this classification. */
  jobCount: number;
}

export interface EmployeeClassificationMixRow {
  employeeId: string;
  employeeName: string;
  primaryClassification: DirClassification;
  payrollRowCount: number;
  totalStraightHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalGrossPayCents: number;
  /** Hours billed under classifications other than the primary. */
  offClassificationHours: number;
  /** offClassificationHours / totalHours. 0 if totalHours is 0. */
  offClassificationShare: number;
  /** True if this employee never appears on any considered CPR. */
  noPayrollHistory: boolean;
  /** Per-classification breakdown, sorted by totalHours desc. */
  classifications: EmployeeClassificationCount[];
}

export interface EmployeeClassificationMixRollup {
  employeesConsidered: number;
  employeesWithPayroll: number;
  employeesWithoutPayroll: number;
  employeesWithOffClassificationWork: number;
  totalOffClassificationHours: number;
}

export interface EmployeeClassificationMixInputs {
  employees: Employee[];
  certifiedPayrolls: CertifiedPayroll[];
  /** When true (default false), include LAID_OFF / TERMINATED /
   *  ON_LEAVE employees too. */
  includeInactive?: boolean;
  /** When set, only consider CPRs whose weekStarting falls in
   *  [from, to] inclusive. yyyy-mm-dd. Both ends are optional. */
  fromDate?: string;
  toDate?: string;
}

export function buildEmployeeClassificationMix(
  inputs: EmployeeClassificationMixInputs,
): {
  rollup: EmployeeClassificationMixRollup;
  rows: EmployeeClassificationMixRow[];
} {
  const includeInactive = inputs.includeInactive === true;
  const from = inputs.fromDate;
  const to = inputs.toDate;

  // Keep only the employees we score.
  const employees = inputs.employees.filter((e) =>
    includeInactive ? true : e.status === 'ACTIVE',
  );

  // Window-filter CPRs once.
  const cprs = inputs.certifiedPayrolls.filter((c) => {
    if (c.status === 'DRAFT') return false;
    if (from && c.weekStarting < from) return false;
    if (to && c.weekStarting > to) return false;
    return true;
  });

  // Per-employee accumulator.
  type Acc = {
    rowCount: number;
    straight: number;
    ot: number;
    gross: number;
    /** classification -> per-class accumulator */
    byClass: Map<
      DirClassification,
      {
        rowCount: number;
        straight: number;
        ot: number;
        gross: number;
        jobs: Set<string>;
      }
    >;
  };
  const accs = new Map<string, Acc>();
  for (const e of employees) {
    accs.set(e.id, {
      rowCount: 0,
      straight: 0,
      ot: 0,
      gross: 0,
      byClass: new Map(),
    });
  }

  for (const cpr of cprs) {
    for (const row of cpr.rows) {
      const acc = accs.get(row.employeeId);
      if (!acc) continue; // employee not in considered set
      acc.rowCount += 1;
      acc.straight += row.straightHours;
      acc.ot += row.overtimeHours;
      acc.gross += row.grossPayCents;
      const cls = acc.byClass.get(row.classification) ?? {
        rowCount: 0,
        straight: 0,
        ot: 0,
        gross: 0,
        jobs: new Set<string>(),
      };
      cls.rowCount += 1;
      cls.straight += row.straightHours;
      cls.ot += row.overtimeHours;
      cls.gross += row.grossPayCents;
      cls.jobs.add(cpr.jobId);
      acc.byClass.set(row.classification, cls);
    }
  }

  let employeesWithPayroll = 0;
  let employeesWithOff = 0;
  let totalOffHours = 0;

  const rows: EmployeeClassificationMixRow[] = employees.map((e) => {
    const acc = accs.get(e.id);
    if (!acc) {
      return {
        employeeId: e.id,
        employeeName: nameOf(e),
        primaryClassification: e.classification,
        payrollRowCount: 0,
        totalStraightHours: 0,
        totalOvertimeHours: 0,
        totalHours: 0,
        totalGrossPayCents: 0,
        offClassificationHours: 0,
        offClassificationShare: 0,
        noPayrollHistory: true,
        classifications: [],
      };
    }
    const totalHours = round2(acc.straight + acc.ot);
    let offHours = 0;
    const classifications: EmployeeClassificationCount[] = [];
    for (const [cls, c] of acc.byClass.entries()) {
      const isPrimary = cls === e.classification;
      const subTotal = round2(c.straight + c.ot);
      if (!isPrimary) offHours += c.straight + c.ot;
      classifications.push({
        classification: cls,
        isPrimary,
        payrollCount: c.rowCount,
        straightHours: round2(c.straight),
        overtimeHours: round2(c.ot),
        totalHours: subTotal,
        grossPayCents: c.gross,
        jobCount: c.jobs.size,
      });
    }
    classifications.sort((a, b) => b.totalHours - a.totalHours);
    const noHistory = acc.rowCount === 0;
    if (!noHistory) {
      employeesWithPayroll += 1;
      if (offHours > 0) employeesWithOff += 1;
    }
    totalOffHours += offHours;
    return {
      employeeId: e.id,
      employeeName: nameOf(e),
      primaryClassification: e.classification,
      payrollRowCount: acc.rowCount,
      totalStraightHours: round2(acc.straight),
      totalOvertimeHours: round2(acc.ot),
      totalHours,
      totalGrossPayCents: acc.gross,
      offClassificationHours: round2(offHours),
      offClassificationShare:
        totalHours === 0 ? 0 : round4(offHours / totalHours),
      noPayrollHistory: noHistory,
      classifications,
    };
  });

  // Sort: rows with off-classification work first (by off hours
  // desc), then rows with payroll history but on-classification
  // (by total hours desc), then rows with no payroll last.
  rows.sort((a, b) => {
    const aBucket = a.noPayrollHistory ? 2 : a.offClassificationHours > 0 ? 0 : 1;
    const bBucket = b.noPayrollHistory ? 2 : b.offClassificationHours > 0 ? 0 : 1;
    if (aBucket !== bBucket) return aBucket - bBucket;
    if (aBucket === 0) {
      return b.offClassificationHours - a.offClassificationHours;
    }
    return b.totalHours - a.totalHours;
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      employeesWithPayroll,
      employeesWithoutPayroll: rows.length - employeesWithPayroll,
      employeesWithOffClassificationWork: employeesWithOff,
      totalOffClassificationHours: round2(totalOffHours),
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

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
