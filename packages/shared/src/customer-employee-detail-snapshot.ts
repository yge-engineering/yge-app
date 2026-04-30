// Customer-anchored per-employee detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per employee who worked their jobs with hours
// + last-seen date. Sorted by hours descending.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours } from './time-card';

export interface CustomerEmployeeDetailRow {
  employeeId: string;
  hours: number;
  lastSeenDate: string | null;
}

export interface CustomerEmployeeDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerEmployeeDetailRow[];
}

export interface CustomerEmployeeDetailSnapshotInputs {
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

export function buildCustomerEmployeeDetailSnapshot(
  inputs: CustomerEmployeeDetailSnapshotInputs,
): CustomerEmployeeDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = { hours: number; lastDate: string | null };
  const byEmp = new Map<string, Acc>();
  function getAcc(empId: string): Acc {
    let a = byEmp.get(empId);
    if (!a) {
      a = { hours: 0, lastDate: null };
      byEmp.set(empId, a);
    }
    return a;
  }
  function bumpDate(a: Acc, dt: string): void {
    if (a.lastDate == null || dt > a.lastDate) a.lastDate = dt;
  }

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    let touched = false;
    let cardHours = 0;
    let lastEntryDate: string | null = null;
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      if (e.date > asOf) continue;
      touched = true;
      cardHours += entryWorkedHours(e);
      if (lastEntryDate == null || e.date > lastEntryDate) lastEntryDate = e.date;
    }
    if (!touched) continue;
    const a = getAcc(c.employeeId);
    a.hours += cardHours;
    if (lastEntryDate) bumpDate(a, lastEntryDate);
  }
  for (const r of inputs.dailyReports) {
    if (!customerJobs.has(r.jobId)) continue;
    if (r.date > asOf) continue;
    if (r.foremanId) bumpDate(getAcc(r.foremanId), r.date);
    for (const row of r.crewOnSite ?? []) bumpDate(getAcc(row.employeeId), r.date);
  }
  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    if (d.scheduledFor > asOf) continue;
    for (const c of d.crew ?? []) {
      if (c.employeeId) bumpDate(getAcc(c.employeeId), d.scheduledFor);
    }
  }

  const rows: CustomerEmployeeDetailRow[] = [...byEmp.entries()]
    .map(([employeeId, a]) => ({
      employeeId,
      hours: round2(a.hours),
      lastSeenDate: a.lastDate,
    }))
    .sort((a, b) => b.hours - a.hours || a.employeeId.localeCompare(b.employeeId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
