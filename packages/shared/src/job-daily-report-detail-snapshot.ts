// Job-anchored per-foreman daily report detail snapshot.
//
// Plain English: for one job, return one row per foreman who
// submitted daily reports on it: total reports, with-issues count,
// with-visitors count, distinct crew members, last report date.
// Sorted by total reports desc.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface JobDailyReportDetailRow {
  foremanId: string;
  total: number;
  withIssues: number;
  withVisitors: number;
  distinctCrew: number;
  lastReportDate: string | null;
}

export interface JobDailyReportDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobDailyReportDetailRow[];
}

export interface JobDailyReportDetailSnapshotInputs {
  jobId: string;
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

export function buildJobDailyReportDetailSnapshot(
  inputs: JobDailyReportDetailSnapshotInputs,
): JobDailyReportDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    withIssues: number;
    withVisitors: number;
    crew: Set<string>;
    lastDate: string | null;
  };
  const byForeman = new Map<string, Acc>();
  function getAcc(fid: string): Acc {
    let a = byForeman.get(fid);
    if (!a) {
      a = { total: 0, withIssues: 0, withVisitors: 0, crew: new Set(), lastDate: null };
      byForeman.set(fid, a);
    }
    return a;
  }

  for (const dr of inputs.dailyReports) {
    if (dr.jobId !== inputs.jobId) continue;
    if (dr.date > asOf) continue;
    const a = getAcc(dr.foremanId);
    a.total += 1;
    if (dr.issues && dr.issues.trim().length > 0) a.withIssues += 1;
    if (dr.visitors && dr.visitors.trim().length > 0) a.withVisitors += 1;
    for (const c of dr.crewOnSite) a.crew.add(c.employeeId);
    if (a.lastDate == null || dr.date > a.lastDate) a.lastDate = dr.date;
  }

  const rows: JobDailyReportDetailRow[] = [...byForeman.entries()]
    .map(([foremanId, a]) => ({
      foremanId,
      total: a.total,
      withIssues: a.withIssues,
      withVisitors: a.withVisitors,
      distinctCrew: a.crew.size,
      lastReportDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.foremanId.localeCompare(b.foremanId));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
