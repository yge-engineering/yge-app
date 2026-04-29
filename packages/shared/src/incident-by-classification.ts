// Incidents by classification.
//
// Plain English: roll the OSHA 300 log up by classification
// (INJURY, SKIN_DISORDER, RESPIRATORY, POISONING, HEARING_LOSS,
// OTHER_ILLNESS). The mix tells what kinds of cases are showing
// up — heavy on INJURY suggests jobsite hazards (struck-by, fall,
// crush). Heavy on RESPIRATORY suggests silica / dust exposure
// programs need work.
//
// Per row: classification, total, byOutcome (DEATH /
// DAYS_AWAY / JOB_TRANSFER_OR_RESTRICTION / OTHER_RECORDABLE),
// totalDaysAway, totalDaysRestricted, distinctEmployees,
// distinctJobs, share.
//
// Sort by total desc.
//
// Different from incident-frequency (rolling rate),
// incident-monthly-trend (by month), heat-illness-audit (T8
// §3395), dart-rate-monthly. This is the kind-of-case
// breakdown.
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface IncidentByClassificationRow {
  classification: IncidentClassification;
  total: number;
  byOutcome: Partial<Record<IncidentOutcome, number>>;
  totalDaysAway: number;
  totalDaysRestricted: number;
  distinctEmployees: number;
  distinctJobs: number;
  share: number;
}

export interface IncidentByClassificationRollup {
  classificationsConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
}

export interface IncidentByClassificationInputs {
  incidents: Incident[];
  /** Optional yyyy-mm-dd window applied to incidentDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildIncidentByClassification(
  inputs: IncidentByClassificationInputs,
): {
  rollup: IncidentByClassificationRollup;
  rows: IncidentByClassificationRow[];
} {
  type Acc = {
    total: number;
    outcomes: Map<IncidentOutcome, number>;
    daysAway: number;
    daysRestricted: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<IncidentClassification, Acc>();
  let portfolioTotal = 0;
  let portfolioDaysAway = 0;
  let portfolioDaysRestricted = 0;

  for (const inc of inputs.incidents) {
    if (inputs.fromDate && inc.incidentDate < inputs.fromDate) continue;
    if (inputs.toDate && inc.incidentDate > inputs.toDate) continue;
    portfolioTotal += 1;
    portfolioDaysAway += inc.daysAway;
    portfolioDaysRestricted += inc.daysRestricted;
    const acc = accs.get(inc.classification) ?? {
      total: 0,
      outcomes: new Map<IncidentOutcome, number>(),
      daysAway: 0,
      daysRestricted: 0,
      employees: new Set<string>(),
      jobs: new Set<string>(),
    };
    acc.total += 1;
    acc.outcomes.set(inc.outcome, (acc.outcomes.get(inc.outcome) ?? 0) + 1);
    acc.daysAway += inc.daysAway;
    acc.daysRestricted += inc.daysRestricted;
    if (inc.employeeId) acc.employees.add(inc.employeeId);
    else if (inc.employeeName) acc.employees.add(`name:${inc.employeeName.toLowerCase()}`);
    if (inc.jobId) acc.jobs.add(inc.jobId);
    accs.set(inc.classification, acc);
  }

  const rows: IncidentByClassificationRow[] = [];
  for (const [classification, acc] of accs.entries()) {
    const outObj: Partial<Record<IncidentOutcome, number>> = {};
    for (const [k, v] of acc.outcomes.entries()) outObj[k] = v;
    const share = portfolioTotal === 0
      ? 0
      : Math.round((acc.total / portfolioTotal) * 10_000) / 10_000;
    rows.push({
      classification,
      total: acc.total,
      byOutcome: outObj,
      totalDaysAway: acc.daysAway,
      totalDaysRestricted: acc.daysRestricted,
      distinctEmployees: acc.employees.size,
      distinctJobs: acc.jobs.size,
      share,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      classificationsConsidered: rows.length,
      totalIncidents: portfolioTotal,
      totalDaysAway: portfolioDaysAway,
      totalDaysRestricted: portfolioDaysRestricted,
    },
    rows,
  };
}
