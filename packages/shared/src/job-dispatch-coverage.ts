// Per-job dispatch coverage.
//
// Plain English: for each active job, how many of the working days
// in the last N had a dispatch posted? A job that hasn't been
// dispatched in two weeks is either:
//   - winding down (legitimate)
//   - waiting on something (drainage on RFI / submittal answer)
//   - quietly going dark (problem)
//
// Conversely, a job dispatched every day is the heaviest demand on
// crews + iron and may need help.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export type CoverageFlag =
  | 'HEAVY'        // >75% of working days dispatched
  | 'STEADY'       // 30-75%
  | 'LIGHT'        // 5-30%
  | 'DARK';        // <5% (effectively no dispatches)

export interface JobCoverageRow {
  jobId: string;
  projectName: string;
  daysDispatched: number;
  windowDays: number;
  coveragePct: number;
  /** Most recent scheduledFor across POSTED+COMPLETED dispatches.
   *  Null when none in the window. */
  lastDispatchDate: string | null;
  daysSinceLastDispatch: number | null;
  flag: CoverageFlag;
}

export interface JobCoverageRollup {
  jobsConsidered: number;
  windowDays: number;
  heavy: number;
  steady: number;
  light: number;
  dark: number;
}

export interface JobCoverageInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  dispatches: Dispatch[];
  /** When false (default), only AWARDED jobs are considered. */
  includeAllStatuses?: boolean;
  /** When false (default), only POSTED + COMPLETED dispatches count. */
  includeDraftDispatches?: boolean;
}

export function buildJobDispatchCoverage(inputs: JobCoverageInputs): {
  rollup: JobCoverageRollup;
  rows: JobCoverageRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;
  const includeDraft = inputs.includeDraftDispatches === true;
  const windowDays = countWindowDays(inputs.fromDate, inputs.toDate);
  const toDate = new Date(`${inputs.toDate}T00:00:00Z`);

  // jobId → set of distinct dates dispatched + most recent date.
  type Bucket = { days: Set<string>; latest: string | null };
  const byJob = new Map<string, Bucket>();
  for (const d of inputs.dispatches) {
    if (d.scheduledFor < inputs.fromDate) continue;
    if (d.scheduledFor > inputs.toDate) continue;
    if (!includeDraft && d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const b = byJob.get(d.jobId) ?? { days: new Set<string>(), latest: null };
    b.days.add(d.scheduledFor);
    if (!b.latest || d.scheduledFor > b.latest) b.latest = d.scheduledFor;
    byJob.set(d.jobId, b);
  }

  const rows: JobCoverageRow[] = [];
  const counts = { heavy: 0, steady: 0, light: 0, dark: 0 };

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const b = byJob.get(j.id);
    const days = b?.days.size ?? 0;
    const latest = b?.latest ?? null;
    const coverage = windowDays === 0 ? 0 : days / windowDays;
    const flag = classify(coverage);
    let daysSinceLast: number | null = null;
    if (latest) {
      const latestDate = new Date(`${latest}T00:00:00Z`);
      daysSinceLast = Math.max(0, daysBetween(latestDate, toDate));
    }
    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      daysDispatched: days,
      windowDays,
      coveragePct: round4(coverage),
      lastDispatchDate: latest,
      daysSinceLastDispatch: daysSinceLast,
      flag,
    });
    if (flag === 'HEAVY') counts.heavy += 1;
    else if (flag === 'STEADY') counts.steady += 1;
    else if (flag === 'LIGHT') counts.light += 1;
    else counts.dark += 1;
  }

  // DARK first (the alert), then by coverage asc within tier.
  const tierRank: Record<CoverageFlag, number> = {
    DARK: 0,
    LIGHT: 1,
    STEADY: 2,
    HEAVY: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return a.coveragePct - b.coveragePct;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      windowDays,
      heavy: counts.heavy,
      steady: counts.steady,
      light: counts.light,
      dark: counts.dark,
    },
    rows,
  };
}

function classify(c: number): CoverageFlag {
  if (c > 0.75) return 'HEAVY';
  if (c >= 0.3) return 'STEADY';
  if (c >= 0.05) return 'LIGHT';
  return 'DARK';
}

function countWindowDays(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
  const diff = Math.round((t.getTime() - f.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff + 1);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
