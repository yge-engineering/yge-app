// Job-anchored daily-report snapshot.
//
// Plain English: for one job, as-of today, count daily reports,
// separate submitted vs draft, sum crew rows + worked hours +
// photos, count distinct foremen, surface last submitted date.
// Drives the right-now per-job field-reporting overview.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

import { crewRowWorkedHours } from './daily-report';

export interface JobDailyReportSnapshotResult {
  asOf: string;
  jobId: string;
  totalReports: number;
  submittedReports: number;
  draftReports: number;
  totalCrewRows: number;
  totalCrewHours: number;
  totalPhotos: number;
  distinctForemen: number;
  lastReportDate: string | null;
}

export interface JobDailyReportSnapshotInputs {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildJobDailyReportSnapshot(
  inputs: JobDailyReportSnapshotInputs,
): JobDailyReportSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const foremen = new Set<string>();
  let totalReports = 0;
  let submittedReports = 0;
  let draftReports = 0;
  let totalCrewRows = 0;
  let totalCrewHours = 0;
  let totalPhotos = 0;
  let lastReportDate: string | null = null;

  for (const r of inputs.dailyReports) {
    if (r.jobId !== inputs.jobId) continue;
    if (r.date > asOf) continue;
    totalReports += 1;
    if (r.submitted) submittedReports += 1;
    else draftReports += 1;
    totalCrewRows += r.crewOnSite?.length ?? 0;
    for (const row of r.crewOnSite ?? []) totalCrewHours += crewRowWorkedHours(row);
    totalPhotos += r.photoCount ?? 0;
    foremen.add(r.foremanId);
    if (lastReportDate == null || r.date > lastReportDate) lastReportDate = r.date;
  }

  return {
    asOf,
    jobId: inputs.jobId,
    totalReports,
    submittedReports,
    draftReports,
    totalCrewRows,
    totalCrewHours: round2(totalCrewHours),
    totalPhotos,
    distinctForemen: foremen.size,
    lastReportDate,
  };
}
