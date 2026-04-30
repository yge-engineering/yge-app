// Job-anchored per-employee detail snapshot.
//
// Plain English: for one job, return one row per employee who
// touched the job: hours-on-job + last-seen date. Sorted by
// hours descending. Distinct from job-employee-snapshot which
// includes source flags; this is the cleaner per-employee
// summary view.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface JobEmployeeDetailRow {
  employeeId: string;
  hoursOnJob: number;
  lastSeenOnJob: string | null;
}

export interface JobEmployeeDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobEmployeeDetailRow[];
}

export interface JobEmployeeDetailSnapshotInputs {
  jobId: string;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildJobEmployeeDetailSnapshot(
  inputs: JobEmployeeDetailSnapshotInputs,
): JobEmployeeDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = { hours: number; lastDate: string | null };
  const byEmp = new Map<string, Acc>();
  function getAcc(empId: string): Acc {
    let a = byEmp.get(empId);
    if (!a) {
      a = { hours: 0, lastDate: null };
      byEmp.set(empId, a);
    }
    return a;
  }
  function bumpDate(a: Acc, dt: string): void {
    if (a.lastDate == null || dt > a.lastDate) a.lastDate = dt;
  }

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    let touched = false;
    for (const e of c.entries) {
      if (e.jobId !== inputs.jobId) continue;
      if (e.date > asOf) continue;
      touched = true;
      const a = getAcc(c.employeeId);
      a.hours += entryWorkedHours(e);
      bumpDate(a, e.date);
    }
    void touched;
  }
  for (const r of inputs.dailyReports) {
    if (r.jobId !== inputs.jobId) continue;
    if (r.date > asOf) continue;
    if (r.foremanId) bumpDate(getAcc(r.foremanId), r.date);
    for (const row of r.crewOnSite ?? []) bumpDate(getAcc(row.employeeId), r.date);
  }
  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    if (d.scheduledFor > asOf) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) bumpDate(getAcc(c.employeeId), d.scheduledFor);
    }
  }

  const rows: JobEmployeeDetailRow[] = [...byEmp.entries()]
    .map(([employeeId, a]) => ({
      employeeId,
      hoursOnJob: round2(a.hours),
      lastSeenOnJob: a.lastDate,
    }))
    .sort((a, b) => b.hoursOnJob - a.hoursOnJob || a.employeeId.localeCompare(b.employeeId));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
