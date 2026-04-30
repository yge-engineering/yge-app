// Employee-anchored per-customer detail snapshot.
//
// Plain English: for one employee, return one row per customer
// (job-owner agency) they touched: hours-on-customer, distinct
// jobs, last seen date. Sorted by hours descending.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface EmployeeCustomerDetailRow {
  customerName: string;
  hours: number;
  distinctJobs: number;
  lastSeenDate: string | null;
}

export interface EmployeeCustomerDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeCustomerDetailRow[];
}

export interface EmployeeCustomerDetailSnapshotInputs {
  employeeId: string;
  employeeName?: string;
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

export function buildEmployeeCustomerDetailSnapshot(
  inputs: EmployeeCustomerDetailSnapshotInputs,
): EmployeeCustomerDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, j.ownerAgency);
  }

  type Acc = { hours: number; jobs: Set<string>; lastDate: string | null };
  const byCustomer = new Map<string, Acc>();
  function getAcc(name: string): Acc {
    let a = byCustomer.get(name);
    if (!a) {
      a = { hours: 0, jobs: new Set(), lastDate: null };
      byCustomer.set(name, a);
    }
    return a;
  }
  function bump(a: Acc, jobId: string, dt: string, hours = 0): void {
    a.hours += hours;
    a.jobs.add(jobId);
    if (a.lastDate == null || dt > a.lastDate) a.lastDate = dt;
  }

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    if (c.weekStarting > asOf) continue;
    for (const e of c.entries) {
      if (e.date > asOf) continue;
      const owner = jobOwner.get(e.jobId);
      if (!owner) continue;
      bump(getAcc(owner), e.jobId, e.date, entryWorkedHours(e));
    }
  }
  for (const r of inputs.dailyReports) {
    if (r.date > asOf) continue;
    let appeared = r.foremanId === inputs.employeeId;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) appeared = true;
    }
    if (!appeared) continue;
    const owner = jobOwner.get(r.jobId);
    if (!owner) continue;
    bump(getAcc(owner), r.jobId, r.date);
  }
  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = norm(d.foremanName) === targetName;
    for (const c of d.crew ?? []) {
      const idMatch = c.employeeId === inputs.employeeId;
      const nameMatch = !c.employeeId && targetName && norm(c.name) === targetName;
      if (idMatch || nameMatch) appeared = true;
    }
    if (!appeared) continue;
    const owner = jobOwner.get(d.jobId);
    if (!owner) continue;
    bump(getAcc(owner), d.jobId, d.scheduledFor);
  }

  const rows: EmployeeCustomerDetailRow[] = [...byCustomer.entries()]
    .map(([customerName, a]) => ({
      customerName,
      hours: round2(a.hours),
      distinctJobs: a.jobs.size,
      lastSeenDate: a.lastDate,
    }))
    .sort((a, b) => b.hours - a.hours || a.customerName.localeCompare(b.customerName));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
