// Customer-anchored headcount year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of employee appearances on their jobs
// into a comparison: distinct employees per year, plus delta.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

export interface CustomerHeadcountYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctEmployees: number;
  currentDistinctEmployees: number;
  countDelta: number;
}

export interface CustomerHeadcountYoyInputs {
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

export function buildCustomerHeadcountYoy(inputs: CustomerHeadcountYoyInputs): CustomerHeadcountYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const prior = new Set<string>();
  const current = new Set<string>();

  for (const c of inputs.timeCards) {
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      const year = Number(e.date.slice(0, 4));
      if (year === priorYear) prior.add(c.employeeId);
      else if (year === inputs.currentYear) current.add(c.employeeId);
    }
  }
  for (const r of inputs.dailyReports) {
    if (!customerJobs.has(r.jobId)) continue;
    const year = Number(r.date.slice(0, 4));
    let target2: Set<string> | null = null;
    if (year === priorYear) target2 = prior;
    else if (year === inputs.currentYear) target2 = current;
    if (!target2) continue;
    if (r.foremanId) target2.add(r.foremanId);
    for (const row of r.crewOnSite ?? []) target2.add(row.employeeId);
  }
  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let target2: Set<string> | null = null;
    if (year === priorYear) target2 = prior;
    else if (year === inputs.currentYear) target2 = current;
    if (!target2) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) target2.add(c.employeeId);
    }
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctEmployees: prior.size,
    currentDistinctEmployees: current.size,
    countDelta: current.size - prior.size,
  };
}
