// Portfolio daily report snapshot.
//
// Plain English: as-of today, count daily reports, separate
// submitted vs draft, sum crew rows + photos + worked hours,
// count distinct jobs + foremen, surface YTD totals. Drives
// the right-now field-reporting overview.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

import { crewRowWorkedHours } from './daily-report';

export interface PortfolioDailyReportSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalReports: number;
  ytdReports: number;
  submittedReports: number;
  draftReports: number;
  totalCrewRows: number;
  totalCrewHours: number;
  totalPhotos: number;
  distinctJobs: number;
  distinctForemen: number;
}

export interface PortfolioDailyReportSnapshotInputs {
  dailyReports: DailyReport[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
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

export function buildPortfolioDailyReportSnapshot(
  inputs: PortfolioDailyReportSnapshotInputs,
): PortfolioDailyReportSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const jobs = new Set<string>();
  const foremen = new Set<string>();

  let totalReports = 0;
  let ytdReports = 0;
  let submittedReports = 0;
  let draftReports = 0;
  let totalCrewRows = 0;
  let totalCrewHours = 0;
  let totalPhotos = 0;

  for (const r of inputs.dailyReports) {
    if (r.date > asOf) continue;
    totalReports += 1;
    if (r.submitted) submittedReports += 1;
    else draftReports += 1;
    totalCrewRows += r.crewOnSite?.length ?? 0;
    for (const row of r.crewOnSite ?? []) totalCrewHours += crewRowWorkedHours(row);
    totalPhotos += r.photoCount ?? 0;
    jobs.add(r.jobId);
    foremen.add(r.foremanId);
    if (Number(r.date.slice(0, 4)) === logYear) ytdReports += 1;
  }

  return {
    asOf,
    ytdLogYear: logYear,
    totalReports,
    ytdReports,
    submittedReports,
    draftReports,
    totalCrewRows,
    totalCrewHours: round2(totalCrewHours),
    totalPhotos,
    distinctJobs: jobs.size,
    distinctForemen: foremen.size,
  };
}
