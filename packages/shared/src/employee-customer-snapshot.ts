// Employee-anchored customer footprint snapshot.
//
// Plain English: for one employee, as-of today, surface which
// YGE customers' jobs they've worked — derived from timecards
// + daily reports + dispatches joined to Job.ownerAgency.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

export interface EmployeeCustomerSnapshotResult {
  asOf: string;
  employeeId: string;
  distinctCustomers: number;
  distinctJobs: number;
  customers: string[];
}

export interface EmployeeCustomerSnapshotInputs {
  employeeId: string;
  /** Optional name fallback for crew rows / dispatch slots. */
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

export function buildEmployeeCustomerSnapshot(
  inputs: EmployeeCustomerSnapshotInputs,
): EmployeeCustomerSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, j.ownerAgency);
  }

  const employeeJobs = new Set<string>();

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    if (c.weekStarting > asOf) continue;
    for (const e of c.entries) {
      if (e.date > asOf) continue;
      employeeJobs.add(e.jobId);
    }
  }
  for (const r of inputs.dailyReports) {
    if (r.date > asOf) continue;
    let appeared = r.foremanId === inputs.employeeId;
    for (const row of r.crewOnSite ?? []) {
      if (row.employeeId === inputs.employeeId) appeared = true;
    }
    if (appeared) employeeJobs.add(r.jobId);
  }
  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = norm(d.foremanName) === targetName;
    for (const c of d.crew ?? []) {
      const idMatch = c.employeeId === inputs.employeeId;
      const nameMatch = !c.employeeId && targetName && norm(c.name) === targetName;
      if (idMatch || nameMatch) appeared = true;
    }
    if (appeared) employeeJobs.add(d.jobId);
  }

  const customers = new Set<string>();
  for (const jid of employeeJobs) {
    const owner = jobOwner.get(jid);
    if (owner) customers.add(owner);
  }

  return {
    asOf,
    employeeId: inputs.employeeId,
    distinctCustomers: customers.size,
    distinctJobs: employeeJobs.size,
    customers: [...customers].sort((a, b) => a.localeCompare(b)),
  };
}
