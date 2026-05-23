// Weekly overtime projector.
//
// Plain English: at any point mid-week, walk each open time card +
// the daily reports already submitted, project the rest of the week
// at the foreman's planned crew size, and flag employees who will
// blow through 40 straight-time hours (or 8 daily) by Friday. The
// PM sees this on the dashboard + can re-balance the crew or send
// someone home early before the wage bill grows.
//
// Pure derivation. No DB, no clock dependency — caller passes the
// as-of date.

import { entryWorkedMinutes, type TimeCard } from './time-card';

export type OvertimeProjectionFlag =
  | 'ALREADY_OVER_WEEKLY' // weekly straight already over 40
  | 'WILL_HIT_WEEKLY'     // projected to exceed 40 by week end
  | 'DAILY_OT_TODAY'      // a single day already exceeded 8 h
  | 'DOUBLE_TIME_TODAY'   // a single day already exceeded 12 h
  | 'ON_TRACK';

export interface OvertimeProjectionRow {
  employeeId: string;
  weekStarting: string; // yyyy-mm-dd, Monday
  /** Hours actually worked through and including `asOfDate`. */
  hoursWorkedSoFar: number;
  /** Highest single-day hours observed so far in the week. */
  longestDayHours: number;
  /** Hours still expected this week given dailyHoursForecast × remaining workdays. */
  projectedHoursThisWeek: number;
  flag: OvertimeProjectionFlag;
}

export interface ProjectOvertimeInput {
  timeCards: TimeCard[];
  /** Mon yyyy-mm-dd. */
  weekStarting: string;
  /** Today, yyyy-mm-dd. Must fall within weekStarting..weekStarting+6. */
  asOfDate: string;
  /** Planned hours per remaining workday (default 8 — standard shift). */
  dailyHoursForecast?: number;
}

const WEEKLY_STRAIGHT_CAP = 40;
const DAILY_OT_THRESHOLD = 8;
const DAILY_DT_THRESHOLD = 12;

export function projectOvertime(input: ProjectOvertimeInput): OvertimeProjectionRow[] {
  const forecast = input.dailyHoursForecast ?? 8;
  const asOfDow = dayOfWeekFromMonday(input.asOfDate);
  // Workdays are Mon..Fri = 0..4. Remaining workdays AFTER today:
  const remainingWorkdays = Math.max(0, 4 - asOfDow);

  const byEmp = new Map<string, OvertimeProjectionRow>();
  for (const card of input.timeCards) {
    if (card.weekStarting !== input.weekStarting) continue;

    const dailyTotals = new Map<string, number>();
    for (const entry of card.entries) {
      if (entry.date > input.asOfDate) continue; // ignore future-dated entries
      const hours = entryWorkedMinutes(entry) / 60;
      dailyTotals.set(entry.date, (dailyTotals.get(entry.date) ?? 0) + hours);
    }
    const hoursSoFar = Array.from(dailyTotals.values()).reduce((s, n) => s + n, 0);
    const longestDay = Array.from(dailyTotals.values()).reduce(
      (max, n) => (n > max ? n : max),
      0,
    );
    const projected = round2(hoursSoFar + remainingWorkdays * forecast);

    const flag: OvertimeProjectionFlag =
      longestDay > DAILY_DT_THRESHOLD
        ? 'DOUBLE_TIME_TODAY'
        : longestDay > DAILY_OT_THRESHOLD
          ? 'DAILY_OT_TODAY'
          : hoursSoFar > WEEKLY_STRAIGHT_CAP
            ? 'ALREADY_OVER_WEEKLY'
            : projected > WEEKLY_STRAIGHT_CAP
              ? 'WILL_HIT_WEEKLY'
              : 'ON_TRACK';

    byEmp.set(card.employeeId, {
      employeeId: card.employeeId,
      weekStarting: card.weekStarting,
      hoursWorkedSoFar: round2(hoursSoFar),
      longestDayHours: round2(longestDay),
      projectedHoursThisWeek: projected,
      flag,
    });
  }

  return Array.from(byEmp.values()).sort((a, b) =>
    a.employeeId.localeCompare(b.employeeId),
  );
}

/** Just the rows that need attention — anything not ON_TRACK. */
export function attentionRows(rows: OvertimeProjectionRow[]): OvertimeProjectionRow[] {
  return rows.filter((r) => r.flag !== 'ON_TRACK');
}

function dayOfWeekFromMonday(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay();
  return (dow + 6) % 7; // Mon = 0, Sun = 6
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
