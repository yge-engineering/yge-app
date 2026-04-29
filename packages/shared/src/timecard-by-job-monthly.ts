// Per (job, month) timecard hours.
//
// Plain English: bucket time-card entries by (jobId, yyyy-mm of
// entry date). Long-format. Useful for the per-job monthly labor
// burn vs budget comparison.
//
// Per row: jobId, month, totalHours, distinctEmployees,
// distinctDays, entryCount.
//
// Sort: jobId asc, month asc.
//
// Different from job-timecard-hours (per-job lifetime),
// timecard-monthly-hours (portfolio per month, no job axis),
// timecard-by-day-of-week (DOW axis).
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';
import { entryWorkedMinutes } from './time-card';

export interface TimecardByJobMonthlyRow {
  jobId: string;
  month: string;
  totalHours: number;
  distinctEmployees: number;
  distinctDays: number;
  entryCount: number;
}

export interface TimecardByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalHours: number;
}

export interface TimecardByJobMonthlyInputs {
  timeCards: TimeCard[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildTimecardByJobMonthly(
  inputs: TimecardByJobMonthlyInputs,
): {
  rollup: TimecardByJobMonthlyRollup;
  rows: TimecardByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    minutes: number;
    employees: Set<string>;
    days: Set<string>;
    entries: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let portfolioMinutes = 0;

  for (const card of inputs.timeCards) {
    for (const entry of card.entries) {
      const month = entry.date.slice(0, 7);
      if (month.length < 7) continue;
      if (inputs.fromMonth && month < inputs.fromMonth) continue;
      if (inputs.toMonth && month > inputs.toMonth) continue;
      const minutes = entryWorkedMinutes(entry);
      const key = `${entry.jobId}|${month}`;
      const acc = accs.get(key) ?? {
        jobId: entry.jobId,
        month,
        minutes: 0,
        employees: new Set<string>(),
        days: new Set<string>(),
        entries: 0,
      };
      acc.minutes += minutes;
      acc.employees.add(card.employeeId);
      acc.days.add(entry.date);
      acc.entries += 1;
      accs.set(key, acc);
      jobSet.add(entry.jobId);
      monthSet.add(month);
      portfolioMinutes += minutes;
    }
  }

  const rows: TimecardByJobMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      totalHours: Math.round((acc.minutes / 60) * 100) / 100,
      distinctEmployees: acc.employees.size,
      distinctDays: acc.days.size,
      entryCount: acc.entries,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalHours: Math.round((portfolioMinutes / 60) * 100) / 100,
    },
    rows,
  };
}
