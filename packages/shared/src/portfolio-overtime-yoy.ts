// Portfolio overtime year-over-year.
//
// Plain English: collapse two years of timecard OT (daily >8,
// Saturday, Sunday) into a single comparison row with deltas.
// Sized for the prevailing-wage CPR audit and the labor-cost
// trend conversation.
//
// Different from portfolio-overtime-monthly (per month).
//
// Pure derivation. No persisted records.

import type { TimeCard, TimeEntry } from './time-card';
import { entryWorkedHours } from './time-card';

export interface PortfolioOvertimeYoyResult {
  priorYear: number;
  currentYear: number;
  priorDailyOtHours: number;
  priorSaturdayOtHours: number;
  priorSundayOtHours: number;
  priorTotalOtHours: number;
  currentDailyOtHours: number;
  currentSaturdayOtHours: number;
  currentSundayOtHours: number;
  currentTotalOtHours: number;
  totalOtDelta: number;
}

export interface PortfolioOvertimeYoyInputs {
  timecards: TimeCard[];
  currentYear: number;
}

export function buildPortfolioOvertimeYoy(
  inputs: PortfolioOvertimeYoyInputs,
): PortfolioOvertimeYoyResult {
  const priorYear = inputs.currentYear - 1;

  // Sum hours per (employeeId, date) — same logic as the monthly module.
  const dailyHours = new Map<string, number>();
  for (const tc of inputs.timecards) {
    for (const entry of (tc.entries ?? []) as TimeEntry[]) {
      const key = `${tc.employeeId}__${entry.date}`;
      dailyHours.set(key, (dailyHours.get(key) ?? 0) + entryWorkedHours(entry));
    }
  }

  let priorDaily = 0;
  let priorSat = 0;
  let priorSun = 0;
  let currentDaily = 0;
  let currentSat = 0;
  let currentSun = 0;

  for (const [key, hours] of dailyHours) {
    const date = key.split('__')[1] ?? '';
    const year = Number(date.slice(0, 4));
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    let dailyOt = Math.max(0, hours - 8);
    let saturdayOt = 0;
    let sundayOt = 0;
    if (dow === 6) {
      saturdayOt = hours;
      dailyOt = 0;
    } else if (dow === 0) {
      sundayOt = hours;
      dailyOt = 0;
    }

    if (year === priorYear) {
      priorDaily += dailyOt;
      priorSat += saturdayOt;
      priorSun += sundayOt;
    } else if (year === inputs.currentYear) {
      currentDaily += dailyOt;
      currentSat += saturdayOt;
      currentSun += sundayOt;
    }
  }

  const priorTotal = priorDaily + priorSat + priorSun;
  const currentTotal = currentDaily + currentSat + currentSun;

  const round = (n: number): number => Math.round(n * 100) / 100;

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorDailyOtHours: round(priorDaily),
    priorSaturdayOtHours: round(priorSat),
    priorSundayOtHours: round(priorSun),
    priorTotalOtHours: round(priorTotal),
    currentDailyOtHours: round(currentDaily),
    currentSaturdayOtHours: round(currentSat),
    currentSundayOtHours: round(currentSun),
    currentTotalOtHours: round(currentTotal),
    totalOtDelta: round(currentTotal - priorTotal),
  };
}
