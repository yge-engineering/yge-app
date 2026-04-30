// Employee-anchored daily-report year-over-year.
//
// Plain English: for one employee, collapse two years of
// daily-report appearances into a comparison: total reports,
// as-foreman, as-crew, hours-on-site, distinct jobs, plus
// deltas.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

import { crewRowWorkedHours } from './daily-report';

export interface EmployeeDailyReportYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorReports: number;
  priorAsForeman: number;
  priorAsCrew: number;
  priorHoursOnSite: number;
  priorDistinctJobs: number;
  currentReports: number;
  currentAsForeman: number;
  currentAsCrew: number;
  currentHoursOnSite: number;
  currentDistinctJobs: number;
  reportsDelta: number;
}

export interface EmployeeDailyReportYoyInputs {
  employeeId: string;
  dailyReports: DailyReport[];
  currentYear: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildEmployeeDailyReportYoy(
  inputs: EmployeeDailyReportYoyInputs,
): EmployeeDailyReportYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    reports: number;
    asForeman: number;
    asCrew: number;
    hours: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { reports: 0, asForeman: 0, asCrew: 0, hours: 0, jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const r of inputs.dailyReports) {
    const year = Number(r.date.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    let appeared = false;
    if (r.foremanId === inputs.employeeId) {
      appeared = true;
      b.asForeman += 1;
    }
    let asCrew = false;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) {
        appeared = true;
        asCrew = true;
        b.hours += crewRowWorkedHours(row);
      }
    }
    if (asCrew) b.asCrew += 1;
    if (appeared) {
      b.reports += 1;
      b.jobs.add(r.jobId);
    }
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorReports: prior.reports,
    priorAsForeman: prior.asForeman,
    priorAsCrew: prior.asCrew,
    priorHoursOnSite: round2(prior.hours),
    priorDistinctJobs: prior.jobs.size,
    currentReports: current.reports,
    currentAsForeman: current.asForeman,
    currentAsCrew: current.asCrew,
    currentHoursOnSite: round2(current.hours),
    currentDistinctJobs: current.jobs.size,
    reportsDelta: current.reports - prior.reports,
  };
}
