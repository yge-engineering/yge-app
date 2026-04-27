// Per-foreman crew throughput.
//
// Plain English: foreman-scorecard already tracks paperwork habits
// (DR submission rate, photo coverage, late filings). This module
// covers the OTHER half — operational throughput. Across the same
// DRs:
//   - distinct crew members managed
//   - average crew size per DR
//   - total crew-hours run
//   - distinct jobs ran
//
// Drives "who's running the most labor?" + "is that one foreman
// who runs 12-person crews going to burn out?" management
// visibility.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import { crewRowWorkedMinutes } from './daily-report';

export interface ForemanThroughputRow {
  foremanId: string;
  drsSubmitted: number;
  distinctEmployeesManaged: number;
  avgCrewSize: number;
  totalCrewHours: number;
  /** drsSubmitted * avgCrewSize roughly. Surfaces the foreman's
   *  total "labor effort" managed in window. */
  crewDayCount: number;
  distinctJobsRun: number;
  /** Largest single-day crew this foreman ran. */
  peakCrewSize: number;
}

export interface ForemanThroughputRollup {
  foremenConsidered: number;
  totalDrs: number;
  totalCrewHours: number;
  /** Foremen who consistently run 8+ employees per DR. */
  largeCrewForemenCount: number;
}

export interface ForemanThroughputInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  dailyReports: DailyReport[];
}

export function buildForemanThroughput(inputs: ForemanThroughputInputs): {
  rollup: ForemanThroughputRollup;
  rows: ForemanThroughputRow[];
} {
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  type Bucket = {
    foremanId: string;
    drs: number;
    crewMinutesSum: number;
    crewSizeSum: number;
    distinctEmployees: Set<string>;
    distinctJobs: Set<string>;
    peakCrewSize: number;
    crewDays: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (!inRange(dr.date)) continue;
    const b = buckets.get(dr.foremanId) ?? {
      foremanId: dr.foremanId,
      drs: 0,
      crewMinutesSum: 0,
      crewSizeSum: 0,
      distinctEmployees: new Set<string>(),
      distinctJobs: new Set<string>(),
      peakCrewSize: 0,
      crewDays: 0,
    };
    b.drs += 1;
    const size = dr.crewOnSite.length;
    b.crewSizeSum += size;
    b.crewDays += size;
    if (size > b.peakCrewSize) b.peakCrewSize = size;
    for (const row of dr.crewOnSite) {
      b.distinctEmployees.add(row.employeeId);
      b.crewMinutesSum += crewRowWorkedMinutes(row);
    }
    b.distinctJobs.add(dr.jobId);
    buckets.set(dr.foremanId, b);
  }

  const rows: ForemanThroughputRow[] = [];
  let totalDrs = 0;
  let totalHours = 0;
  let largeCrewCount = 0;

  for (const b of buckets.values()) {
    const avgCrew = b.drs === 0 ? 0 : b.crewSizeSum / b.drs;
    const hours = round1(b.crewMinutesSum / 60);
    rows.push({
      foremanId: b.foremanId,
      drsSubmitted: b.drs,
      distinctEmployeesManaged: b.distinctEmployees.size,
      avgCrewSize: round1(avgCrew),
      totalCrewHours: hours,
      crewDayCount: b.crewDays,
      distinctJobsRun: b.distinctJobs.size,
      peakCrewSize: b.peakCrewSize,
    });
    totalDrs += b.drs;
    totalHours += hours;
    if (avgCrew >= 8) largeCrewCount += 1;
  }

  // Most labor-effort first.
  rows.sort((a, b) => b.crewDayCount - a.crewDayCount);

  return {
    rollup: {
      foremenConsidered: rows.length,
      totalDrs,
      totalCrewHours: round1(totalHours),
      largeCrewForemenCount: largeCrewCount,
    },
    rows,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
