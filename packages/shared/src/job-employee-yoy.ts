// Job-anchored employee footprint year-over-year.
//
// Plain English: for one job, collapse two years of employee
// touches (timecards + daily reports + dispatches) into a
// comparison: distinct employees per year + total hours, plus
// deltas.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface JobEmployeeYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctEmployees: number;
  priorTotalHours: number;
  currentDistinctEmployees: number;
  currentTotalHours: number;
  employeesDelta: number;
  hoursDelta: number;
}

export interface JobEmployeeYoyInputs {
  jobId: string;
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  currentYear: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildJobEmployeeYoy(inputs: JobEmployeeYoyInputs): JobEmployeeYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = { employees: Set<string>; hours: number };
  function emptyBucket(): Bucket {
    return { employees: new Set(), hours: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const c of inputs.timeCards) {
    let touched = false;
    let yearOfCard: number | null = null;
    let cardHours = 0;
    for (const e of c.entries) {
      if (e.jobId !== inputs.jobId) continue;
      touched = true;
      yearOfCard = Number(e.date.slice(0, 4));
      cardHours += entryWorkedHours(e);
    }
    if (!touched || yearOfCard == null) continue;
    let b: Bucket | null = null;
    if (yearOfCard === priorYear) b = prior;
    else if (yearOfCard === inputs.currentYear) b = current;
    if (!b) continue;
    b.employees.add(c.employeeId);
    b.hours += cardHours;
  }
  for (const r of inputs.dailyReports) {
    if (r.jobId !== inputs.jobId) continue;
    const year = Number(r.date.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    if (r.foremanId) b.employees.add(r.foremanId);
    for (const row of r.crewOnSite ?? []) b.employees.add(row.employeeId);
  }
  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) b.employees.add(c.employeeId);
    }
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctEmployees: prior.employees.size,
    priorTotalHours: round2(prior.hours),
    currentDistinctEmployees: current.employees.size,
    currentTotalHours: round2(current.hours),
    employeesDelta: current.employees.size - prior.employees.size,
    hoursDelta: round2(current.hours - prior.hours),
  };
}
