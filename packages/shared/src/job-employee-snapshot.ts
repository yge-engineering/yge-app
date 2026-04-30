// Job-anchored employee roster snapshot.
//
// Plain English: for one job, as-of today, return the list of
// employee ids who appeared on the job — joined across
// timecards, daily reports, and dispatches. Surfaces per-
// employee hours-on-job from timecard entries.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface JobEmployeeRow {
  employeeId: string;
  hoursOnJob: number;
  appearedOnTimecards: boolean;
  appearedOnDailyReports: boolean;
  appearedOnDispatches: boolean;
  lastSeenOnJob: string | null;
}

export interface JobEmployeeSnapshotResult {
  asOf: string;
  jobId: string;
  totalEmployees: number;
  rows: JobEmployeeRow[];
}

export interface JobEmployeeSnapshotInputs {
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

export function buildJobEmployeeSnapshot(
  inputs: JobEmployeeSnapshotInputs,
): JobEmployeeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Row = {
    employeeId: string;
    hoursOnJob: number;
    appearedOnTimecards: boolean;
    appearedOnDailyReports: boolean;
    appearedOnDispatches: boolean;
    lastSeenOnJob: string | null;
  };
  const rowsByEmp = new Map<string, Row>();

  function get(empId: string): Row {
    let r = rowsByEmp.get(empId);
    if (!r) {
      r = {
        employeeId: empId,
        hoursOnJob: 0,
        appearedOnTimecards: false,
        appearedOnDailyReports: false,
        appearedOnDispatches: false,
        lastSeenOnJob: null,
      };
      rowsByEmp.set(empId, r);
    }
    return r;
  }

  function bumpDate(row: Row, date: string): void {
    if (row.lastSeenOnJob == null || date > row.lastSeenOnJob) row.lastSeenOnJob = date;
  }

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    const r = get(c.employeeId);
    let touched = false;
    for (const e of c.entries) {
      if (e.jobId !== inputs.jobId) continue;
      if (e.date > asOf) continue;
      r.hoursOnJob += entryWorkedHours(e);
      bumpDate(r, e.date);
      touched = true;
    }
    if (touched) r.appearedOnTimecards = true;
  }

  for (const dr of inputs.dailyReports) {
    if (dr.jobId !== inputs.jobId) continue;
    if (dr.date > asOf) continue;
    if (dr.foremanId) {
      const r = get(dr.foremanId);
      r.appearedOnDailyReports = true;
      bumpDate(r, dr.date);
    }
    for (const row of dr.crewOnSite ?? []) {
      const r = get(row.employeeId);
      r.appearedOnDailyReports = true;
      bumpDate(r, dr.date);
    }
  }

  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    if (d.scheduledFor > asOf) continue;
    for (const c of d.crew ?? []) {
      if (!c.employeeId) continue;
      const r = get(c.employeeId);
      r.appearedOnDispatches = true;
      bumpDate(r, d.scheduledFor);
    }
  }

  const out: JobEmployeeRow[] = [...rowsByEmp.values()].map((r) => ({
    ...r,
    hoursOnJob: round2(r.hoursOnJob),
  }));

  return {
    asOf,
    jobId: inputs.jobId,
    totalEmployees: out.length,
    rows: out.sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
  };
}
