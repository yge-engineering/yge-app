// Customer-anchored per-job daily report detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: total reports, distinct foremen,
// distinct crew, reports flagged with issues text, total visitor
// rows, last report date. Sorted by total reports desc.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export interface CustomerDailyReportDetailRow {
  jobId: string;
  total: number;
  withIssues: number;
  withVisitors: number;
  distinctForemen: number;
  distinctCrew: number;
  lastReportDate: string | null;
}

export interface CustomerDailyReportDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerDailyReportDetailRow[];
}

export interface CustomerDailyReportDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerDailyReportDetailSnapshot(
  inputs: CustomerDailyReportDetailSnapshotInputs,
): CustomerDailyReportDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    withIssues: number;
    withVisitors: number;
    foremen: Set<string>;
    crew: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        total: 0,
        withIssues: 0,
        withVisitors: 0,
        foremen: new Set(),
        crew: new Set(),
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const dr of inputs.dailyReports) {
    if (!customerJobs.has(dr.jobId)) continue;
    if (dr.date > asOf) continue;

    const a = getAcc(dr.jobId);
    a.total += 1;
    if (dr.issues && dr.issues.trim().length > 0) a.withIssues += 1;
    if (dr.visitors && dr.visitors.trim().length > 0) a.withVisitors += 1;
    if (dr.foremanId) a.foremen.add(dr.foremanId);
    for (const c of dr.crewOnSite) a.crew.add(c.employeeId);
    if (a.lastDate == null || dr.date > a.lastDate) a.lastDate = dr.date;
  }

  const rows: CustomerDailyReportDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      withIssues: a.withIssues,
      withVisitors: a.withVisitors,
      distinctForemen: a.foremen.size,
      distinctCrew: a.crew.size,
      lastReportDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
