// Portfolio overtime snapshot.
//
// Plain English: as-of today, sum daily and weekly OT hours
// across all timecards, count cards with any OT, count
// employees with any OT, and surface YTD totals. Drives the
// right-now overtime-cost overview against CA daily-OT (>8) +
// weekly-OT (>40) thresholds.
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';

import { overtimeHoursThisWeek } from './time-card';

export interface PortfolioOvertimeSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalCards: number;
  ytdCards: number;
  cardsWithOvertime: number;
  totalDailyOt: number;
  totalWeeklyOt: number;
  ytdDailyOt: number;
  ytdWeeklyOt: number;
  employeesWithOt: number;
  distinctEmployees: number;
}

export interface PortfolioOvertimeSnapshotInputs {
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

export function buildPortfolioOvertimeSnapshot(
  inputs: PortfolioOvertimeSnapshotInputs,
): PortfolioOvertimeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const employees = new Set<string>();
  const otEmployees = new Set<string>();

  let totalCards = 0;
  let ytdCards = 0;
  let cardsWithOvertime = 0;
  let totalDailyOt = 0;
  let totalWeeklyOt = 0;
  let ytdDailyOt = 0;
  let ytdWeeklyOt = 0;

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    totalCards += 1;
    employees.add(c.employeeId);
    const ot = overtimeHoursThisWeek(c);
    totalDailyOt += ot.dailyOvertimeHours;
    totalWeeklyOt += ot.weeklyOvertimeHours;
    if (ot.dailyOvertimeHours > 0 || ot.weeklyOvertimeHours > 0) {
      cardsWithOvertime += 1;
      otEmployees.add(c.employeeId);
    }
    if (Number(c.weekStarting.slice(0, 4)) === logYear) {
      ytdCards += 1;
      ytdDailyOt += ot.dailyOvertimeHours;
      ytdWeeklyOt += ot.weeklyOvertimeHours;
    }
  }

  return {
    asOf,
    ytdLogYear: logYear,
    totalCards,
    ytdCards,
    cardsWithOvertime,
    totalDailyOt: round2(totalDailyOt),
    totalWeeklyOt: round2(totalWeeklyOt),
    ytdDailyOt: round2(ytdDailyOt),
    ytdWeeklyOt: round2(ytdWeeklyOt),
    employeesWithOt: otEmployees.size,
    distinctEmployees: employees.size,
  };
}
