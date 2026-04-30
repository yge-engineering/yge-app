// Employee-anchored timecard snapshot.
//
// Plain English: for one employee, as-of today, count
// timecards, sum total + daily/weekly OT hours, status mix,
// distinct jobs they touched, last weekStarting. Drives the
// right-now per-employee timecard overview on the employee-
// detail page.
//
// Pure derivation. No persisted records.

import type { TimeCard, TimeCardStatus } from './time-card';

import { overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface EmployeeTimecardSnapshotResult {
  asOf: string;
  employeeId: string;
  totalCards: number;
  ytdCards: number;
  totalHours: number;
  ytdHours: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  byStatus: Partial<Record<TimeCardStatus, number>>;
  distinctJobs: number;
  lastWeekStarting: string | null;
}

export interface EmployeeTimecardSnapshotInputs {
  employeeId: string;
  timeCards: TimeCard[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
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

export function buildEmployeeTimecardSnapshot(
  inputs: EmployeeTimecardSnapshotInputs,
): EmployeeTimecardSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byStatus = new Map<TimeCardStatus, number>();
  const jobs = new Set<string>();
  let totalCards = 0;
  let ytdCards = 0;
  let totalHours = 0;
  let ytdHours = 0;
  let dailyOvertimeHours = 0;
  let weeklyOvertimeHours = 0;
  let lastWeekStarting: string | null = null;

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    if (c.weekStarting > asOf) continue;
    totalCards += 1;
    const hours = totalCardHours(c);
    totalHours += hours;
    const ot = overtimeHoursThisWeek(c);
    dailyOvertimeHours += ot.dailyOvertimeHours;
    weeklyOvertimeHours += ot.weeklyOvertimeHours;
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
    for (const e of c.entries) jobs.add(e.jobId);
    if (Number(c.weekStarting.slice(0, 4)) === logYear) {
      ytdCards += 1;
      ytdHours += hours;
    }
    if (lastWeekStarting == null || c.weekStarting > lastWeekStarting) lastWeekStarting = c.weekStarting;
  }

  const out: Partial<Record<TimeCardStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    employeeId: inputs.employeeId,
    totalCards,
    ytdCards,
    totalHours: round2(totalHours),
    ytdHours: round2(ytdHours),
    dailyOvertimeHours: round2(dailyOvertimeHours),
    weeklyOvertimeHours: round2(weeklyOvertimeHours),
    byStatus: out,
    distinctJobs: jobs.size,
    lastWeekStarting,
  };
}
