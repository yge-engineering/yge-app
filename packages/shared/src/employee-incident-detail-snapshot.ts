// Employee-anchored per-job incident detail snapshot.
//
// Plain English: for one employee (matched by employeeId, with
// employeeName fallback), return one row per job they had an OSHA
// 300-recordable incident on: total cases, classification breakouts,
// outcome breakouts, days-away total, days-restricted total, last
// incident date. Sorted by total cases desc.
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';

export interface EmployeeIncidentDetailRow {
  jobId: string;
  total: number;
  injury: number;
  illness: number;
  daysAway: number;
  daysRestricted: number;
  deaths: number;
  recordable: number;
  lastIncidentDate: string | null;
}

export interface EmployeeIncidentDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeIncidentDetailRow[];
}

export interface EmployeeIncidentDetailSnapshotInputs {
  employeeId: string;
  /** Optional name to match when the incident has no employeeId. */
  employeeName?: string;
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

export function buildEmployeeIncidentDetailSnapshot(
  inputs: EmployeeIncidentDetailSnapshotInputs,
): EmployeeIncidentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  type Acc = {
    total: number;
    injury: number;
    illness: number;
    daysAway: number;
    daysRestricted: number;
    deaths: number;
    recordable: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { total: 0, injury: 0, illness: 0, daysAway: 0, daysRestricted: 0, deaths: 0, recordable: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const inc of inputs.incidents) {
    const idMatch = inc.employeeId === inputs.employeeId;
    const nameMatch = targetName.length > 0 && norm(inc.employeeName) === targetName;
    if (!idMatch && !nameMatch) continue;
    if (!inc.jobId) continue;
    if (inc.incidentDate > asOf) continue;
    const a = getAcc(inc.jobId);
    a.total += 1;
    if (inc.classification === 'INJURY') a.injury += 1;
    else a.illness += 1;
    a.daysAway += inc.daysAway;
    a.daysRestricted += inc.daysRestricted;
    if (inc.outcome === 'DEATH') a.deaths += 1;
    if (inc.outcome === 'OTHER_RECORDABLE') a.recordable += 1;
    if (a.lastDate == null || inc.incidentDate > a.lastDate) a.lastDate = inc.incidentDate;
  }

  const rows: EmployeeIncidentDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      injury: a.injury,
      illness: a.illness,
      daysAway: a.daysAway,
      daysRestricted: a.daysRestricted,
      deaths: a.deaths,
      recordable: a.recordable,
      lastIncidentDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
