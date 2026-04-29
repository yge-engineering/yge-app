// Per-month daily report volume.
//
// Plain English: bucket submitted DRs by yyyy-mm of date so the
// office sees how many DRs landed each month, plus the
// draft-vs-submitted split, distinct foremen + jobs.
//
// Per row: month, total, submitted, draft, distinctForemen,
// distinctJobs, totalCrewRows.
//
// Sort by month asc.
//
// Different from dr-timeliness (per-DR lateness),
// dr-photo-coverage (per-DR photos), foreman-scorecard (per
// foreman), and job-dr-streak (per-job streaks). This is the
// volume-over-time view.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface DrMonthlyVolumeRow {
  month: string;
  total: number;
  submitted: number;
  draft: number;
  distinctForemen: number;
  distinctJobs: number;
  totalCrewRows: number;
}

export interface DrMonthlyVolumeRollup {
  monthsConsidered: number;
  totalReports: number;
  submittedReports: number;
  monthOverMonthSubmittedChange: number;
}

export interface DrMonthlyVolumeInputs {
  dailyReports: DailyReport[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDrMonthlyVolume(
  inputs: DrMonthlyVolumeInputs,
): {
  rollup: DrMonthlyVolumeRollup;
  rows: DrMonthlyVolumeRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    submitted: number;
    draft: number;
    foremen: Set<string>;
    jobs: Set<string>;
    crewRows: number;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    submitted: 0,
    draft: 0,
    foremen: new Set<string>(),
    jobs: new Set<string>(),
    crewRows: 0,
  });
  const buckets = new Map<string, Bucket>();

  for (const dr of inputs.dailyReports) {
    const month = dr.date.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.total += 1;
    if (dr.submitted) b.submitted += 1;
    else b.draft += 1;
    b.foremen.add(dr.foremanId);
    b.jobs.add(dr.jobId);
    b.crewRows += dr.crewOnSite.length;
    buckets.set(month, b);
  }

  const rows: DrMonthlyVolumeRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      total: b.total,
      submitted: b.submitted,
      draft: b.draft,
      distinctForemen: b.foremen.size,
      distinctJobs: b.jobs.size,
      totalCrewRows: b.crewRows,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.submitted - prev.submitted;
  }

  let totalReports = 0;
  let submittedReports = 0;
  for (const r of rows) {
    totalReports += r.total;
    submittedReports += r.submitted;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalReports,
      submittedReports,
      monthOverMonthSubmittedChange: mom,
    },
    rows,
  };
}
