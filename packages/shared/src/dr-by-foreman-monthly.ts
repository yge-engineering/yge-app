// Per (foreman, month) daily report rollup.
//
// Plain English: bucket daily reports by (foremanId, yyyy-mm).
// Counts DRs, distinct dates, distinct jobs covered, crew-days
// total, photoCount total. Tracks foreman-level documentation
// throughput and how many jobs each foreman is moving across
// per month — useful for the monthly review with each crew lead.
//
// Per row: foremanId, month, drs, distinctDates, distinctJobs,
// crewDays, photoCount.
//
// Sort: foremanId asc, month asc.
//
// Different from job-dr-monthly (per job axis), foreman-
// throughput (lifetime), foreman-scorecard (multi-axis grade),
// dispatch-foreman-monthly (dispatch axis, not DR).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface DrByForemanMonthlyRow {
  foremanId: string;
  month: string;
  drs: number;
  distinctDates: number;
  distinctJobs: number;
  crewDays: number;
  photoCount: number;
}

export interface DrByForemanMonthlyRollup {
  foremenConsidered: number;
  monthsConsidered: number;
  totalDrs: number;
  totalCrewDays: number;
  totalPhotoCount: number;
}

export interface DrByForemanMonthlyInputs {
  dailyReports: DailyReport[];
  /** Optional yyyy-mm bounds inclusive applied to date. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDrByForemanMonthly(
  inputs: DrByForemanMonthlyInputs,
): {
  rollup: DrByForemanMonthlyRollup;
  rows: DrByForemanMonthlyRow[];
} {
  type Acc = {
    foremanId: string;
    month: string;
    drs: number;
    dates: Set<string>;
    jobs: Set<string>;
    crewDays: number;
    photoCount: number;
  };
  const accs = new Map<string, Acc>();
  const foremen = new Set<string>();
  const months = new Set<string>();

  let totalDrs = 0;
  let totalCrewDays = 0;
  let totalPhotoCount = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const dr of inputs.dailyReports) {
    const month = dr.date.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const key = `${dr.foremanId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        foremanId: dr.foremanId,
        month,
        drs: 0,
        dates: new Set(),
        jobs: new Set(),
        crewDays: 0,
        photoCount: 0,
      };
      accs.set(key, a);
    }
    a.drs += 1;
    a.dates.add(dr.date);
    a.jobs.add(dr.jobId);
    a.crewDays += (dr.crewOnSite ?? []).length;
    a.photoCount += dr.photoCount ?? 0;

    foremen.add(dr.foremanId);
    months.add(month);
    totalDrs += 1;
    totalCrewDays += (dr.crewOnSite ?? []).length;
    totalPhotoCount += dr.photoCount ?? 0;
  }

  const rows: DrByForemanMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      foremanId: a.foremanId,
      month: a.month,
      drs: a.drs,
      distinctDates: a.dates.size,
      distinctJobs: a.jobs.size,
      crewDays: a.crewDays,
      photoCount: a.photoCount,
    }))
    .sort((x, y) => {
      if (x.foremanId !== y.foremanId) {
        return x.foremanId.localeCompare(y.foremanId);
      }
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      foremenConsidered: foremen.size,
      monthsConsidered: months.size,
      totalDrs,
      totalCrewDays,
      totalPhotoCount,
    },
    rows,
  };
}
