// Overtime exposure tracker.
//
// Plain English: an employee racking up 20 hours of OT a week for
// six weeks straight is a budget bleed AND a fatigue / safety risk.
// This rolls every time card across a date range into a per-employee
// summary: total regular, daily OT, weekly OT, and flags weeks
// where the worked total crossed a fatigue threshold.
//
// Pure derivation. No persisted records.

import { totalCardHours, overtimeHoursThisWeek, type TimeCard } from './time-card';

export type OvertimeFlag =
  | 'OK'
  | 'ELEVATED'      // worked > 50 hours in a week
  | 'HIGH'          // worked > 60 hours in a week
  | 'EXTREME';      // worked > 70 hours in a week

export interface OvertimeWeekRow {
  weekStarting: string;
  totalHours: number;
  dailyOtHours: number;
  weeklyOtHours: number;
  flag: OvertimeFlag;
}

export interface OvertimeEmployeeRow {
  employeeId: string;
  weeksReported: number;
  /** Sum of (totalHours - dailyOT - weeklyOT) across cards. */
  regularHours: number;
  dailyOtHours: number;
  weeklyOtHours: number;
  totalHours: number;
  totalOtHours: number;
  /** Proportion of hours that were OT. */
  otShare: number;
  /** Worst weekly flag observed in the period. */
  worstFlag: OvertimeFlag;
  /** Per-week breakdown for the employee. */
  weeks: OvertimeWeekRow[];
}

export interface OvertimeExposureReport {
  start: string;
  end: string;
  totalRegularHours: number;
  totalDailyOtHours: number;
  totalWeeklyOtHours: number;
  totalOtHours: number;
  /** Premium burden estimate at $1.5x — caller multiplies by base
   *  rate offline; this is just hours. */
  totalOvertimePremiumHours: number;
  byEmployee: OvertimeEmployeeRow[];
}

export interface OvertimeExposureInputs {
  /** ISO yyyy-mm-dd inclusive. Filters by card.weekStarting. */
  start: string;
  end: string;
  timeCards: TimeCard[];
}

export function buildOvertimeExposure(
  inputs: OvertimeExposureInputs,
): OvertimeExposureReport {
  const { start, end, timeCards } = inputs;

  const inWindow = timeCards.filter(
    (c) =>
      (c.status === 'APPROVED' || c.status === 'POSTED' || c.status === 'SUBMITTED') &&
      c.weekStarting >= start &&
      c.weekStarting <= end,
  );

  type Bucket = {
    employeeId: string;
    regular: number;
    dailyOt: number;
    weeklyOt: number;
    total: number;
    weeks: OvertimeWeekRow[];
  };
  const byEmployee = new Map<string, Bucket>();

  let totalRegular = 0;
  let totalDailyOt = 0;
  let totalWeeklyOt = 0;

  for (const card of inWindow) {
    const total = totalCardHours(card);
    const ot = overtimeHoursThisWeek(card);
    const otHours = ot.dailyOvertimeHours + ot.weeklyOvertimeHours;
    const regular = Math.max(0, total - otHours);

    const flag: OvertimeFlag =
      total > 70 ? 'EXTREME' : total > 60 ? 'HIGH' : total > 50 ? 'ELEVATED' : 'OK';

    const b =
      byEmployee.get(card.employeeId) ??
      ({
        employeeId: card.employeeId,
        regular: 0,
        dailyOt: 0,
        weeklyOt: 0,
        total: 0,
        weeks: [],
      } as Bucket);
    b.regular += regular;
    b.dailyOt += ot.dailyOvertimeHours;
    b.weeklyOt += ot.weeklyOvertimeHours;
    b.total += total;
    b.weeks.push({
      weekStarting: card.weekStarting,
      totalHours: round2(total),
      dailyOtHours: round2(ot.dailyOvertimeHours),
      weeklyOtHours: round2(ot.weeklyOvertimeHours),
      flag,
    });
    byEmployee.set(card.employeeId, b);

    totalRegular += regular;
    totalDailyOt += ot.dailyOvertimeHours;
    totalWeeklyOt += ot.weeklyOvertimeHours;
  }

  const flagRank: Record<OvertimeFlag, number> = {
    EXTREME: 3,
    HIGH: 2,
    ELEVATED: 1,
    OK: 0,
  };

  const rows: OvertimeEmployeeRow[] = [];
  for (const [, b] of byEmployee) {
    const totalOt = b.dailyOt + b.weeklyOt;
    let worstRank = 0;
    let worstFlag: OvertimeFlag = 'OK';
    for (const w of b.weeks) {
      if (flagRank[w.flag] > worstRank) {
        worstRank = flagRank[w.flag];
        worstFlag = w.flag;
      }
    }
    b.weeks.sort((a, b) => a.weekStarting.localeCompare(b.weekStarting));

    rows.push({
      employeeId: b.employeeId,
      weeksReported: b.weeks.length,
      regularHours: round2(b.regular),
      dailyOtHours: round2(b.dailyOt),
      weeklyOtHours: round2(b.weeklyOt),
      totalHours: round2(b.total),
      totalOtHours: round2(totalOt),
      otShare: b.total === 0 ? 0 : round4(totalOt / b.total),
      worstFlag,
      weeks: b.weeks,
    });
  }

  // Worst flag first; within tier, most OT hours first.
  rows.sort((a, b) => {
    if (a.worstFlag !== b.worstFlag) {
      return flagRank[b.worstFlag] - flagRank[a.worstFlag];
    }
    return b.totalOtHours - a.totalOtHours;
  });

  return {
    start,
    end,
    totalRegularHours: round2(totalRegular),
    totalDailyOtHours: round2(totalDailyOt),
    totalWeeklyOtHours: round2(totalWeeklyOt),
    totalOtHours: round2(totalDailyOt + totalWeeklyOt),
    totalOvertimePremiumHours: round2(0.5 * (totalDailyOt + totalWeeklyOt)),
    byEmployee: rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
