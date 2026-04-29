// Per-job incident summary by month.
//
// Plain English: per (job, yyyy-mm of incidentDate) — count,
// recordable mix (DEATH / DAYS_AWAY / JOB_TRANSFER /
// OTHER_RECORDABLE), days away, distinct employees affected.
// The per-job safety trend.
//
// Per row: jobId, month, total, daysAwayCount, jobTransferCount,
// otherRecordableCount, deathCount, totalDaysAway,
// distinctEmployees.
//
// Sort: jobId asc, month asc.
//
// Different from job-incident-summary (per-job rollup, no month
// axis), incident-monthly-by-job (basic counts, this includes
// outcome split).
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';

export interface JobIncidentMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  daysAwayCount: number;
  jobTransferCount: number;
  otherRecordableCount: number;
  deathCount: number;
  totalDaysAway: number;
  distinctEmployees: number;
}

export interface JobIncidentMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalIncidents: number;
  unattributed: number;
}

export interface JobIncidentMonthlyInputs {
  incidents: Incident[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobIncidentMonthly(
  inputs: JobIncidentMonthlyInputs,
): {
  rollup: JobIncidentMonthlyRollup;
  rows: JobIncidentMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    daysAway: number;
    transfer: number;
    other: number;
    death: number;
    daysAwaySum: number;
    employees: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalIncidents = 0;
  let unattributed = 0;

  for (const inc of inputs.incidents) {
    const month = inc.incidentDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    totalIncidents += 1;
    const jobId = (inc.jobId ?? '').trim();
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const key = `${jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId,
      month,
      total: 0,
      daysAway: 0,
      transfer: 0,
      other: 0,
      death: 0,
      daysAwaySum: 0,
      employees: new Set<string>(),
    };
    acc.total += 1;
    if (inc.outcome === 'DAYS_AWAY') acc.daysAway += 1;
    else if (inc.outcome === 'JOB_TRANSFER_OR_RESTRICTION') acc.transfer += 1;
    else if (inc.outcome === 'OTHER_RECORDABLE') acc.other += 1;
    else if (inc.outcome === 'DEATH') acc.death += 1;
    acc.daysAwaySum += inc.daysAway;
    if (inc.employeeId) acc.employees.add(inc.employeeId);
    else if (inc.employeeName) acc.employees.add(`name:${inc.employeeName.toLowerCase()}`);
    accs.set(key, acc);
    jobSet.add(jobId);
    monthSet.add(month);
  }

  const rows: JobIncidentMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      daysAwayCount: acc.daysAway,
      jobTransferCount: acc.transfer,
      otherRecordableCount: acc.other,
      deathCount: acc.death,
      totalDaysAway: acc.daysAwaySum,
      distinctEmployees: acc.employees.size,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalIncidents,
      unattributed,
    },
    rows,
  };
}
