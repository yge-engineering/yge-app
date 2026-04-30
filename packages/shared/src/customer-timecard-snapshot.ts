// Customer-anchored timecard snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, find timecards whose entries hit any of their
// jobs, sum hours-on-customer, daily/weekly OT contributed,
// distinct employees + jobs.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface CustomerTimecardSnapshotResult {
  asOf: string;
  customerName: string;
  cardsTouchingCustomer: number;
  hoursOnCustomer: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface CustomerTimecardSnapshotInputs {
  customerName: string;
  timeCards: TimeCard[];
  jobs: Job[];
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

export function buildCustomerTimecardSnapshot(
  inputs: CustomerTimecardSnapshotInputs,
): CustomerTimecardSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const employees = new Set<string>();
  const jobs = new Set<string>();
  let cardsTouchingCustomer = 0;
  let hoursOnCustomer = 0;
  let dailyOvertimeHours = 0;
  let weeklyOvertimeHours = 0;

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    let touched = false;
    let hoursForThisCard = 0;
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      touched = true;
      hoursForThisCard += entryWorkedHours(e);
      jobs.add(e.jobId);
    }
    if (!touched) continue;
    cardsTouchingCustomer += 1;
    hoursOnCustomer += hoursForThisCard;
    employees.add(c.employeeId);
    // OT is computed on the whole card; attribute proportional share.
    const cardTotal = totalCardHours(c);
    if (cardTotal > 0) {
      const ot = overtimeHoursThisWeek(c);
      const share = hoursForThisCard / cardTotal;
      dailyOvertimeHours += ot.dailyOvertimeHours * share;
      weeklyOvertimeHours += ot.weeklyOvertimeHours * share;
    }
  }

  return {
    asOf,
    customerName: inputs.customerName,
    cardsTouchingCustomer,
    hoursOnCustomer: round2(hoursOnCustomer),
    dailyOvertimeHours: round2(dailyOvertimeHours),
    weeklyOvertimeHours: round2(weeklyOvertimeHours),
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
  };
}
