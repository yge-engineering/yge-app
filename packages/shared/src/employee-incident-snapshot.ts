// Employee-anchored incident snapshot.
//
// Plain English: for one employee, as-of today, count
// incidents naming them, classification + outcome mix, days
// away + restricted, distinct jobs, last incident date.
//
// Pure derivation. No persisted records.

import type { Incident, IncidentClassification, IncidentOutcome } from './incident';

export interface EmployeeIncidentSnapshotResult {
  asOf: string;
  employeeId: string;
  totalIncidents: number;
  ytdIncidents: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  byOutcome: Partial<Record<IncidentOutcome, number>>;
  totalDaysAway: number;
  totalDaysRestricted: number;
  distinctJobs: number;
  lastIncidentDate: string | null;
}

export interface EmployeeIncidentSnapshotInputs {
  employeeId: string;
  incidents: Incident[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildEmployeeIncidentSnapshot(
  inputs: EmployeeIncidentSnapshotInputs,
): EmployeeIncidentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byClassification = new Map<IncidentClassification, number>();
  const byOutcome = new Map<IncidentOutcome, number>();
  const jobs = new Set<string>();
  let totalIncidents = 0;
  let ytdIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  let lastIncidentDate: string | null = null;

  for (const inc of inputs.incidents) {
    if (inc.employeeId !== inputs.employeeId) continue;
    if (inc.incidentDate > asOf) continue;
    totalIncidents += 1;
    if (Number(inc.incidentDate.slice(0, 4)) === logYear) ytdIncidents += 1;
    byClassification.set(inc.classification, (byClassification.get(inc.classification) ?? 0) + 1);
    byOutcome.set(inc.outcome, (byOutcome.get(inc.outcome) ?? 0) + 1);
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
    if (inc.jobId) jobs.add(inc.jobId);
    if (lastIncidentDate == null || inc.incidentDate > lastIncidentDate) lastIncidentDate = inc.incidentDate;
  }

  const cOut: Partial<Record<IncidentClassification, number>> = {};
  for (const [k, v] of byClassification) cOut[k] = v;
  const oOut: Partial<Record<IncidentOutcome, number>> = {};
  for (const [k, v] of byOutcome) oOut[k] = v;

  return {
    asOf,
    employeeId: inputs.employeeId,
    totalIncidents,
    ytdIncidents,
    byClassification: cOut,
    byOutcome: oOut,
    totalDaysAway,
    totalDaysRestricted,
    distinctJobs: jobs.size,
    lastIncidentDate,
  };
}
