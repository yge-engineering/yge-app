// Daily-report photo coverage report.
//
// Plain English: every daily report should carry at least one
// progress photo. Photos are evidence on delay claims, change-order
// justifications, and disputed punch items. A foreman who submits
// reports without photos is a foreman whose work won't survive
// scrutiny if there's a fight later.
//
// This walks submitted daily reports across a date range and
// computes per-foreman + per-job photo-attachment rate.
//
// Pure derivation. Uses the photoCount field on the daily-report
// record (Phase 1 stand-in until photo cross-references are wired
// in Phase 4).

import type { DailyReport } from './daily-report';

export interface DrPhotoForemanRow {
  foremanId: string;
  reportCount: number;
  reportsWithPhotos: number;
  totalPhotos: number;
  /** reportsWithPhotos / reportCount. */
  coverageRate: number;
  /** Mean photos per report — including reports with 0. */
  averagePhotosPerReport: number;
}

export interface DrPhotoJobRow {
  jobId: string;
  reportCount: number;
  reportsWithPhotos: number;
  totalPhotos: number;
  coverageRate: number;
}

export interface DrPhotoCoverageReport {
  start: string;
  end: string;
  reportCount: number;
  reportsWithPhotos: number;
  totalPhotos: number;
  /** reportsWithPhotos / reportCount across the whole period. */
  blendedCoverageRate: number;

  byForeman: DrPhotoForemanRow[];
  byJob: DrPhotoJobRow[];
}

export interface DrPhotoCoverageInputs {
  start: string;
  end: string;
  dailyReports: DailyReport[];
}

export function buildDrPhotoCoverageReport(
  inputs: DrPhotoCoverageInputs,
): DrPhotoCoverageReport {
  const { start, end, dailyReports } = inputs;

  const inWindow = dailyReports.filter(
    (d) => d.submitted && d.date >= start && d.date <= end,
  );

  let totalPhotos = 0;
  let reportsWithPhotos = 0;
  type Bucket = {
    reportCount: number;
    withPhotos: number;
    photoCount: number;
  };
  const byForeman = new Map<string, Bucket>();
  const byJob = new Map<string, Bucket>();

  for (const dr of inWindow) {
    const has = (dr.photoCount ?? 0) > 0;
    totalPhotos += dr.photoCount ?? 0;
    if (has) reportsWithPhotos += 1;

    const f =
      byForeman.get(dr.foremanId) ??
      ({ reportCount: 0, withPhotos: 0, photoCount: 0 } as Bucket);
    f.reportCount += 1;
    f.photoCount += dr.photoCount ?? 0;
    if (has) f.withPhotos += 1;
    byForeman.set(dr.foremanId, f);

    const j =
      byJob.get(dr.jobId) ??
      ({ reportCount: 0, withPhotos: 0, photoCount: 0 } as Bucket);
    j.reportCount += 1;
    j.photoCount += dr.photoCount ?? 0;
    if (has) j.withPhotos += 1;
    byJob.set(dr.jobId, j);
  }

  const foremanRows: DrPhotoForemanRow[] = [];
  for (const [id, b] of byForeman) {
    foremanRows.push({
      foremanId: id,
      reportCount: b.reportCount,
      reportsWithPhotos: b.withPhotos,
      totalPhotos: b.photoCount,
      coverageRate: b.reportCount === 0 ? 0 : b.withPhotos / b.reportCount,
      averagePhotosPerReport:
        b.reportCount === 0 ? 0 : b.photoCount / b.reportCount,
    });
  }
  foremanRows.sort((a, b) => a.coverageRate - b.coverageRate);

  const jobRows: DrPhotoJobRow[] = [];
  for (const [id, b] of byJob) {
    jobRows.push({
      jobId: id,
      reportCount: b.reportCount,
      reportsWithPhotos: b.withPhotos,
      totalPhotos: b.photoCount,
      coverageRate: b.reportCount === 0 ? 0 : b.withPhotos / b.reportCount,
    });
  }
  jobRows.sort((a, b) => a.coverageRate - b.coverageRate);

  return {
    start,
    end,
    reportCount: inWindow.length,
    reportsWithPhotos,
    totalPhotos,
    blendedCoverageRate:
      inWindow.length === 0 ? 0 : reportsWithPhotos / inWindow.length,
    byForeman: foremanRows,
    byJob: jobRows,
  };
}
