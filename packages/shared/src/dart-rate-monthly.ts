// Per-month DART rate (OSHA-style).
//
// Plain English: DART = Days Away, Restricted, or Transferred.
// The OSHA-style rate formula is:
//
//   DART rate = (DART cases × 200,000) / total worked hours
//
// 200,000 is the standard normalization (100 employees × 50 wks
// × 40 hrs/wk). Lower is better. National heavy-civil benchmarks
// usually run 1.5-2.5; YGE's target is below that.
//
// This module buckets incidents by yyyy-mm of incidentDate, sums
// worked hours from submitted DRs in the same month, and surfaces
// per row: dartCases, totalHours, dartRate, recordableCount,
// totalDays (away + restricted), benchmarkDelta vs caller-supplied
// industry rate.
//
// Different from incident-frequency (portfolio rollup),
// incident-monthly-trend (just counts). This is the rate-per-
// hours version that benchmarks can be compared against.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import { crewRowWorkedMinutes } from './daily-report';
import type { Incident } from './incident';

export interface DartMonthRow {
  month: string;
  dartCases: number;
  recordableCases: number;
  totalDartDays: number;
  totalHours: number;
  dartRate: number | null;
  /** dartRate − benchmarkRate. Null when dartRate is null. */
  benchmarkDelta: number | null;
}

export interface DartMonthlyRollup {
  monthsConsidered: number;
  totalDartCases: number;
  totalRecordableCases: number;
  totalHours: number;
  blendedDartRate: number | null;
}

export interface DartMonthlyInputs {
  incidents: Incident[];
  reports: DailyReport[];
  /** Industry-benchmark rate for delta. Default 2.0. */
  benchmarkRate?: number;
  fromMonth?: string;
  toMonth?: string;
}

export function buildDartRateMonthly(inputs: DartMonthlyInputs): {
  rollup: DartMonthlyRollup;
  rows: DartMonthRow[];
} {
  const benchmark = inputs.benchmarkRate ?? 2.0;

  type Bucket = {
    month: string;
    dart: number;
    recordable: number;
    days: number;
    minutes: number;
  };
  const buckets = new Map<string, Bucket>();

  // Sum incidents by month.
  for (const inc of inputs.incidents) {
    const month = inc.incidentDate.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? freshBucket(month);
    b.recordable += 1;
    if (inc.outcome === 'DAYS_AWAY' || inc.outcome === 'JOB_TRANSFER_OR_RESTRICTION') {
      b.dart += 1;
      b.days += inc.daysAway + inc.daysRestricted;
    }
    buckets.set(month, b);
  }

  // Sum worked minutes from submitted DRs by month.
  for (const r of inputs.reports) {
    if (!r.submitted) continue;
    const month = r.date.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? freshBucket(month);
    for (const row of r.crewOnSite) {
      b.minutes += crewRowWorkedMinutes(row);
    }
    buckets.set(month, b);
  }

  const rows: DartMonthRow[] = Array.from(buckets.values())
    .map((b) => {
      const hours = round2(b.minutes / 60);
      const rate = hours === 0
        ? null
        : Math.round((b.dart * 200_000 / hours) * 100) / 100;
      const delta = rate === null ? null : Math.round((rate - benchmark) * 100) / 100;
      return {
        month: b.month,
        dartCases: b.dart,
        recordableCases: b.recordable,
        totalDartDays: b.days,
        totalHours: hours,
        dartRate: rate,
        benchmarkDelta: delta,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let totalDart = 0;
  let totalRec = 0;
  let totalHours = 0;
  for (const r of rows) {
    totalDart += r.dartCases;
    totalRec += r.recordableCases;
    totalHours += r.totalHours;
  }
  const blended = totalHours === 0
    ? null
    : Math.round((totalDart * 200_000 / totalHours) * 100) / 100;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalDartCases: totalDart,
      totalRecordableCases: totalRec,
      totalHours: round2(totalHours),
      blendedDartRate: blended,
    },
    rows,
  };
}

function freshBucket(month: string): {
  month: string;
  dart: number;
  recordable: number;
  days: number;
  minutes: number;
} {
  return { month, dart: 0, recordable: 0, days: 0, minutes: 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
