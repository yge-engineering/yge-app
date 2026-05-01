// Job-anchored per-employee incident detail snapshot.
//
// Plain English: for one job, return one row per employee with an
// OSHA 300-recordable incident on that job: total cases, injury vs
// illness, days-away total, days-restricted total, deaths, last
// incident date. Sorted by total cases desc.
//
// Pure derivation. No persisted records.

import type { Incident } from './incident';

export interface JobIncidentDetailRow {
  employeeName: string;
  total: number;
  injury: number;
  illness: number;
  daysAway: number;
  daysRestricted: number;
  deaths: number;
  privacyCases: number;
  lastIncidentDate: string | null;
}

export interface JobIncidentDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobIncidentDetailRow[];
}

export interface JobIncidentDetailSnapshotInputs {
  jobId: string;
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

export function buildJobIncidentDetailSnapshot(
  inputs: JobIncidentDetailSnapshotInputs,
): JobIncidentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    injury: number;
    illness: number;
    daysAway: number;
    daysRestricted: number;
    deaths: number;
    privacy: number;
    lastDate: string | null;
  };
  const byEmployee = new Map<string, Acc>();
  function getAcc(name: string): Acc {
    let a = byEmployee.get(name);
    if (!a) {
      a = { total: 0, injury: 0, illness: 0, daysAway: 0, daysRestricted: 0, deaths: 0, privacy: 0, lastDate: null };
      byEmployee.set(name, a);
    }
    return a;
  }

  for (const inc of inputs.incidents) {
    if (inc.jobId !== inputs.jobId) continue;
    if (inc.incidentDate > asOf) continue;
    const name = inc.privacyCase ? '(Privacy Case)' : inc.employeeName;
    const a = getAcc(name);
    a.total += 1;
    if (inc.classification === 'INJURY') a.injury += 1;
    else a.illness += 1;
    a.daysAway += inc.daysAway;
    a.daysRestricted += inc.daysRestricted;
    if (inc.outcome === 'DEATH') a.deaths += 1;
    if (inc.privacyCase) a.privacy += 1;
    if (a.lastDate == null || inc.incidentDate > a.lastDate) a.lastDate = inc.incidentDate;
  }

  const rows: JobIncidentDetailRow[] = [...byEmployee.entries()]
    .map(([employeeName, a]) => ({
      employeeName,
      total: a.total,
      injury: a.injury,
      illness: a.illness,
      daysAway: a.daysAway,
      daysRestricted: a.daysRestricted,
      deaths: a.deaths,
      privacyCases: a.privacy,
      lastIncidentDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.employeeName.localeCompare(b.employeeName));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
