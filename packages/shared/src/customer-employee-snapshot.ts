// Customer-anchored employee footprint snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, surface which employees have worked on any of
// their jobs — derived from timecards + daily reports +
// dispatches. Counts distinct employees + jobs + total hours.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface CustomerEmployeeSnapshotResult {
  asOf: string;
  customerName: string;
  distinctEmployees: number;
  distinctJobs: number;
  totalHoursOnCustomer: number;
}

export interface CustomerEmployeeSnapshotInputs {
  customerName: string;
  jobs: Job[];
  timeCards: TimeCard[];
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCustomerEmployeeSnapshot(
  inputs: CustomerEmployeeSnapshotInputs,
): CustomerEmployeeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const employees = new Set<string>();
  const jobs = new Set<string>();
  let totalHours = 0;

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    let touched = false;
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      if (e.date > asOf) continue;
      touched = true;
      jobs.add(e.jobId);
      totalHours += entryWorkedHours(e);
    }
    if (touched) employees.add(c.employeeId);
  }
  for (const r of inputs.dailyReports) {
    if (!customerJobs.has(r.jobId)) continue;
    if (r.date > asOf) continue;
    if (r.foremanId) employees.add(r.foremanId);
    for (const row of r.crewOnSite ?? []) {
      employees.add(row.employeeId);
    }
    jobs.add(r.jobId);
  }
  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    if (d.scheduledFor > asOf) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) employees.add(c.employeeId);
      else if (c.name) employees.add(`name:${norm(c.name)}`);
    }
    jobs.add(d.jobId);
  }

  return {
    asOf,
    customerName: inputs.customerName,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
    totalHoursOnCustomer: round2(totalHours),
  };
}
