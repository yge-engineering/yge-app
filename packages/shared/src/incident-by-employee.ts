// Per-employee incident rollup.
//
// Plain English: bucket incidents by employee. Counts incidents,
// breaks down by IncidentClassification, sums daysAway +
// daysRestricted, tracks last incidentDate. Surfaces individual
// safety records — the OSHA inspector will ask "show me this
// worker's history" if there's a pattern, and pre-built per-
// employee history beats searching the log.
//
// Per row: employeeId (or name-fallback key), employeeName,
// total, byClassification, totalDaysAway, totalDaysRestricted,
// lastIncidentDate, distinctJobs.
//
// Sort: total desc.
//
// Different from incident-by-classification (per-classification,
// portfolio), incident-by-job-monthly / incident-monthly-by-job
// (per-job axis), incident-frequency (rate calc), incident-by-
// outcome-monthly (per-month per-outcome).
//
// Pure derivation. No persisted records.

import type { Incident, IncidentClassification } from './incident';

export interface IncidentByEmployeeRow {
  employeeKey: string;
  employeeName: string;
  total: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  totalDaysAway: number;
  totalDaysRestricted: number;
  lastIncidentDate: string | null;
  distinctJobs: number;
}

export interface IncidentByEmployeeRollup {
  employeesConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
}

export interface IncidentByEmployeeInputs {
  incidents: Incident[];
  /** Optional yyyy-mm-dd window applied to incidentDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildIncidentByEmployee(
  inputs: IncidentByEmployeeInputs,
): {
  rollup: IncidentByEmployeeRollup;
  rows: IncidentByEmployeeRow[];
} {
  type Acc = {
    employeeKey: string;
    employeeName: string;
    total: number;
    byClassification: Map<IncidentClassification, number>;
    totalDaysAway: number;
    totalDaysRestricted: number;
    lastIncidentDate: string | null;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  let totalIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;

  const fromD = inputs.fromDate;
  const toD = inputs.toDate;

  for (const inc of inputs.incidents) {
    if (fromD && inc.incidentDate < fromD) continue;
    if (toD && inc.incidentDate > toD) continue;

    const empKey = inc.employeeId ?? `name:${inc.employeeName.toLowerCase().trim()}`;
    let a = accs.get(empKey);
    if (!a) {
      a = {
        employeeKey: empKey,
        employeeName: inc.employeeName,
        total: 0,
        byClassification: new Map(),
        totalDaysAway: 0,
        totalDaysRestricted: 0,
        lastIncidentDate: null,
        jobs: new Set(),
      };
      accs.set(empKey, a);
    }
    a.total += 1;
    a.byClassification.set(
      inc.classification,
      (a.byClassification.get(inc.classification) ?? 0) + 1,
    );
    a.totalDaysAway += inc.daysAway ?? 0;
    a.totalDaysRestricted += inc.daysRestricted ?? 0;
    if (a.lastIncidentDate === null || inc.incidentDate > a.lastIncidentDate) {
      a.lastIncidentDate = inc.incidentDate;
    }
    if (inc.jobId) a.jobs.add(inc.jobId);

    totalIncidents += 1;
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
  }

  const rows: IncidentByEmployeeRow[] = [...accs.values()]
    .map((a) => {
      const byClassification: Partial<Record<IncidentClassification, number>> = {};
      for (const [k, v] of a.byClassification) byClassification[k] = v;
      return {
        employeeKey: a.employeeKey,
        employeeName: a.employeeName,
        total: a.total,
        byClassification,
        totalDaysAway: a.totalDaysAway,
        totalDaysRestricted: a.totalDaysRestricted,
        lastIncidentDate: a.lastIncidentDate,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => {
      if (y.total !== x.total) return y.total - x.total;
      return x.employeeName.localeCompare(y.employeeName);
    });

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalIncidents,
      totalDaysAway,
      totalDaysRestricted,
    },
    rows,
  };
}
