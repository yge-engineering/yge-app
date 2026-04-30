// Customer-anchored employee footprint year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of employee touches on their jobs into a
// comparison: distinct employees per year + total hours, plus
// deltas.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface CustomerEmployeeYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctEmployees: number;
  priorTotalHours: number;
  currentDistinctEmployees: number;
  currentTotalHours: number;
  employeesDelta: number;
  hoursDelta: number;
}

export interface CustomerEmployeeYoyInputs {
  customerName: string;
  jobs: Job[];
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCustomerEmployeeYoy(inputs: CustomerEmployeeYoyInputs): CustomerEmployeeYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = { employees: Set<string>; hours: number };
  function emptyBucket(): Bucket {
    return { employees: new Set(), hours: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const c of inputs.timeCards) {
    let touched = false;
    let hoursThisCard = 0;
    let yearOfCard: number | null = null;
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      touched = true;
      const year = Number(e.date.slice(0, 4));
      yearOfCard = year;
      hoursThisCard += entryWorkedHours(e);
    }
    if (!touched || yearOfCard == null) continue;
    let b: Bucket | null = null;
    if (yearOfCard === priorYear) b = prior;
    else if (yearOfCard === inputs.currentYear) b = current;
    if (!b) continue;
    b.employees.add(c.employeeId);
    b.hours += hoursThisCard;
  }

  for (const r of inputs.dailyReports) {
    if (!customerJobs.has(r.jobId)) continue;
    const year = Number(r.date.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    if (r.foremanId) b.employees.add(r.foremanId);
    for (const row of r.crewOnSite ?? []) b.employees.add(row.employeeId);
  }
  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) b.employees.add(c.employeeId);
    }
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctEmployees: prior.employees.size,
    priorTotalHours: round2(prior.hours),
    currentDistinctEmployees: current.employees.size,
    currentTotalHours: round2(current.hours),
    employeesDelta: current.employees.size - prior.employees.size,
    hoursDelta: round2(current.hours - prior.hours),
  };
}
