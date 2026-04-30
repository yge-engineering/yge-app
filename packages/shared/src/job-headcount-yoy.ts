// Job-anchored headcount year-over-year.
//
// Plain English: for one job, collapse two years of employee
// appearances (timecards + daily reports + dispatches) into a
// comparison: distinct employees who showed up each year, plus
// delta.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

export interface JobHeadcountYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctEmployees: number;
  currentDistinctEmployees: number;
  countDelta: number;
}

export interface JobHeadcountYoyInputs {
  jobId: string;
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  currentYear: number;
}

export function buildJobHeadcountYoy(inputs: JobHeadcountYoyInputs): JobHeadcountYoyResult {
  const priorYear = inputs.currentYear - 1;
  const prior = new Set<string>();
  const current = new Set<string>();

  for (const c of inputs.timeCards) {
    for (const e of c.entries) {
      if (e.jobId !== inputs.jobId) continue;
      const year = Number(e.date.slice(0, 4));
      if (year === priorYear) prior.add(c.employeeId);
      else if (year === inputs.currentYear) current.add(c.employeeId);
    }
  }
  for (const r of inputs.dailyReports) {
    if (r.jobId !== inputs.jobId) continue;
    const year = Number(r.date.slice(0, 4));
    let target: Set<string> | null = null;
    if (year === priorYear) target = prior;
    else if (year === inputs.currentYear) target = current;
    if (!target) continue;
    if (r.foremanId) target.add(r.foremanId);
    for (const row of r.crewOnSite ?? []) target.add(row.employeeId);
  }
  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let target: Set<string> | null = null;
    if (year === priorYear) target = prior;
    else if (year === inputs.currentYear) target = current;
    if (!target) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) target.add(c.employeeId);
    }
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctEmployees: prior.size,
    currentDistinctEmployees: current.size,
    countDelta: current.size - prior.size,
  };
}
