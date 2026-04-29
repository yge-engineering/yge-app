// Per (employee, job) overtime hours.
//
// Plain English: split each employee's daily + weekly OT across
// the jobs they worked. Drives the per-job labor cost rebill —
// OT premium follows the work to the job that consumed it.
//
// Approach: total daily/weekly OT for each card, then prorate to
// each job by that job's share of card hours. Daily OT = hours
// over 8 on each day; weekly OT = hours over 40 net of daily OT.
//
// Per row: employeeId, jobId, regularHours, dailyOvertimeHours,
// weeklyOvertimeHours, overtimeHoursTotal.
//
// Sort: employeeId asc, overtimeHoursTotal desc within employee.
//
// Different from overtime-by-classification (per DIR class),
// employee-overtime-monthly (per employee per month, no job
// axis), overtime-monthly (portfolio).
//
// Pure derivation. No persisted records.

import type { TimeCard } from './time-card';
import { entryWorkedMinutes, hoursByDate, totalCardHours } from './time-card';

export interface EmployeeOvertimeByJobRow {
  employeeId: string;
  jobId: string;
  regularHours: number;
  dailyOvertimeHours: number;
  weeklyOvertimeHours: number;
  overtimeHoursTotal: number;
}

export interface EmployeeOvertimeByJobRollup {
  employeesConsidered: number;
  jobsConsidered: number;
  overtimeHoursTotal: number;
}

export interface EmployeeOvertimeByJobInputs {
  timeCards: TimeCard[];
  /** Optional yyyy-mm-dd window applied to weekStarting. */
  fromWeek?: string;
  toWeek?: string;
}

export function buildEmployeeOvertimeByJob(
  inputs: EmployeeOvertimeByJobInputs,
): {
  rollup: EmployeeOvertimeByJobRollup;
  rows: EmployeeOvertimeByJobRow[];
} {
  type Acc = {
    employeeId: string;
    jobId: string;
    minutesReg: number;
    minutesDaily: number;
    minutesWeekly: number;
  };
  const accs = new Map<string, Acc>();
  const empSet = new Set<string>();
  const jobSet = new Set<string>();
  let portfolioOt = 0;

  for (const card of inputs.timeCards) {
    if (inputs.fromWeek && card.weekStarting < inputs.fromWeek) continue;
    if (inputs.toWeek && card.weekStarting > inputs.toWeek) continue;
    const totalH = totalCardHours(card);
    if (totalH === 0) continue;
    let dailyOt = 0;
    for (const { hours } of hoursByDate(card)) {
      if (hours > 8) dailyOt += hours - 8;
    }
    const weeklyOt = Math.max(0, totalH - 40 - dailyOt);
    const otTotal = dailyOt + weeklyOt;
    const regular = Math.max(0, totalH - otTotal);

    // Job share within the card by minutes.
    const minutesByJob = new Map<string, number>();
    let cardMinutes = 0;
    for (const e of card.entries) {
      const m = entryWorkedMinutes(e);
      if (m === 0) continue;
      minutesByJob.set(e.jobId, (minutesByJob.get(e.jobId) ?? 0) + m);
      cardMinutes += m;
    }
    if (cardMinutes === 0) continue;

    for (const [jobId, jobMinutes] of minutesByJob.entries()) {
      const share = jobMinutes / cardMinutes;
      const minutesReg = regular * 60 * share;
      const minutesDaily = dailyOt * 60 * share;
      const minutesWeekly = weeklyOt * 60 * share;
      const key = `${card.employeeId}|${jobId}`;
      const acc = accs.get(key) ?? {
        employeeId: card.employeeId,
        jobId,
        minutesReg: 0,
        minutesDaily: 0,
        minutesWeekly: 0,
      };
      acc.minutesReg += minutesReg;
      acc.minutesDaily += minutesDaily;
      acc.minutesWeekly += minutesWeekly;
      accs.set(key, acc);
      empSet.add(card.employeeId);
      jobSet.add(jobId);
      portfolioOt += (minutesDaily + minutesWeekly) / 60;
    }
  }

  const rows: EmployeeOvertimeByJobRow[] = [];
  for (const acc of accs.values()) {
    const reg = Math.round((acc.minutesReg / 60) * 100) / 100;
    const daily = Math.round((acc.minutesDaily / 60) * 100) / 100;
    const weekly = Math.round((acc.minutesWeekly / 60) * 100) / 100;
    rows.push({
      employeeId: acc.employeeId,
      jobId: acc.jobId,
      regularHours: reg,
      dailyOvertimeHours: daily,
      weeklyOvertimeHours: weekly,
      overtimeHoursTotal: Math.round((daily + weekly) * 100) / 100,
    });
  }

  rows.sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
    return b.overtimeHoursTotal - a.overtimeHoursTotal;
  });

  return {
    rollup: {
      employeesConsidered: empSet.size,
      jobsConsidered: jobSet.size,
      overtimeHoursTotal: Math.round(portfolioOt * 100) / 100,
    },
    rows,
  };
}
