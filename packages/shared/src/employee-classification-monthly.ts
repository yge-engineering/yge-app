// Workforce headcount by classification by month.
//
// Plain English: walk every submitted DR's crew rows and count
// distinct (employeeId) per (DIR classification, yyyy-mm).
// Long-format. Useful for the per-classification monthly
// staffing trend.
//
// Per row: classification, label, month, distinctEmployees,
// totalCrewRows.
//
// Sort: classification asc, month asc.
//
// Different from employee-by-classification-active (snapshot,
// no month axis), workforce-headcount-monthly (portfolio per
// month, no classification axis).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { DirClassification, Employee } from './employee';
import { classificationLabel } from './employee';

export interface EmployeeClassificationMonthlyRow {
  classification: DirClassification;
  label: string;
  month: string;
  distinctEmployees: number;
  totalCrewRows: number;
}

export interface EmployeeClassificationMonthlyRollup {
  classificationsConsidered: number;
  monthsConsidered: number;
  totalCrewRows: number;
}

export interface EmployeeClassificationMonthlyInputs {
  employees: Employee[];
  dailyReports: DailyReport[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildEmployeeClassificationMonthly(
  inputs: EmployeeClassificationMonthlyInputs,
): {
  rollup: EmployeeClassificationMonthlyRollup;
  rows: EmployeeClassificationMonthlyRow[];
} {
  const empClass = new Map<string, DirClassification>();
  for (const e of inputs.employees) empClass.set(e.id, e.classification);

  type Acc = {
    classification: DirClassification;
    month: string;
    employees: Set<string>;
    rows: number;
  };
  const accs = new Map<string, Acc>();
  const classSet = new Set<DirClassification>();
  const monthSet = new Set<string>();
  let totalCrewRows = 0;

  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    const month = dr.date.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    for (const c of dr.crewOnSite) {
      const cls = empClass.get(c.employeeId) ?? 'NOT_APPLICABLE';
      const key = `${cls}|${month}`;
      const acc = accs.get(key) ?? {
        classification: cls,
        month,
        employees: new Set<string>(),
        rows: 0,
      };
      acc.employees.add(c.employeeId);
      acc.rows += 1;
      accs.set(key, acc);
      classSet.add(cls);
      monthSet.add(month);
      totalCrewRows += 1;
    }
  }

  const rows: EmployeeClassificationMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      classification: acc.classification,
      label: classificationLabel(acc.classification),
      month: acc.month,
      distinctEmployees: acc.employees.size,
      totalCrewRows: acc.rows,
    });
  }

  rows.sort((a, b) => {
    if (a.classification !== b.classification) {
      return a.classification.localeCompare(b.classification);
    }
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      classificationsConsidered: classSet.size,
      monthsConsidered: monthSet.size,
      totalCrewRows,
    },
    rows,
  };
}
