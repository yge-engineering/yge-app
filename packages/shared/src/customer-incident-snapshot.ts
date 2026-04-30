// Customer-anchored incident snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count incidents on their jobs, classification +
// outcome mix, days lost, distinct employees affected. Drives
// the right-now per-customer safety overview.
//
// Pure derivation. No persisted records.

import type { Incident, IncidentClassification, IncidentOutcome } from './incident';
import type { Job } from './job';

export interface CustomerIncidentSnapshotResult {
  asOf: string;
  customerName: string;
  totalIncidents: number;
  ytdIncidents: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  byOutcome: Partial<Record<IncidentOutcome, number>>;
  totalDaysAway: number;
  totalDaysRestricted: number;
  distinctEmployees: number;
  distinctJobs: number;
  lastIncidentDate: string | null;
}

export interface CustomerIncidentSnapshotInputs {
  customerName: string;
  incidents: Incident[];
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerIncidentSnapshot(
  inputs: CustomerIncidentSnapshotInputs,
): CustomerIncidentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = norm(inputs.customerName);

  const jobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIds.add(j.id);
  }

  const byClassification = new Map<IncidentClassification, number>();
  const byOutcome = new Map<IncidentOutcome, number>();
  const employees = new Set<string>();
  const jobs = new Set<string>();

  let totalIncidents = 0;
  let ytdIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  let lastIncidentDate: string | null = null;

  for (const inc of inputs.incidents) {
    if (!inc.jobId || !jobIds.has(inc.jobId)) continue;
    if (inc.incidentDate > asOf) continue;
    totalIncidents += 1;
    if (Number(inc.incidentDate.slice(0, 4)) === logYear) ytdIncidents += 1;
    byClassification.set(inc.classification, (byClassification.get(inc.classification) ?? 0) + 1);
    byOutcome.set(inc.outcome, (byOutcome.get(inc.outcome) ?? 0) + 1);
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
    if (inc.employeeId) employees.add(inc.employeeId);
    jobs.add(inc.jobId);
    if (lastIncidentDate == null || inc.incidentDate > lastIncidentDate) lastIncidentDate = inc.incidentDate;
  }

  const cOut: Partial<Record<IncidentClassification, number>> = {};
  for (const [k, v] of byClassification) cOut[k] = v;
  const oOut: Partial<Record<IncidentOutcome, number>> = {};
  for (const [k, v] of byOutcome) oOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalIncidents,
    ytdIncidents,
    byClassification: cOut,
    byOutcome: oOut,
    totalDaysAway,
    totalDaysRestricted,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
    lastIncidentDate,
  };
}
