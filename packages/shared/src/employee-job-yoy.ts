// Employee-anchored job footprint year-over-year.
//
// Plain English: for one employee, collapse two years of job
// appearances (timecards + daily reports + dispatches) into a
// comparison: distinct jobs per year, plus delta.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

export interface EmployeeJobYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctJobs: number;
  currentDistinctJobs: number;
  jobsDelta: number;
}

export interface EmployeeJobYoyInputs {
  employeeId: string;
  employeeName?: string;
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeeJobYoy(inputs: EmployeeJobYoyInputs): EmployeeJobYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.employeeName);
  const prior = new Set<string>();
  const current = new Set<string>();

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    for (const e of c.entries) {
      const year = Number(e.date.slice(0, 4));
      if (year === priorYear) prior.add(e.jobId);
      else if (year === inputs.currentYear) current.add(e.jobId);
    }
  }
  for (const r of inputs.dailyReports) {
    let appeared = r.foremanId === inputs.employeeId;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) appeared = true;
    }
    if (!appeared) continue;
    const year = Number(r.date.slice(0, 4));
    if (year === priorYear) prior.add(r.jobId);
    else if (year === inputs.currentYear) current.add(r.jobId);
  }
  for (const d of inputs.dispatches) {
    let appeared = norm(d.foremanName) === targetName;
    for (const c of d.crew ?? []) {
      const idMatch = c.employeeId === inputs.employeeId;
      const nameMatch = !c.employeeId && targetName && norm(c.name) === targetName;
      if (idMatch || nameMatch) appeared = true;
    }
    if (!appeared) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    if (year === priorYear) prior.add(d.jobId);
    else if (year === inputs.currentYear) current.add(d.jobId);
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctJobs: prior.size,
    currentDistinctJobs: current.size,
    jobsDelta: current.size - prior.size,
  };
}
