// Employee-anchored per-job timecard detail snapshot.
//
// Plain English: for one employee, return one row per job they
// worked on: hours-on-job, distinct dates worked, proportional
// daily/weekly OT contributed. Sorted by hours desc.
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';

import { entryWorkedHours, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface EmployeeTimecardDetailRow {
  jobId: string;
  hours: number;
  daysWorked: number;
  dailyOt: number;
  weeklyOt: number;
}

export interface EmployeeTimecardDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeTimecardDetailRow[];
}

export interface EmployeeTimecardDetailSnapshotInputs {
  employeeId: string;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildEmployeeTimecardDetailSnapshot(
  inputs: EmployeeTimecardDetailSnapshotInputs,
): EmployeeTimecardDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    hours: number;
    days: Set<string>;
    dailyOt: number;
    weeklyOt: number;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { hours: 0, days: new Set(), dailyOt: 0, weeklyOt: 0 };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const c of inputs.timeCards) {
    if (c.employeeId !== inputs.employeeId) continue;
    if (c.weekStarting > asOf) continue;
    const cardTotal = totalCardHours(c);
    const ot = cardTotal > 0 ? overtimeHoursThisWeek(c) : { dailyOvertimeHours: 0, weeklyOvertimeHours: 0 };
    for (const e of c.entries) {
      if (e.date > asOf) continue;
      const hrs = entryWorkedHours(e);
      const a = getAcc(e.jobId);
      a.hours += hrs;
      a.days.add(e.date);
      if (cardTotal > 0) {
        const share = hrs / cardTotal;
        a.dailyOt += ot.dailyOvertimeHours * share;
        a.weeklyOt += ot.weeklyOvertimeHours * share;
      }
    }
  }

  const rows: EmployeeTimecardDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      hours: round2(a.hours),
      daysWorked: a.days.size,
      dailyOt: round2(a.dailyOt),
      weeklyOt: round2(a.weeklyOt),
    }))
    .sort((a, b) => b.hours - a.hours || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
