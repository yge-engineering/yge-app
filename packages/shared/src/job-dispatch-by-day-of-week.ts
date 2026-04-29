// Per-job dispatch volume by day of week.
//
// Plain English: bucket dispatches by (jobId, day-of-week of
// scheduledFor). Useful for "this job runs Mon-Wed; nothing on
// Thu-Fri" pattern detection (might be a sub or owner-controlled
// access window).
//
// Per row: jobId, dayOfWeek, label, dispatches, distinctDates.
//
// Sort: jobId asc, dayOfWeek (Mon-first) within job.
//
// Different from dispatch-by-day-of-week (portfolio, no job
// axis), job-dispatch-summary (lifetime per-job rollup).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface JobDispatchByDayOfWeekRow {
  jobId: string;
  dayOfWeek: number;
  label: string;
  dispatches: number;
  distinctDates: number;
}

export interface JobDispatchByDayOfWeekRollup {
  jobsConsidered: number;
  totalDispatches: number;
}

export interface JobDispatchByDayOfWeekInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_RANK = new Map<number, number>(DOW_ORDER.map((d, i) => [d, i]));

export function buildJobDispatchByDayOfWeek(
  inputs: JobDispatchByDayOfWeekInputs,
): {
  rollup: JobDispatchByDayOfWeekRollup;
  rows: JobDispatchByDayOfWeekRow[];
} {
  type Acc = {
    jobId: string;
    dow: number;
    dispatches: number;
    dates: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    const dow = dayOfWeekUtc(d.scheduledFor);
    if (dow < 0) continue;
    const key = `${d.jobId}|${dow}`;
    const acc = accs.get(key) ?? {
      jobId: d.jobId,
      dow,
      dispatches: 0,
      dates: new Set<string>(),
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    accs.set(key, acc);
    jobSet.add(d.jobId);
    totalDispatches += 1;
  }

  const rows: JobDispatchByDayOfWeekRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      dayOfWeek: acc.dow,
      label: LABELS[acc.dow] ?? '',
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return (DOW_RANK.get(a.dayOfWeek) ?? 0) - (DOW_RANK.get(b.dayOfWeek) ?? 0);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      totalDispatches,
    },
    rows,
  };
}

function dayOfWeekUtc(ymd: string): number {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;
  return new Date(t).getUTCDay();
}
