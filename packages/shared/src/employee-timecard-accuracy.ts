// Per-employee timecard accuracy score.
//
// Plain English: timecard-dr-variance is the cross-cutting view
// of (employee, date, job) mismatches. This module pivots that
// per employee — for each ACTIVE employee in the window:
//   - days where their TC matched the DR within tolerance
//   - days where TC was higher (over-claiming)
//   - days where DR was higher (under-claiming on TC)
//   - days where TC has no DR row (off-book / wrong job?)
//   - days where DR has the employee but no TC row (forgot to fill)
//
// Accuracy score = matchedDays / consideredDays. 1.0 is clean.
// Drives the "who needs a timecard refresher" coaching list.
//
// Pure derivation. No persisted records.

import { crewRowWorkedMinutes } from './daily-report';
import type { DailyReport } from './daily-report';
import type { Employee } from './employee';
import { entryWorkedMinutes } from './time-card';
import type { TimeCard } from './time-card';

export type AccuracyTier = 'CLEAN' | 'OK' | 'NEEDS_COACHING' | 'NO_DATA';

export interface EmployeeAccuracyRow {
  employeeId: string;
  employeeName: string;
  matchedDays: number;
  tcHigherDays: number;
  drHigherDays: number;
  missingDrDays: number;
  missingTcDays: number;
  consideredDays: number;
  accuracyScore: number;
  tier: AccuracyTier;
}

export interface EmployeeAccuracyRollup {
  employeesConsidered: number;
  cleanCount: number;
  okCount: number;
  needsCoachingCount: number;
  noDataCount: number;
}

export interface EmployeeAccuracyInputs {
  fromDate?: string;
  toDate?: string;
  employees: Employee[];
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  /** Tolerance in hours, default 0.25 (15 min). */
  toleranceHours?: number;
}

export function buildEmployeeTimecardAccuracy(
  inputs: EmployeeAccuracyInputs,
): {
  rollup: EmployeeAccuracyRollup;
  rows: EmployeeAccuracyRow[];
} {
  const tol = inputs.toleranceHours ?? 0.25;
  const inRange = (d: string) => {
    if (inputs.fromDate && d < inputs.fromDate) return false;
    if (inputs.toDate && d > inputs.toDate) return false;
    return true;
  };

  // (employeeId|date|jobId) → hours, both sides.
  const drHours = new Map<string, number>();
  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (!inRange(dr.date)) continue;
    for (const row of dr.crewOnSite) {
      const m = crewRowWorkedMinutes(row);
      if (m === 0) continue;
      const key = `${row.employeeId}|${dr.date}|${dr.jobId}`;
      drHours.set(key, (drHours.get(key) ?? 0) + m / 60);
    }
  }
  const tcHours = new Map<string, number>();
  for (const card of inputs.timeCards) {
    if (card.status === 'DRAFT' || card.status === 'REJECTED') continue;
    for (const e of card.entries) {
      if (!inRange(e.date)) continue;
      const m = entryWorkedMinutes(e);
      if (m === 0) continue;
      const key = `${card.employeeId}|${e.date}|${e.jobId}`;
      tcHours.set(key, (tcHours.get(key) ?? 0) + m / 60);
    }
  }

  // Aggregate per employee.
  type Bucket = {
    employeeId: string;
    matched: number;
    tcHigh: number;
    drHigh: number;
    missingDr: number;
    missingTc: number;
  };
  const buckets = new Map<string, Bucket>();
  const allKeys = new Set<string>([...drHours.keys(), ...tcHours.keys()]);
  for (const key of allKeys) {
    const empId = key.split('|')[0] ?? '';
    const dr = drHours.get(key) ?? 0;
    const tc = tcHours.get(key) ?? 0;
    const b = buckets.get(empId) ?? {
      employeeId: empId,
      matched: 0,
      tcHigh: 0,
      drHigh: 0,
      missingDr: 0,
      missingTc: 0,
    };
    if (dr === 0 && tc > 0) b.missingDr += 1;
    else if (tc === 0 && dr > 0) b.missingTc += 1;
    else if (Math.abs(tc - dr) <= tol) b.matched += 1;
    else if (tc > dr) b.tcHigh += 1;
    else b.drHigh += 1;
    buckets.set(empId, b);
  }

  const rows: EmployeeAccuracyRow[] = [];
  let cleanCount = 0;
  let okCount = 0;
  let coachingCount = 0;
  let noDataCount = 0;

  for (const e of inputs.employees) {
    if (e.status !== 'ACTIVE') continue;
    const b = buckets.get(e.id);
    const considered = b
      ? b.matched + b.tcHigh + b.drHigh + b.missingDr + b.missingTc
      : 0;
    const score = considered === 0 ? 0 : (b!.matched ?? 0) / considered;
    let tier: AccuracyTier;
    if (considered === 0) tier = 'NO_DATA';
    else if (score >= 0.95) tier = 'CLEAN';
    else if (score >= 0.8) tier = 'OK';
    else tier = 'NEEDS_COACHING';

    rows.push({
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`.trim(),
      matchedDays: b?.matched ?? 0,
      tcHigherDays: b?.tcHigh ?? 0,
      drHigherDays: b?.drHigh ?? 0,
      missingDrDays: b?.missingDr ?? 0,
      missingTcDays: b?.missingTc ?? 0,
      consideredDays: considered,
      accuracyScore: round4(score),
      tier,
    });
    if (tier === 'CLEAN') cleanCount += 1;
    else if (tier === 'OK') okCount += 1;
    else if (tier === 'NEEDS_COACHING') coachingCount += 1;
    else noDataCount += 1;
  }

  // Worst tier first within ACTIVE employees; lowest score first
  // within tier.
  const tierRank: Record<AccuracyTier, number> = {
    NEEDS_COACHING: 0,
    OK: 1,
    CLEAN: 2,
    NO_DATA: 3,
  };
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return tierRank[a.tier] - tierRank[b.tier];
    return a.accuracyScore - b.accuracyScore;
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      cleanCount,
      okCount,
      needsCoachingCount: coachingCount,
      noDataCount,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
