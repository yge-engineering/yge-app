// Employee-anchored timecard year-over-year.
//
// Plain English: for one employee, collapse two years of
// timecards into a comparison: card count, total hours, daily
// + weekly OT, distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';

import { overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface EmployeeTimecardYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorCards: number;
  priorHours: number;
  priorDailyOt: number;
  priorWeeklyOt: number;
  priorDistinctJobs: number;
  currentCards: number;
  currentHours: number;
  currentDailyOt: number;
  currentWeeklyOt: number;
  currentDistinctJobs: number;
  hoursDelta: number;
}

export interface EmployeeTimecardYoyInputs {
  employeeId: string;
  timeCards: TimeCard[];
  currentYear: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildEmployeeTimecardYoy(
  inputs: EmployeeTimecardYoyInputs,
): EmployeeTimecardYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    cards: number;
    hours: number;
    dailyOt: number;
    weeklyOt: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { cards: 0, hours: 0, dailyOt: 0, weeklyOt: 0, jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    const year = Number(c.weekStarting.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.cards += 1;
    b.hours += totalCardHours(c);
    const ot = overtimeHoursThisWeek(c);
    b.dailyOt += ot.dailyOvertimeHours;
    b.weeklyOt += ot.weeklyOvertimeHours;
    for (const e of c.entries) b.jobs.add(e.jobId);
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorCards: prior.cards,
    priorHours: round2(prior.hours),
    priorDailyOt: round2(prior.dailyOt),
    priorWeeklyOt: round2(prior.weeklyOt),
    priorDistinctJobs: prior.jobs.size,
    currentCards: current.cards,
    currentHours: round2(current.hours),
    currentDailyOt: round2(current.dailyOt),
    currentWeeklyOt: round2(current.weeklyOt),
    currentDistinctJobs: current.jobs.size,
    hoursDelta: round2(current.hours - prior.hours),
  };
}
