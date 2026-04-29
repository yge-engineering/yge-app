// Per (job, month) daily report rollup.
//
// Plain English: bucket daily reports by (jobId, yyyy-mm of
// date). Counts DRs filed, distinct foremen, total crew-days,
// total photoCount, weather mix. Tells YGE month over month
// how each active job is being documented — the kind of view
// the field manager scans before a dispute meeting.
//
// "crewDays" = sum of crewOnSite[].length across the month — a
// rough labor-days proxy.
//
// Per row: jobId, month, drs, distinctForemen, distinctDates,
// crewDays, photoCount.
//
// Sort: jobId asc, month asc.
//
// Different from dr-monthly-volume (portfolio per month, no
// job axis), job-dr-streak (per job consecutive day streaks),
// job-dr-scope-completeness (per job text-fill quality),
// job-dr-timeliness (per job late-vs-on-time submission).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface JobDrMonthlyRow {
  jobId: string;
  month: string;
  drs: number;
  distinctForemen: number;
  distinctDates: number;
  crewDays: number;
  photoCount: number;
}

export interface JobDrMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalDrs: number;
  totalCrewDays: number;
  totalPhotoCount: number;
}

export interface JobDrMonthlyInputs {
  dailyReports: DailyReport[];
  /** Optional yyyy-mm bounds inclusive applied to date. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobDrMonthly(
  inputs: JobDrMonthlyInputs,
): {
  rollup: JobDrMonthlyRollup;
  rows: JobDrMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    drs: number;
    foremen: Set<string>;
    dates: Set<string>;
    crewDays: number;
    photoCount: number;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
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
    const key = `${dr.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: dr.jobId,
        month,
        drs: 0,
        foremen: new Set(),
        dates: new Set(),
        crewDays: 0,
        photoCount: 0,
      };
      accs.set(key, a);
    }
    a.drs += 1;
    a.foremen.add(dr.foremanId);
    a.dates.add(dr.date);
    a.crewDays += (dr.crewOnSite ?? []).length;
    a.photoCount += dr.photoCount ?? 0;

    jobs.add(dr.jobId);
    months.add(month);
    totalDrs += 1;
    totalCrewDays += (dr.crewOnSite ?? []).length;
    totalPhotoCount += dr.photoCount ?? 0;
  }

  const rows: JobDrMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      jobId: a.jobId,
      month: a.month,
      drs: a.drs,
      distinctForemen: a.foremen.size,
      distinctDates: a.dates.size,
      crewDays: a.crewDays,
      photoCount: a.photoCount,
    }))
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalDrs,
      totalCrewDays,
      totalPhotoCount,
    },
    rows,
  };
}
