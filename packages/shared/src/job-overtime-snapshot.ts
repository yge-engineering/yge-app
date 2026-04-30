// Job-anchored overtime snapshot.
//
// Plain English: for one job, as-of today, sum daily/weekly
// OT hours from cards that touch the job. Proportionally
// splits OT to the job based on card-hour share.
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';

import { entryWorkedHours, overtimeHoursThisWeek, totalCardHours } from './time-card';

export interface JobOvertimeSnapshotResult {
  asOf: string;
  jobId: string;
  cardsTouchingJob: number;
  hoursOnJob: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  cardsWithOvertime: number;
}

export interface JobOvertimeSnapshotInputs {
  jobId: string;
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

export function buildJobOvertimeSnapshot(
  inputs: JobOvertimeSnapshotInputs,
): JobOvertimeSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  let cardsTouchingJob = 0;
  let hoursOnJob = 0;
  let dailyOvertimeHours = 0;
  let weeklyOvertimeHours = 0;
  let cardsWithOvertime = 0;

  for (const c of inputs.timeCards) {
    if (c.weekStarting > asOf) continue;
    let touched = false;
    let hoursForThisCard = 0;
    for (const e of c.entries) {
      if (e.jobId !== inputs.jobId) continue;
      touched = true;
      hoursForThisCard += entryWorkedHours(e);
    }
    if (!touched) continue;
    cardsTouchingJob += 1;
    hoursOnJob += hoursForThisCard;
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
    jobId: inputs.jobId,
    cardsTouchingJob,
    hoursOnJob: round2(hoursOnJob),
    dailyOvertimeHours: round2(dailyOvertimeHours),
    weeklyOvertimeHours: round2(weeklyOvertimeHours),
    cardsWithOvertime,
  };
}
