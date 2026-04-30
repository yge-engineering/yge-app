// Customer-anchored per-job incident detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: incident count, total days lost,
// distinct employees affected, last incident date. Sorted by
// count descending.
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';
import type { Job } from './job';

export interface CustomerIncidentDetailRow {
  jobId: string;
  incidents: number;
  totalDaysLost: number;
  distinctEmployees: number;
  lastIncidentDate: string | null;
}

export interface CustomerIncidentDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerIncidentDetailRow[];
}

export interface CustomerIncidentDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  incidents: Incident[];
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

export function buildCustomerIncidentDetailSnapshot(
  inputs: CustomerIncidentDetailSnapshotInputs,
): CustomerIncidentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    incidents: number;
    daysLost: number;
    employees: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { incidents: 0, daysLost: 0, employees: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inc of inputs.incidents) {
    if (!inc.jobId || !customerJobs.has(inc.jobId)) continue;
    if (inc.incidentDate > asOf) continue;
    const a = getAcc(inc.jobId);
    a.incidents += 1;
    a.daysLost += (inc.daysAway ?? 0) + (inc.daysRestricted ?? 0);
    if (inc.employeeId) a.employees.add(inc.employeeId);
    if (a.lastDate == null || inc.incidentDate > a.lastDate) a.lastDate = inc.incidentDate;
  }

  const rows: CustomerIncidentDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      incidents: a.incidents,
      totalDaysLost: a.daysLost,
      distinctEmployees: a.employees.size,
      lastIncidentDate: a.lastDate,
    }))
    .sort((a, b) => b.incidents - a.incidents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
