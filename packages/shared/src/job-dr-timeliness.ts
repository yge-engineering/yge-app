// Per-job daily-report timeliness.
//
// Plain English: every submitted daily report has both a date
// (the day the work happened) and a createdAt (when the foreman
// hit submit). Same-day filings give the office time to react
// to issues; next-day is acceptable; multi-day-late filings
// turn the DR into a memory-recovery exercise.
//
// Per AWARDED job: counts in each tier (SAME_DAY, NEXT_DAY,
// LATE_2_3, LATE_4_PLUS), median lag in days, on-time share.
//
// Different from dr-timeliness (portfolio rollup) and
// dr-weekly-summary (per-week digest). This is the per-job
// foreman accountability view.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export interface JobDrTimelinessRow {
  jobId: string;
  projectName: string;
  drCount: number;
  sameDay: number;
  nextDay: number;
  late2to3: number;
  late4Plus: number;
  /** (sameDay + nextDay) / drCount. 0 when no DRs. */
  onTimeShare: number;
  /** Median lag (createdAt - date) in days. Null when no DRs. */
  medianLagDays: number | null;
}

export interface JobDrTimelinessRollup {
  jobsConsidered: number;
  totalDrs: number;
  totalSameDay: number;
  totalLate4Plus: number;
  blendedOnTimeShare: number;
}

export interface JobDrTimelinessInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  reports: DailyReport[];
  /** Default false — only AWARDED jobs scored. */
  includeAllStatuses?: boolean;
  /** Optional yyyy-mm-dd window applied to DR.date. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobDrTimeliness(
  inputs: JobDrTimelinessInputs,
): {
  rollup: JobDrTimelinessRollup;
  rows: JobDrTimelinessRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  // Window-filter once.
  const reports = inputs.reports.filter((r) => {
    if (!r.submitted) return false;
    if (inputs.fromDate && r.date < inputs.fromDate) return false;
    if (inputs.toDate && r.date > inputs.toDate) return false;
    return true;
  });

  const byJob = new Map<string, DailyReport[]>();
  for (const r of reports) {
    const list = byJob.get(r.jobId) ?? [];
    list.push(r);
    byJob.set(r.jobId, list);
  }

  let totalDrs = 0;
  let totalSameDay = 0;
  let totalLate4 = 0;
  let totalOnTime = 0;

  const rows: JobDrTimelinessRow[] = [];
  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const drs = byJob.get(j.id) ?? [];
    let same = 0;
    let next = 0;
    let l2_3 = 0;
    let l4 = 0;
    const lags: number[] = [];
    for (const dr of drs) {
      const lag = lagDays(dr.date, dr.createdAt);
      lags.push(lag);
      if (lag <= 0) same += 1;
      else if (lag === 1) next += 1;
      else if (lag <= 3) l2_3 += 1;
      else l4 += 1;
    }
    const onTime = same + next;
    const total = drs.length;
    const share = total === 0 ? 0 : Math.round((onTime / total) * 10_000) / 10_000;
    const median = computeMedian(lags);

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      drCount: total,
      sameDay: same,
      nextDay: next,
      late2to3: l2_3,
      late4Plus: l4,
      onTimeShare: share,
      medianLagDays: median,
    });

    totalDrs += total;
    totalSameDay += same;
    totalLate4 += l4;
    totalOnTime += onTime;
  }

  // Sort: lowest on-time share first (most attention needed).
  rows.sort((a, b) => {
    if (a.onTimeShare !== b.onTimeShare) return a.onTimeShare - b.onTimeShare;
    return b.late4Plus - a.late4Plus;
  });

  const blended = totalDrs === 0 ? 0 : Math.round((totalOnTime / totalDrs) * 10_000) / 10_000;

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalDrs,
      totalSameDay,
      totalLate4Plus: totalLate4,
      blendedOnTimeShare: blended,
    },
    rows,
  };
}

function lagDays(drDate: string, createdAt: string): number {
  const created = createdAt.slice(0, 10);
  if (created.length < 10) return 0;
  const aParts = drDate.split('-').map((p) => Number.parseInt(p, 10));
  const bParts = created.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(aParts[0] ?? 0, (aParts[1] ?? 1) - 1, aParts[2] ?? 1);
  const b = Date.UTC(bParts[0] ?? 0, (bParts[1] ?? 1) - 1, bParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 10) / 10;
}
