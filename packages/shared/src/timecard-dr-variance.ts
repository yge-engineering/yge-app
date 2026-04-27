// Time-card vs Daily-Report variance.
//
// Plain English: a foreman's daily report says employee X worked
// 8.0 hours on job Y on Thursday. Employee X's time card says they
// worked 9.5 hours on job Y on Thursday. That 1.5 hour gap is a
// payroll problem — somebody is going to get paid wrong, and the
// CPR (certified payroll report) won't reconcile to the DR. This
// surfaces those mismatches before payroll runs.
//
// Match grain: (employeeId, date, jobId). Aggregate hours on each
// side, compute delta, flag when delta exceeds a tolerance band.
//
// Pure derivation. No persisted records.

import { crewRowWorkedMinutes } from './daily-report';
import type { DailyReport } from './daily-report';
import { entryWorkedMinutes } from './time-card';
import type { TimeCard } from './time-card';

export type TimecardDrFlag =
  | 'MATCH'           // within tolerance
  | 'TC_HIGHER'       // time card claims more hours than DR
  | 'DR_HIGHER'       // DR claims more hours than time card
  | 'MISSING_DR'      // time card has hours but no DR row
  | 'MISSING_TC';     // DR has crew row but no time card entry

export interface TimecardDrVarianceRow {
  employeeId: string;
  date: string;
  jobId: string;
  drHours: number;
  tcHours: number;
  /** tcHours - drHours. */
  deltaHours: number;
  flag: TimecardDrFlag;
}

export interface TimecardDrVarianceRollup {
  pairsConsidered: number;
  matched: number;
  tcHigher: number;
  drHigher: number;
  missingDr: number;
  missingTc: number;
  /** Sum of |delta| where flag != MATCH. */
  totalAbsoluteVarianceHours: number;
}

export interface TimecardDrVarianceInputs {
  /** Optional yyyy-mm-dd window. */
  fromDate?: string;
  toDate?: string;
  /** Tolerance in hours. Default 0.25 (15 minutes). */
  toleranceHours?: number;
  dailyReports: DailyReport[];
  timeCards: TimeCard[];
}

export function buildTimecardDrVariance(inputs: TimecardDrVarianceInputs): {
  rollup: TimecardDrVarianceRollup;
  rows: TimecardDrVarianceRow[];
} {
  const tolerance = inputs.toleranceHours ?? 0.25;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // (employeeId|date|jobId) -> hours, both sides.
  const drHours = new Map<string, number>();
  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (!inRange(dr.date)) continue;
    for (const row of dr.crewOnSite) {
      const minutes = crewRowWorkedMinutes(row);
      if (minutes === 0) continue;
      const key = `${row.employeeId}|${dr.date}|${dr.jobId}`;
      drHours.set(key, (drHours.get(key) ?? 0) + minutes / 60);
    }
  }

  const tcHours = new Map<string, number>();
  for (const card of inputs.timeCards) {
    if (card.status === 'DRAFT' || card.status === 'REJECTED') continue;
    for (const entry of card.entries) {
      if (!inRange(entry.date)) continue;
      const minutes = entryWorkedMinutes(entry);
      if (minutes === 0) continue;
      const key = `${card.employeeId}|${entry.date}|${entry.jobId}`;
      tcHours.set(key, (tcHours.get(key) ?? 0) + minutes / 60);
    }
  }

  const allKeys = new Set<string>([...drHours.keys(), ...tcHours.keys()]);
  const rows: TimecardDrVarianceRow[] = [];
  let matched = 0;
  let tcHigher = 0;
  let drHigher = 0;
  let missingDr = 0;
  let missingTc = 0;
  let absVariance = 0;

  for (const key of allKeys) {
    const parts = key.split('|');
    const employeeId = parts[0] ?? '';
    const date = parts[1] ?? '';
    const jobId = parts[2] ?? '';
    const dr = round2(drHours.get(key) ?? 0);
    const tc = round2(tcHours.get(key) ?? 0);
    const delta = round2(tc - dr);

    let flag: TimecardDrFlag;
    if (dr === 0 && tc > 0) {
      flag = 'MISSING_DR';
      missingDr += 1;
    } else if (tc === 0 && dr > 0) {
      flag = 'MISSING_TC';
      missingTc += 1;
    } else if (Math.abs(delta) <= tolerance) {
      flag = 'MATCH';
      matched += 1;
    } else if (delta > 0) {
      flag = 'TC_HIGHER';
      tcHigher += 1;
    } else {
      flag = 'DR_HIGHER';
      drHigher += 1;
    }
    if (flag !== 'MATCH') absVariance += Math.abs(delta);

    rows.push({
      employeeId,
      date,
      jobId,
      drHours: dr,
      tcHours: tc,
      deltaHours: delta,
      flag,
    });
  }

  // Biggest absolute variance first, then by date desc.
  rows.sort((a, b) => {
    const av = Math.abs(b.deltaHours) - Math.abs(a.deltaHours);
    if (av !== 0) return av;
    return b.date.localeCompare(a.date);
  });

  return {
    rollup: {
      pairsConsidered: rows.length,
      matched,
      tcHigher,
      drHigher,
      missingDr,
      missingTc,
      totalAbsoluteVarianceHours: round2(absVariance),
    },
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
