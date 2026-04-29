// Portfolio incident activity by month with classification mix.
//
// Plain English: per yyyy-mm of incidentDate, count incidents
// with classification + outcome breakdown, sum daysAway +
// daysRestricted, distinct employees + jobs. Drives the IIPP
// coordinator's monthly incident trend (the OSHA 300A precursor).
//
// Per row: month, total, byClassification, byOutcome,
// daysAway, daysRestricted, distinctEmployees, distinctJobs.
//
// Sort: month asc.
//
// Different from incident-monthly-trend (timing only),
// incident-by-classification (no time axis), incident-by-
// outcome-monthly (per outcome), customer-incident-monthly
// (per customer).
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface PortfolioIncidentMonthlyRow {
  month: string;
  total: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  byOutcome: Partial<Record<IncidentOutcome, number>>;
  daysAway: number;
  daysRestricted: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioIncidentMonthlyRollup {
  monthsConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
}

export interface PortfolioIncidentMonthlyInputs {
  incidents: Incident[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioIncidentMonthly(
  inputs: PortfolioIncidentMonthlyInputs,
): {
  rollup: PortfolioIncidentMonthlyRollup;
  rows: PortfolioIncidentMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    byClassification: Map<IncidentClassification, number>;
    byOutcome: Map<IncidentOutcome, number>;
    daysAway: number;
    daysRestricted: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inc of inputs.incidents) {
    const month = inc.incidentDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        byClassification: new Map(),
        byOutcome: new Map(),
        daysAway: 0,
        daysRestricted: 0,
        employees: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    a.byClassification.set(
      inc.classification,
      (a.byClassification.get(inc.classification) ?? 0) + 1,
    );
    a.byOutcome.set(inc.outcome, (a.byOutcome.get(inc.outcome) ?? 0) + 1);
    a.daysAway += inc.daysAway ?? 0;
    a.daysRestricted += inc.daysRestricted ?? 0;
    const empKey = inc.employeeId ?? `name:${inc.employeeName.toLowerCase()}`;
    a.employees.add(empKey);
    if (inc.jobId) a.jobs.add(inc.jobId);
    totalIncidents += 1;
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
  }

  const rows: PortfolioIncidentMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byClassification: Partial<Record<IncidentClassification, number>> = {};
      for (const [k, v] of a.byClassification) byClassification[k] = v;
      const byOutcome: Partial<Record<IncidentOutcome, number>> = {};
      for (const [k, v] of a.byOutcome) byOutcome[k] = v;
      return {
        month: a.month,
        total: a.total,
        byClassification,
        byOutcome,
        daysAway: a.daysAway,
        daysRestricted: a.daysRestricted,
        distinctEmployees: a.employees.size,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalIncidents,
      totalDaysAway,
      totalDaysRestricted,
    },
    rows,
  };
}
