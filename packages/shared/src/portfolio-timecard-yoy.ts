// Portfolio timecard year-over-year.
//
// Plain English: collapse two years of time-card entries into
// a comparison row with worked hours, distinct employees +
// jobs, plus deltas.
//
// Different from portfolio-timecard-monthly (per month).
//
// Pure derivation. No persisted records.

import type { TimeCard, TimeEntry } from './time-card';
import { entryWorkedHours } from './time-card';

export interface PortfolioTimecardYoyResult {
  priorYear: number;
  currentYear: number;
  priorEntries: number;
  priorTotalHours: number;
  priorDistinctEmployees: number;
  priorDistinctJobs: number;
  currentEntries: number;
  currentTotalHours: number;
  currentDistinctEmployees: number;
  currentDistinctJobs: number;
  totalHoursDelta: number;
}

export interface PortfolioTimecardYoyInputs {
  timecards: TimeCard[];
  currentYear: number;
}

export function buildPortfolioTimecardYoy(
  inputs: PortfolioTimecardYoyInputs,
): PortfolioTimecardYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    entries: number;
    hours: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      entries: 0,
      hours: 0,
      employees: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const tc of inputs.timecards) {
    for (const entry of (tc.entries ?? []) as TimeEntry[]) {
      const year = Number(entry.date.slice(0, 4));
      let b: Bucket | null = null;
      if (year === priorYear) b = prior;
      else if (year === inputs.currentYear) b = current;
      if (!b) continue;
      b.entries += 1;
      b.hours += entryWorkedHours(entry);
      b.employees.add(tc.employeeId);
      b.jobs.add(entry.jobId);
    }
  }

  const round = (n: number): number => Math.round(n * 100) / 100;

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorEntries: prior.entries,
    priorTotalHours: round(prior.hours),
    priorDistinctEmployees: prior.employees.size,
    priorDistinctJobs: prior.jobs.size,
    currentEntries: current.entries,
    currentTotalHours: round(current.hours),
    currentDistinctEmployees: current.employees.size,
    currentDistinctJobs: current.jobs.size,
    totalHoursDelta: round(current.hours - prior.hours),
  };
}
