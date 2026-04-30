// Employee-anchored customer footprint year-over-year.
//
// Plain English: for one employee, collapse two years of
// customer touches (jobs.ownerAgency for jobs the employee
// worked) into a comparison: distinct customers per year, plus
// delta.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

export interface EmployeeCustomerYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctCustomers: number;
  currentDistinctCustomers: number;
  customersDelta: number;
}

export interface EmployeeCustomerYoyInputs {
  employeeId: string;
  employeeName?: string;
  jobs: Job[];
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeeCustomerYoy(inputs: EmployeeCustomerYoyInputs): EmployeeCustomerYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.employeeName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, norm(j.ownerAgency));
  }

  const priorJobs = new Set<string>();
  const currentJobs = new Set<string>();

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    for (const e of c.entries) {
      const year = Number(e.date.slice(0, 4));
      if (year === priorYear) priorJobs.add(e.jobId);
      else if (year === inputs.currentYear) currentJobs.add(e.jobId);
    }
  }
  for (const r of inputs.dailyReports) {
    let appeared = r.foremanId === inputs.employeeId;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) appeared = true;
    }
    if (!appeared) continue;
    const year = Number(r.date.slice(0, 4));
    if (year === priorYear) priorJobs.add(r.jobId);
    else if (year === inputs.currentYear) currentJobs.add(r.jobId);
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
    if (year === priorYear) priorJobs.add(d.jobId);
    else if (year === inputs.currentYear) currentJobs.add(d.jobId);
  }

  const priorCustomers = new Set<string>();
  for (const jid of priorJobs) {
    const owner = jobOwner.get(jid);
    if (owner) priorCustomers.add(owner);
  }
  const currentCustomers = new Set<string>();
  for (const jid of currentJobs) {
    const owner = jobOwner.get(jid);
    if (owner) currentCustomers.add(owner);
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctCustomers: priorCustomers.size,
    currentDistinctCustomers: currentCustomers.size,
    customersDelta: currentCustomers.size - priorCustomers.size,
  };
}
