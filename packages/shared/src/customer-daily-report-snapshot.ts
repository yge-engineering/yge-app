// Customer-anchored daily-report snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count daily reports across all their jobs,
// submitted vs draft, sum crew rows + worked hours + photos,
// distinct foremen + jobs, last report date.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { crewRowWorkedHours } from './daily-report';

export interface CustomerDailyReportSnapshotResult {
  asOf: string;
  customerName: string;
  totalReports: number;
  submittedReports: number;
  draftReports: number;
  totalCrewRows: number;
  totalCrewHours: number;
  totalPhotos: number;
  distinctForemen: number;
  distinctJobs: number;
  lastReportDate: string | null;
}

export interface CustomerDailyReportSnapshotInputs {
  customerName: string;
  dailyReports: DailyReport[];
  jobs: Job[];
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

export function buildCustomerDailyReportSnapshot(
  inputs: CustomerDailyReportSnapshotInputs,
): CustomerDailyReportSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const foremen = new Set<string>();
  const jobs = new Set<string>();
  let totalReports = 0;
  let submittedReports = 0;
  let draftReports = 0;
  let totalCrewRows = 0;
  let totalCrewHours = 0;
  let totalPhotos = 0;
  let lastReportDate: string | null = null;

  for (const r of inputs.dailyReports) {
    if (!customerJobs.has(r.jobId)) continue;
    if (r.date > asOf) continue;
    totalReports += 1;
    if (r.submitted) submittedReports += 1;
    else draftReports += 1;
    totalCrewRows += r.crewOnSite?.length ?? 0;
    for (const row of r.crewOnSite ?? []) totalCrewHours += crewRowWorkedHours(row);
    totalPhotos += r.photoCount ?? 0;
    foremen.add(r.foremanId);
    jobs.add(r.jobId);
    if (lastReportDate == null || r.date > lastReportDate) lastReportDate = r.date;
  }

  return {
    asOf,
    customerName: inputs.customerName,
    totalReports,
    submittedReports,
    draftReports,
    totalCrewRows,
    totalCrewHours: round2(totalCrewHours),
    totalPhotos,
    distinctForemen: foremen.size,
    distinctJobs: jobs.size,
    lastReportDate,
  };
}
