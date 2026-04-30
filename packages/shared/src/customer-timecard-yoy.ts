// Customer-anchored timecard year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of timecard activity into a comparison:
// hours-on-customer + proportional daily/weekly OT, distinct
// employees, deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface CustomerTimecardYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorHoursOnCustomer: number;
  priorDailyOt: number;
  priorWeeklyOt: number;
  priorDistinctEmployees: number;
  currentHoursOnCustomer: number;
  currentDailyOt: number;
  currentWeeklyOt: number;
  currentDistinctEmployees: number;
  hoursDelta: number;
  dailyOtDelta: number;
}

export interface CustomerTimecardYoyInputs {
  customerName: string;
  timeCards: TimeCard[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCustomerTimecardYoy(
  inputs: CustomerTimecardYoyInputs,
): CustomerTimecardYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    hours: number;
    dailyOt: number;
    weeklyOt: number;
    employees: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { hours: 0, dailyOt: 0, weeklyOt: 0, employees: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const c of inputs.timeCards) {
    const year = Number(c.weekStarting.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    let hoursForThisCard = 0;
    let touched = false;
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      touched = true;
      hoursForThisCard += entryWorkedHours(e);
    }
    if (!touched) continue;
    b.hours += hoursForThisCard;
    b.employees.add(c.employeeId);
    const cardTotal = totalCardHours(c);
    if (cardTotal > 0) {
      const ot = overtimeHoursThisWeek(c);
      const share = hoursForThisCard / cardTotal;
      b.dailyOt += ot.dailyOvertimeHours * share;
      b.weeklyOt += ot.weeklyOvertimeHours * share;
    }
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorHoursOnCustomer: round2(prior.hours),
    priorDailyOt: round2(prior.dailyOt),
    priorWeeklyOt: round2(prior.weeklyOt),
    priorDistinctEmployees: prior.employees.size,
    currentHoursOnCustomer: round2(current.hours),
    currentDailyOt: round2(current.dailyOt),
    currentWeeklyOt: round2(current.weeklyOt),
    currentDistinctEmployees: current.employees.size,
    hoursDelta: round2(current.hours - prior.hours),
    dailyOtDelta: round2(current.dailyOt - prior.dailyOt),
  };
}
