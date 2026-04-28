// Time card hours by day of week.
//
// Plain English: across every time-card entry on file, how many
// hours hit each day of the week? Heavy civil is mostly Mon-Fri,
// but Saturday make-up days and the occasional Sunday emergency
// call show up. This is the rhythm visualization for the
// monthly review.
//
// Per row: dayOfWeek (0=Sun..6=Sat), label, totalHours,
// distinctEmployees, distinctDates, distinctJobs, entryCount,
// avgHoursPerEmployeeDay (totalHours / employee-days
// observed).
//
// Sorted Monday-first.
//
// Different from timecard-monthly-hours (per month),
// overtime-by-classification (DIR class × OT), and
// dispatch-by-day-of-week (dispatch volume).
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';
import { entryWorkedMinutes } from './time-card';

export interface TimecardByDayOfWeekRow {
  dayOfWeek: number;
  label: string;
  totalHours: number;
  distinctEmployees: number;
  distinctDates: number;
  distinctJobs: number;
  entryCount: number;
  avgHoursPerEmployeeDay: number;
}

export interface TimecardByDayOfWeekRollup {
  daysConsidered: number;
  totalHours: number;
  totalEntries: number;
}

export interface TimecardByDayOfWeekInputs {
  timeCards: TimeCard[];
  /** Optional yyyy-mm-dd window applied to entry date. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORT_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function buildTimecardByDayOfWeek(
  inputs: TimecardByDayOfWeekInputs,
): {
  rollup: TimecardByDayOfWeekRollup;
  rows: TimecardByDayOfWeekRow[];
} {
  type Acc = {
    minutes: number;
    employees: Set<string>;
    dates: Set<string>;
    employeeDays: Set<string>;
    jobs: Set<string>;
    entries: number;
  };
  const accs = new Map<number, Acc>();
  let portfolioMinutes = 0;
  let portfolioEntries = 0;

  for (const card of inputs.timeCards) {
    for (const entry of card.entries) {
      if (inputs.fromDate && entry.date < inputs.fromDate) continue;
      if (inputs.toDate && entry.date > inputs.toDate) continue;
      const dow = dayOfWeekUtc(entry.date);
      if (dow < 0) continue;
      const minutes = entryWorkedMinutes(entry);
      portfolioMinutes += minutes;
      portfolioEntries += 1;
      const acc = accs.get(dow) ?? {
        minutes: 0,
        employees: new Set<string>(),
        dates: new Set<string>(),
        employeeDays: new Set<string>(),
        jobs: new Set<string>(),
        entries: 0,
      };
      acc.minutes += minutes;
      acc.employees.add(card.employeeId);
      acc.dates.add(entry.date);
      acc.employeeDays.add(`${card.employeeId}|${entry.date}`);
      acc.jobs.add(entry.jobId);
      acc.entries += 1;
      accs.set(dow, acc);
    }
  }

  const rows: TimecardByDayOfWeekRow[] = [];
  for (const dow of SORT_ORDER) {
    const acc = accs.get(dow);
    if (!acc) continue;
    const totalHours = Math.round((acc.minutes / 60) * 100) / 100;
    const empDays = acc.employeeDays.size;
    const avg = empDays === 0
      ? 0
      : Math.round((totalHours / empDays) * 100) / 100;
    rows.push({
      dayOfWeek: dow,
      label: LABELS[dow] ?? '',
      totalHours,
      distinctEmployees: acc.employees.size,
      distinctDates: acc.dates.size,
      distinctJobs: acc.jobs.size,
      entryCount: acc.entries,
      avgHoursPerEmployeeDay: avg,
    });
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      totalHours: Math.round((portfolioMinutes / 60) * 100) / 100,
      totalEntries: portfolioEntries,
    },
    rows,
  };
}

function dayOfWeekUtc(ymd: string): number {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;
  return new Date(t).getUTCDay();
}
