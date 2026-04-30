// Customer-anchored overtime snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, sum daily/weekly OT hours from cards that touch
// any of their jobs. Proportionally splits OT to the customer
// based on the share of card hours on customer-jobs.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { entryWorkedHours, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface CustomerOvertimeSnapshotResult {
  asOf: string;
  customerName: string;
  cardsTouchingCustomer: number;
  hoursOnCustomer: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  cardsWithOvertime: number;
}

export interface CustomerOvertimeSnapshotInputs {
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

export function buildCustomerOvertimeSnapshot(
  inputs: CustomerOvertimeSnapshotInputs,
): CustomerOvertimeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  let cardsTouchingCustomer = 0;
  let hoursOnCustomer = 0;
  let dailyOvertimeHours = 0;
  let weeklyOvertimeHours = 0;
  let cardsWithOvertime = 0;

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    let hoursForThisCard = 0;
    let touched = false;
    for (const e of c.entries) {
      if (!customerJobs.has(e.jobId)) continue;
      touched = true;
      hoursForThisCard += entryWorkedHours(e);
    }
    if (!touched) continue;
    cardsTouchingCustomer += 1;
    hoursOnCustomer += hoursForThisCard;
    const cardTotal = totalCardHours(c);
    if (cardTotal > 0) {
      const ot = overtimeHoursThisWeek(c);
      const share = hoursForThisCard / cardTotal;
      const dot = ot.dailyOvertimeHours * share;
      const wot = ot.weeklyOvertimeHours * share;
      dailyOvertimeHours += dot;
      weeklyOvertimeHours += wot;
      if (dot > 0 || wot > 0) cardsWithOvertime += 1;
    }
  }

  return {
    asOf,
    customerName: inputs.customerName,
    cardsTouchingCustomer,
    hoursOnCustomer: round2(hoursOnCustomer),
    dailyOvertimeHours: round2(dailyOvertimeHours),
    weeklyOvertimeHours: round2(weeklyOvertimeHours),
    cardsWithOvertime,
  };
}
