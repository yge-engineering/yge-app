// Employee-anchored per-job detail snapshot.
//
// Plain English: for one employee, return one row per job
// they've worked with hours-on-job + last appearance date,
// sorted by hours descending.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface EmployeeJobDetailRow {
  jobId: string;
  hoursOnJob: number;
  lastSeenOnJob: string | null;
  source: { timecard: boolean; dailyReport: boolean; dispatch: boolean };
}

export interface EmployeeJobDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeJobDetailRow[];
}

export interface EmployeeJobDetailSnapshotInputs {
  employeeId: string;
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

export function buildEmployeeJobDetailSnapshot(
  inputs: EmployeeJobDetailSnapshotInputs,
): EmployeeJobDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  type Acc = {
    hours: number;
    lastDate: string | null;
    timecard: boolean;
    dailyReport: boolean;
    dispatch: boolean;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { hours: 0, lastDate: null, timecard: false, dailyReport: false, dispatch: false };
      byJob.set(jobId, a);
    }
    return a;
  }
  function bumpDate(a: Acc, dt: string): void {
    if (a.lastDate == null || dt > a.lastDate) a.lastDate = dt;
  }

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    if (c.weekStarting > asOf) continue;
    for (const e of c.entries) {
      if (e.date > asOf) continue;
      const a = getAcc(e.jobId);
      a.hours += entryWorkedHours(e);
      a.timecard = true;
      bumpDate(a, e.date);
    }
  }
  for (const r of inputs.dailyReports) {
    if (r.date > asOf) continue;
    let appeared = r.foremanId === inputs.employeeId;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) appeared = true;
    }
    if (!appeared) continue;
    const a = getAcc(r.jobId);
    a.dailyReport = true;
    bumpDate(a, r.date);
  }
  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = norm(d.foremanName) === targetName;
    for (const c of d.crew ?? []) {
      const idMatch = c.employeeId === inputs.employeeId;
      const nameMatch = !c.employeeId && targetName && norm(c.name) === targetName;
      if (idMatch || nameMatch) appeared = true;
    }
    if (!appeared) continue;
    const a = getAcc(d.jobId);
    a.dispatch = true;
    bumpDate(a, d.scheduledFor);
  }

  const rows: EmployeeJobDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      hoursOnJob: round2(a.hours),
      lastSeenOnJob: a.lastDate,
      source: { timecard: a.timecard, dailyReport: a.dailyReport, dispatch: a.dispatch },
    }))
    .sort((a, b) => b.hoursOnJob - a.hoursOnJob || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
