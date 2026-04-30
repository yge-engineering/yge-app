// Employee-anchored job footprint snapshot.
//
// Plain English: for one employee, as-of today, surface which
// jobs they've worked — derived from timecards + daily reports
// + dispatches. Counts distinct jobs, hours-on-job sums via
// timecards, last appearance date.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface EmployeeJobSnapshotResult {
  asOf: string;
  employeeId: string;
  distinctJobs: number;
  jobsViaTimeCards: number;
  jobsViaDailyReports: number;
  jobsViaDispatches: number;
  totalHoursAllJobs: number;
  lastAppearanceDate: string | null;
}

export interface EmployeeJobSnapshotInputs {
  employeeId: string;
  /** Optional name fallback for crew rows / dispatch slots that lack
   *  employeeId. */
  employeeName?: string;
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildEmployeeJobSnapshot(
  inputs: EmployeeJobSnapshotInputs,
): EmployeeJobSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  const tcJobs = new Set<string>();
  const drJobs = new Set<string>();
  const dispatchJobs = new Set<string>();
  let totalHours = 0;
  let lastAppearanceDate: string | null = null;

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    if (c.weekStarting > asOf) continue;
    for (const e of c.entries) {
      if (e.date > asOf) continue;
      tcJobs.add(e.jobId);
      totalHours += entryWorkedHours(e);
      if (lastAppearanceDate == null || e.date > lastAppearanceDate) lastAppearanceDate = e.date;
    }
  }

  for (const r of inputs.dailyReports) {
    if (r.date > asOf) continue;
    let appeared = r.foremanId === inputs.employeeId;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) appeared = true;
    }
    if (appeared) {
      drJobs.add(r.jobId);
      if (lastAppearanceDate == null || r.date > lastAppearanceDate) lastAppearanceDate = r.date;
    }
  }

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = norm(d.foremanName) === targetName;
    for (const c of d.crew ?? []) {
      const idMatch = c.employeeId === inputs.employeeId;
      const nameMatch = !c.employeeId && targetName && norm(c.name) === targetName;
      if (idMatch || nameMatch) appeared = true;
    }
    if (appeared) {
      dispatchJobs.add(d.jobId);
      if (lastAppearanceDate == null || d.scheduledFor > lastAppearanceDate) lastAppearanceDate = d.scheduledFor;
    }
  }

  const all = new Set<string>([...tcJobs, ...drJobs, ...dispatchJobs]);

  return {
    asOf,
    employeeId: inputs.employeeId,
    distinctJobs: all.size,
    jobsViaTimeCards: tcJobs.size,
    jobsViaDailyReports: drJobs.size,
    jobsViaDispatches: dispatchJobs.size,
    totalHoursAllJobs: round2(totalHours),
    lastAppearanceDate,
  };
}
