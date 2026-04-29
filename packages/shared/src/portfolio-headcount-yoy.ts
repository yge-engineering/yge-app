// Portfolio active-headcount year-over-year.
//
// Plain English: per-year unique-employee headcount across
// every activity source (timecards, daily reports,
// dispatches), with classification mix per year + delta.
// Sized for the year-end "how big did the crew run?"
// executive review.
//
// Different from portfolio-headcount-monthly (per month),
// workforce-headcount-monthly (roster-snapshot based).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { DirClassification, Employee } from './employee';
import type { TimeCard } from './time-card';

export interface PortfolioHeadcountYoyResult {
  priorYear: number;
  currentYear: number;
  priorActiveEmployees: number;
  priorByClassification: Partial<Record<DirClassification, number>>;
  currentActiveEmployees: number;
  currentByClassification: Partial<Record<DirClassification, number>>;
  activeEmployeesDelta: number;
}

export interface PortfolioHeadcountYoyInputs {
  employees: Employee[];
  timecards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  currentYear: number;
}

export function buildPortfolioHeadcountYoy(
  inputs: PortfolioHeadcountYoyInputs,
): PortfolioHeadcountYoyResult {
  const priorYear = inputs.currentYear - 1;
  const empIndex = new Map<string, Employee>();
  for (const e of inputs.employees) empIndex.set(e.id, e);

  const priorEmployees = new Set<string>();
  const currentEmployees = new Set<string>();

  function bump(year: number, employeeId: string): void {
    if (year === priorYear) priorEmployees.add(employeeId);
    else if (year === inputs.currentYear) currentEmployees.add(employeeId);
  }

  for (const tc of inputs.timecards) {
    for (const entry of tc.entries ?? []) {
      bump(Number(entry.date.slice(0, 4)), tc.employeeId);
    }
  }
  for (const dr of inputs.dailyReports) {
    const year = Number(dr.date.slice(0, 4));
    for (const row of dr.crewOnSite ?? []) {
      bump(year, row.employeeId);
    }
  }
  for (const d of inputs.dispatches) {
    const year = Number(d.scheduledFor.slice(0, 4));
    for (const c of d.crew ?? []) {
      if (c.employeeId) bump(year, c.employeeId);
    }
  }

  function byClassification(set: Set<string>): Partial<Record<DirClassification, number>> {
    const out: Partial<Record<DirClassification, number>> = {};
    for (const id of set) {
      const klass: DirClassification = empIndex.get(id)?.classification ?? 'NOT_APPLICABLE';
      out[klass] = (out[klass] ?? 0) + 1;
    }
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorActiveEmployees: priorEmployees.size,
    priorByClassification: byClassification(priorEmployees),
    currentActiveEmployees: currentEmployees.size,
    currentByClassification: byClassification(currentEmployees),
    activeEmployeesDelta: currentEmployees.size - priorEmployees.size,
  };
}
