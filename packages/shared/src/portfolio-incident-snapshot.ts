// Portfolio incident snapshot (point-in-time / log-year).
//
// Plain English: as-of today (or a specified log-year), count
// incidents with classification + outcome mix, sum days
// away/restricted, distinct employees + jobs, plus a YTD
// flag. Drives the right-now safety overview the IIPP
// coordinator scans daily.
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface PortfolioIncidentSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  ytdIncidents: number;
  totalIncidents: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  byOutcome: Partial<Record<IncidentOutcome, number>>;
  totalDaysAway: number;
  totalDaysRestricted: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioIncidentSnapshotInputs {
  incidents: Incident[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioIncidentSnapshot(
  inputs: PortfolioIncidentSnapshotInputs,
): PortfolioIncidentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byClassification = new Map<IncidentClassification, number>();
  const byOutcome = new Map<IncidentOutcome, number>();
  let ytdIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  const employees = new Set<string>();
  const jobs = new Set<string>();

  for (const inc of inputs.incidents) {
    if (inc.incidentDate > asOf) continue;
    byClassification.set(
      inc.classification,
      (byClassification.get(inc.classification) ?? 0) + 1,
    );
    byOutcome.set(inc.outcome, (byOutcome.get(inc.outcome) ?? 0) + 1);
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
    const empKey = inc.employeeId ?? `name:${inc.employeeName.toLowerCase()}`;
    employees.add(empKey);
    if (inc.jobId) jobs.add(inc.jobId);
    if (Number(inc.incidentDate.slice(0, 4)) === logYear) ytdIncidents += 1;
  }

  function classRecord(m: Map<IncidentClassification, number>): Partial<Record<IncidentClassification, number>> {
    const out: Partial<Record<IncidentClassification, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function outcomeRecord(m: Map<IncidentOutcome, number>): Partial<Record<IncidentOutcome, number>> {
    const out: Partial<Record<IncidentOutcome, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    asOf,
    ytdLogYear: logYear,
    ytdIncidents,
    totalIncidents: inputs.incidents.filter((i) => i.incidentDate <= asOf).length,
    byClassification: classRecord(byClassification),
    byOutcome: outcomeRecord(byOutcome),
    totalDaysAway,
    totalDaysRestricted,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
  };
}
