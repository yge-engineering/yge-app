// Employee-anchored daily-report snapshot.
//
// Plain English: for one employee, as-of today, count daily
// reports where they appeared (in crewOnSite OR as foremanId),
// separate as-foreman vs as-crew, sum hours-on-site, distinct
// jobs, last appearance date.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

import { crewRowWorkedHours } from './daily-report';

export interface EmployeeDailyReportSnapshotResult {
  asOf: string;
  employeeId: string;
  totalReports: number;
  reportsAsForeman: number;
  reportsAsCrew: number;
  hoursOnSite: number;
  distinctJobs: number;
  lastReportDate: string | null;
}

export interface EmployeeDailyReportSnapshotInputs {
  employeeId: string;
  dailyReports: DailyReport[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildEmployeeDailyReportSnapshot(
  inputs: EmployeeDailyReportSnapshotInputs,
): EmployeeDailyReportSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const jobs = new Set<string>();
  let totalReports = 0;
  let reportsAsForeman = 0;
  let reportsAsCrew = 0;
  let hoursOnSite = 0;
  let lastReportDate: string | null = null;

  for (const r of inputs.dailyReports) {
    if (r.date > asOf) continue;
    let appeared = false;
    if (r.foremanId === inputs.employeeId) {
      appeared = true;
      reportsAsForeman += 1;
    }
    let asCrew = false;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) {
        appeared = true;
        asCrew = true;
        hoursOnSite += crewRowWorkedHours(row);
      }
    }
    if (asCrew) reportsAsCrew += 1;
    if (appeared) {
      totalReports += 1;
      jobs.add(r.jobId);
      if (lastReportDate == null || r.date > lastReportDate) lastReportDate = r.date;
    }
  }

  return {
    asOf,
    employeeId: inputs.employeeId,
    totalReports,
    reportsAsForeman,
    reportsAsCrew,
    hoursOnSite: round2(hoursOnSite),
    distinctJobs: jobs.size,
    lastReportDate,
  };
}
