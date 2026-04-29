// Incidents per (job, month).
//
// Plain English: bucket OSHA log entries by jobId × yyyy-mm of
// incidentDate. Long-format. Useful for the per-job safety
// trend.
//
// Per row: jobId, month, total, recordableCount (DEATH +
// DAYS_AWAY + JOB_TRANSFER + OTHER_RECORDABLE all count),
// daysAwaySum, daysRestrictedSum, distinctEmployees.
//
// Sort: jobId asc, month asc.
//
// Different from incident-monthly-trend (portfolio, no job
// axis), incident-by-classification (per classification),
// job-incident-summary (per-job rollup, no month axis).
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';

export interface IncidentMonthlyByJobRow {
  jobId: string;
  month: string;
  total: number;
  recordableCount: number;
  daysAwaySum: number;
  daysRestrictedSum: number;
  distinctEmployees: number;
}

export interface IncidentMonthlyByJobRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalIncidents: number;
  unattributed: number;
}

export interface IncidentMonthlyByJobInputs {
  incidents: Incident[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildIncidentMonthlyByJob(
  inputs: IncidentMonthlyByJobInputs,
): {
  rollup: IncidentMonthlyByJobRollup;
  rows: IncidentMonthlyByJobRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    recordable: number;
    daysAway: number;
    daysRestricted: number;
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
      recordable: 0,
      daysAway: 0,
      daysRestricted: 0,
      employees: new Set<string>(),
    };
    acc.total += 1;
    acc.recordable += 1; // every Incident on file is a recordable case
    acc.daysAway += inc.daysAway;
    acc.daysRestricted += inc.daysRestricted;
    if (inc.employeeId) acc.employees.add(inc.employeeId);
    else if (inc.employeeName) acc.employees.add(`name:${inc.employeeName.toLowerCase()}`);
    accs.set(key, acc);
    jobSet.add(jobId);
    monthSet.add(month);
  }

  const rows: IncidentMonthlyByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      recordableCount: acc.recordable,
      daysAwaySum: acc.daysAway,
      daysRestrictedSum: acc.daysRestricted,
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
