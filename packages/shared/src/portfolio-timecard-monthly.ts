// Portfolio timecard activity by month.
//
// Plain English: walk every TimeCard's entries, bucket by yyyy-mm
// of entry.date, sum worked hours, count distinct employees +
// jobs, count entries. Drives the payroll office's monthly hour
// throughput.
//
// Per row: month, entries, totalHours, distinctEmployees,
// distinctJobs.
//
// Sort: month asc.
//
// Different from timecard-monthly-hours (no distinct counts),
// timecard-by-job-monthly (per job), customer-timecard-monthly
// (per customer).
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';
import { entryWorkedHours } from './time-card';

export interface PortfolioTimecardMonthlyRow {
  month: string;
  entries: number;
  totalHours: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioTimecardMonthlyRollup {
  monthsConsidered: number;
  totalEntries: number;
  totalHours: number;
}

export interface PortfolioTimecardMonthlyInputs {
  timecards: TimeCard[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioTimecardMonthly(
  inputs: PortfolioTimecardMonthlyInputs,
): {
  rollup: PortfolioTimecardMonthlyRollup;
  rows: PortfolioTimecardMonthlyRow[];
} {
  type Acc = {
    month: string;
    entries: number;
    hours: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalEntries = 0;
  let totalHours = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const tc of inputs.timecards) {
    for (const entry of tc.entries ?? []) {
      const month = entry.date.slice(0, 7);
      if (fromM && month < fromM) continue;
      if (toM && month > toM) continue;
      let a = accs.get(month);
      if (!a) {
        a = {
          month,
          entries: 0,
          hours: 0,
          employees: new Set(),
          jobs: new Set(),
        };
        accs.set(month, a);
      }
      const hrs = entryWorkedHours(entry);
      a.entries += 1;
      a.hours += hrs;
      a.employees.add(tc.employeeId);
      a.jobs.add(entry.jobId);
      totalEntries += 1;
      totalHours += hrs;
    }
  }

  const rows: PortfolioTimecardMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      entries: a.entries,
      totalHours: Math.round(a.hours * 100) / 100,
      distinctEmployees: a.employees.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalEntries,
      totalHours: Math.round(totalHours * 100) / 100,
    },
    rows,
  };
}
