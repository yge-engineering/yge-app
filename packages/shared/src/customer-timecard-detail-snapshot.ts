// Customer-anchored per-job timecard detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: hours-on-job, distinct employees,
// proportional daily/weekly OT contributed. Sorted by hours
// desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface CustomerTimecardDetailRow {
  jobId: string;
  hours: number;
  distinctEmployees: number;
  dailyOt: number;
  weeklyOt: number;
}

export interface CustomerTimecardDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerTimecardDetailRow[];
}

export interface CustomerTimecardDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  timeCards: TimeCard[];
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

export function buildCustomerTimecardDetailSnapshot(
  inputs: CustomerTimecardDetailSnapshotInputs,
): CustomerTimecardDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    hours: number;
    employees: Set<string>;
    dailyOt: number;
    weeklyOt: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { hours: 0, employees: new Set(), dailyOt: 0, weeklyOt: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    const cardTotal = totalCardHours(c);
    const ot = cardTotal > 0 ? overtimeHoursThisWeek(c) : { dailyOvertimeHours: 0, weeklyOvertimeHours: 0 };
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      if (e.date > asOf) continue;
      const hrs = entryWorkedHours(e);
      const a = getAcc(e.jobId);
      a.hours += hrs;
      a.employees.add(c.employeeId);
      if (cardTotal > 0) {
        const share = hrs / cardTotal;
        a.dailyOt += ot.dailyOvertimeHours * share;
        a.weeklyOt += ot.weeklyOvertimeHours * share;
      }
    }
  }

  const rows: CustomerTimecardDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      hours: round2(a.hours),
      distinctEmployees: a.employees.size,
      dailyOt: round2(a.dailyOt),
      weeklyOt: round2(a.weeklyOt),
    }))
    .sort((a, b) => b.hours - a.hours || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
