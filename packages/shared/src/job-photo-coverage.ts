// Per-job photo evidence index.
//
// Plain English: photographic evidence is what wins differing-site-
// condition claims and protects against agency callbacks. dr-photo-
// coverage already tracks this cross-job. This module flips it: per
// AWARDED job, the photo evidence summary in a single row.
//
// Why this matters: when an agency disputes a CO line, the answer
// "we have 38 dated photos of the existing condition before we
// touched it" is the difference between paying and getting paid.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export type PhotoCoverageFlag =
  | 'STRONG'    // photos on >=80% of DR days, avg >=3 per DR
  | 'OK'        // photos on >=50% of DR days
  | 'THIN'      // photos on 25-50%
  | 'POOR';     // <25% (defense weak — flag the foreman)

export interface JobPhotoCoverageRow {
  jobId: string;
  projectName: string;
  drCount: number;
  drsWithPhotos: number;
  totalPhotos: number;
  /** Avg photos across DRs that have at least one photo. */
  avgPhotosPerCoveredDr: number;
  /** Coverage rate = drsWithPhotos / drCount. 0..1. */
  coverageRate: number;
  flag: PhotoCoverageFlag;
}

export interface JobPhotoCoverageRollup {
  jobsConsidered: number;
  totalDrs: number;
  totalPhotos: number;
  strong: number;
  ok: number;
  thin: number;
  poor: number;
}

export interface JobPhotoCoverageInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  dailyReports: DailyReport[];
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobPhotoCoverage(
  inputs: JobPhotoCoverageInputs,
): {
  rollup: JobPhotoCoverageRollup;
  rows: JobPhotoCoverageRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  type Bucket = {
    drCount: number;
    drsWithPhotos: number;
    totalPhotos: number;
  };
  const byJob = new Map<string, Bucket>();

  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (!inRange(dr.date)) continue;
    const b = byJob.get(dr.jobId) ?? {
      drCount: 0,
      drsWithPhotos: 0,
      totalPhotos: 0,
    };
    b.drCount += 1;
    if (dr.photoCount > 0) {
      b.drsWithPhotos += 1;
      b.totalPhotos += dr.photoCount;
    }
    byJob.set(dr.jobId, b);
  }

  const rows: JobPhotoCoverageRow[] = [];
  const counts = { strong: 0, ok: 0, thin: 0, poor: 0 };
  let totalDrs = 0;
  let totalPhotos = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const b = byJob.get(j.id) ?? {
      drCount: 0,
      drsWithPhotos: 0,
      totalPhotos: 0,
    };
    const coverage = b.drCount === 0 ? 0 : b.drsWithPhotos / b.drCount;
    const avgPerCovered =
      b.drsWithPhotos === 0 ? 0 : b.totalPhotos / b.drsWithPhotos;

    let flag: PhotoCoverageFlag;
    if (coverage >= 0.8 && avgPerCovered >= 3) flag = 'STRONG';
    else if (coverage >= 0.5) flag = 'OK';
    else if (coverage >= 0.25) flag = 'THIN';
    else flag = 'POOR';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      drCount: b.drCount,
      drsWithPhotos: b.drsWithPhotos,
      totalPhotos: b.totalPhotos,
      avgPhotosPerCoveredDr: round1(avgPerCovered),
      coverageRate: round4(coverage),
      flag,
    });

    if (flag === 'STRONG') counts.strong += 1;
    else if (flag === 'OK') counts.ok += 1;
    else if (flag === 'THIN') counts.thin += 1;
    else counts.poor += 1;
    totalDrs += b.drCount;
    totalPhotos += b.totalPhotos;
  }

  // POOR first (most actionable — flag the foreman), then THIN,
  // OK, STRONG; coverage asc within tier.
  const tierRank: Record<PhotoCoverageFlag, number> = {
    POOR: 0,
    THIN: 1,
    OK: 2,
    STRONG: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return a.coverageRate - b.coverageRate;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDrs,
      totalPhotos,
      strong: counts.strong,
      ok: counts.ok,
      thin: counts.thin,
      poor: counts.poor,
    },
    rows,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
