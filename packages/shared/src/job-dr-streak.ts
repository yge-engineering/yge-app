// Per-job daily-report submission streak.
//
// Plain English: a streak of consecutive days with a submitted DR
// is a tell that a job's paperwork is dialed in. A broken streak
// (zero current streak, last DR 5 days ago) tells the office
// somebody on that crew is dropping the ball. This module walks
// submitted DRs per AWARDED job and computes:
//   - currentStreak: consecutive days back from asOf with a DR
//   - longestStreak: longest run in window
//   - lastDrDate + daysSinceLastDr
//
// Skips weekends in streak math by default — most YGE jobs
// don't run Sat/Sun and we don't want a dropped streak just
// because nobody submitted on Sunday. Caller can flip
// includeWeekends if a job actually runs 7 days.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export interface JobDrStreakRow {
  jobId: string;
  projectName: string;
  /** Current consecutive working-day streak ending at asOf. */
  currentStreak: number;
  /** Longest streak observed in the window. */
  longestStreak: number;
  /** Most recent submitted DR date. Null if never. */
  lastDrDate: string | null;
  daysSinceLastDr: number | null;
  /** Total submitted DRs in window. */
  drCount: number;
}

export interface JobDrStreakRollup {
  jobsConsidered: number;
  zeroStreakJobs: number;
  /** Sum of currentStreak across all jobs. */
  totalCurrentStreakDays: number;
}

export interface JobDrStreakInputs {
  asOf?: string;
  /** Inclusive yyyy-mm-dd from-date for the window the longest-
   *  streak calc walks. Defaults to 90 days before asOf. */
  fromDate?: string;
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  dailyReports: DailyReport[];
  /** When false (default), Saturdays/Sundays are skipped in
   *  current-streak calculation — a missed Sun doesn't break it. */
  includeWeekends?: boolean;
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildJobDrStreak(inputs: JobDrStreakInputs): {
  rollup: JobDrStreakRollup;
  rows: JobDrStreakRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const includeWeekends = inputs.includeWeekends === true;
  const includeAll = inputs.includeAllStatuses === true;
  const fromDate =
    inputs.fromDate ??
    isoDate(new Date(refNow.getTime() - 90 * 24 * 60 * 60 * 1000));

  // jobId → set of submitted DR dates in window.
  const datesByJob = new Map<string, Set<string>>();
  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (dr.date < fromDate || dr.date > asOf) continue;
    const set = datesByJob.get(dr.jobId) ?? new Set<string>();
    set.add(dr.date);
    datesByJob.set(dr.jobId, set);
  }

  const rows: JobDrStreakRow[] = [];
  let zeroJobs = 0;
  let totalCurrent = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const dates = datesByJob.get(j.id) ?? new Set<string>();

    // Current streak: walk backward from asOf, skip weekends if
    // includeWeekends is false. Stop on first missing working day.
    let current = 0;
    let cursor = new Date(refNow);
    let safety = 0;
    while (safety < 365) {
      safety += 1;
      if (!includeWeekends && isWeekend(cursor)) {
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
        continue;
      }
      const day = isoDate(cursor);
      if (dates.has(day)) {
        current += 1;
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    // Longest streak: scan sorted dates, count contiguous working
    // days (inclusive of weekends as boundaries that DON'T break
    // a streak when includeWeekends=false).
    const sortedDates = Array.from(dates).sort();
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const d of sortedDates) {
      const cur = parseDate(d);
      if (!cur) continue;
      if (prev) {
        const gap = effectiveGapDays(prev, cur, includeWeekends);
        if (gap === 1) run += 1;
        else {
          if (run > longest) longest = run;
          run = 1;
        }
      } else {
        run = 1;
      }
      prev = cur;
    }
    if (run > longest) longest = run;

    const last = sortedDates.length === 0 ? null : sortedDates[sortedDates.length - 1]!;
    const lastParsed = last ? parseDate(last) : null;
    const daysSinceLast = lastParsed
      ? Math.max(0, daysBetween(lastParsed, refNow))
      : null;

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      currentStreak: current,
      longestStreak: longest,
      lastDrDate: last,
      daysSinceLastDr: daysSinceLast,
      drCount: dates.size,
    });
    totalCurrent += current;
    if (current === 0) zeroJobs += 1;
  }

  // Most-active streak first; ties broken by most recent DR.
  rows.sort((a, b) => {
    if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;
    return (a.daysSinceLastDr ?? Infinity) - (b.daysSinceLastDr ?? Infinity);
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      zeroStreakJobs: zeroJobs,
      totalCurrentStreakDays: totalCurrent,
    },
    rows,
  };
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function effectiveGapDays(
  from: Date,
  to: Date,
  includeWeekends: boolean,
): number {
  let count = 0;
  let cursor = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  let safety = 0;
  while (cursor.getTime() <= to.getTime() && safety < 100) {
    safety += 1;
    if (!includeWeekends && isWeekend(cursor)) {
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }
    count += 1;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return count;
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
