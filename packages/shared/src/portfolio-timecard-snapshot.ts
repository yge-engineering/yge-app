// Portfolio timecard snapshot.
//
// Plain English: as-of today, count cards, sum total hours +
// daily/weekly OT, break down by status, count distinct
// employees + jobs, and surface YTD totals. Drives the
// right-now payroll-pipeline + crew-time overview.
//
// Pure derivation. No persisted records.

import type { TimeCard, TimeCardStatus } from './time-card';

import { hoursByDate, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface PortfolioTimecardSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalCards: number;
  ytdCards: number;
  totalHours: number;
  ytdHours: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  byStatus: Partial<Record<TimeCardStatus, number>>;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioTimecardSnapshotInputs {
  timeCards: TimeCard[];
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

export function buildPortfolioTimecardSnapshot(
  inputs: PortfolioTimecardSnapshotInputs,
): PortfolioTimecardSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byStatus = new Map<TimeCardStatus, number>();
  const employees = new Set<string>();
  const jobs = new Set<string>();

  let totalCards = 0;
  let ytdCards = 0;
  let totalHours = 0;
  let ytdHours = 0;
  let dailyOvertimeHours = 0;
  let weeklyOvertimeHours = 0;

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    totalCards += 1;
    const hours = totalCardHours(c);
    totalHours += hours;
    const ot = overtimeHoursThisWeek(c);
    dailyOvertimeHours += ot.dailyOvertimeHours;
    weeklyOvertimeHours += ot.weeklyOvertimeHours;
    byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
    employees.add(c.employeeId);
    for (const e of c.entries) jobs.add(e.jobId);
    if (Number(c.weekStarting.slice(0, 4)) === logYear) {
      ytdCards += 1;
      ytdHours += hours;
    }
    // touch hoursByDate so the helper stays linked even if unused below
    hoursByDate(c);
  }

  const out: Partial<Record<TimeCardStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalCards,
    ytdCards,
    totalHours: round2(totalHours),
    ytdHours: round2(ytdHours),
    dailyOvertimeHours: round2(dailyOvertimeHours),
    weeklyOvertimeHours: round2(weeklyOvertimeHours),
    byStatus: out,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
  };
}
