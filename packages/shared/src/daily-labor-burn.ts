// Daily labor burn rate.
//
// Plain English: how much labor went out the door each day across
// every active job? Walks submitted daily reports and rolls up
// per-day:
//   - total worked hours
//   - distinct employees on payroll that day
//   - distinct jobs run
//   - DRs filed
//
// Drives capacity-planning ("Wednesdays are always our heaviest")
// and the morning glance ("yesterday was a 92-hour day, that
// tracks").
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import { crewRowWorkedMinutes } from './daily-report';

export interface DailyBurnRow {
  date: string;
  drsFiled: number;
  totalWorkedHours: number;
  distinctEmployees: number;
  distinctJobs: number;
  /** Average crew size across DRs that day (totalCrewSizeSum / drs). */
  avgCrewSize: number;
}

export interface DailyBurnRollup {
  daysWithActivity: number;
  totalWorkedHours: number;
  /** Highest single-day worked hours. */
  peakDayHours: number;
  peakDayDate: string | null;
  /** Avg worked hours across days that had activity. */
  avgWorkedHoursPerActiveDay: number;
}

export interface DailyBurnInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  dailyReports: DailyReport[];
}

export function buildDailyLaborBurn(inputs: DailyBurnInputs): {
  rollup: DailyBurnRollup;
  rows: DailyBurnRow[];
} {
  type Bucket = {
    date: string;
    drsFiled: number;
    minutes: number;
    employees: Set<string>;
    jobs: Set<string>;
    crewSizeSum: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (dr.date < inputs.fromDate || dr.date > inputs.toDate) continue;
    const b = buckets.get(dr.date) ?? {
      date: dr.date,
      drsFiled: 0,
      minutes: 0,
      employees: new Set<string>(),
      jobs: new Set<string>(),
      crewSizeSum: 0,
    };
    b.drsFiled += 1;
    b.crewSizeSum += dr.crewOnSite.length;
    b.jobs.add(dr.jobId);
    for (const row of dr.crewOnSite) {
      b.employees.add(row.employeeId);
      b.minutes += crewRowWorkedMinutes(row);
    }
    buckets.set(dr.date, b);
  }

  const rows: DailyBurnRow[] = [];
  let totalHours = 0;
  let peakHours = 0;
  let peakDate: string | null = null;

  for (const b of buckets.values()) {
    const hours = round1(b.minutes / 60);
    rows.push({
      date: b.date,
      drsFiled: b.drsFiled,
      totalWorkedHours: hours,
      distinctEmployees: b.employees.size,
      distinctJobs: b.jobs.size,
      avgCrewSize: b.drsFiled === 0 ? 0 : round1(b.crewSizeSum / b.drsFiled),
    });
    totalHours += hours;
    if (hours > peakHours) {
      peakHours = hours;
      peakDate = b.date;
    }
  }

  // Date asc.
  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rollup: {
      daysWithActivity: rows.length,
      totalWorkedHours: round1(totalHours),
      peakDayHours: peakHours,
      peakDayDate: peakDate,
      avgWorkedHoursPerActiveDay:
        rows.length === 0 ? 0 : round1(totalHours / rows.length),
    },
    rows,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
