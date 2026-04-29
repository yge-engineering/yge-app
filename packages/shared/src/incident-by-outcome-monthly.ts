// Per (month, OSHA outcome) incident rollup.
//
// Plain English: bucket incidents by yyyy-mm of incidentDate
// and IncidentOutcome (DEATH / DAYS_AWAY / JOB_TRANSFER_OR_
// RESTRICTION / OTHER_RECORDABLE). Plus the OSHA 300A counts
// the bookkeeper needs at year-end: total daysAway + total
// daysRestricted, distinct employees affected.
//
// Per row: month, outcome, total, totalDaysAway,
// totalDaysRestricted, distinctEmployees, distinctJobs.
//
// Sort: month asc, outcome asc within month.
//
// Different from incident-monthly-trend (per-month total only),
// incident-by-classification (per-classification, no time
// axis), incident-by-day-of-week (DOW pattern). This is the
// month × outcome cross-cut for OSHA 300A.
//
// Pure derivation. No persisted records.

import type { Incident, IncidentOutcome } from './incident';

export interface IncidentByOutcomeMonthlyRow {
  month: string;
  outcome: IncidentOutcome;
  total: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface IncidentByOutcomeMonthlyRollup {
  monthsConsidered: number;
  outcomesConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
}

export interface IncidentByOutcomeMonthlyInputs {
  incidents: Incident[];
  /** Optional yyyy-mm bounds inclusive applied to incidentDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildIncidentByOutcomeMonthly(
  inputs: IncidentByOutcomeMonthlyInputs,
): {
  rollup: IncidentByOutcomeMonthlyRollup;
  rows: IncidentByOutcomeMonthlyRow[];
} {
  type Acc = {
    month: string;
    outcome: IncidentOutcome;
    total: number;
    daysAway: number;
    daysRestricted: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const months = new Set<string>();
  const outcomes = new Set<IncidentOutcome>();

  let totalIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inc of inputs.incidents) {
    const month = inc.incidentDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const outcome = inc.outcome;
    const key = `${month}__${outcome}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        month,
        outcome,
        total: 0,
        daysAway: 0,
        daysRestricted: 0,
        employees: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.daysAway += inc.daysAway ?? 0;
    a.daysRestricted += inc.daysRestricted ?? 0;
    const empKey = inc.employeeId ?? `name:${inc.employeeName.toLowerCase()}`;
    a.employees.add(empKey);
    if (inc.jobId) a.jobs.add(inc.jobId);

    months.add(month);
    outcomes.add(outcome);
    totalIncidents += 1;
    totalDaysAway += inc.daysAway ?? 0;
    totalDaysRestricted += inc.daysRestricted ?? 0;
  }

  const rows: IncidentByOutcomeMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      outcome: a.outcome,
      total: a.total,
      totalDaysAway: a.daysAway,
      totalDaysRestricted: a.daysRestricted,
      distinctEmployees: a.employees.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      if (x.month !== y.month) return x.month.localeCompare(y.month);
      return x.outcome.localeCompare(y.outcome);
    });

  return {
    rollup: {
      monthsConsidered: months.size,
      outcomesConsidered: outcomes.size,
      totalIncidents,
      totalDaysAway,
      totalDaysRestricted,
    },
    rows,
  };
}
