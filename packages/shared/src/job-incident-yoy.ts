// Job-anchored incident year-over-year.
//
// Plain English: for one job, collapse two years of incidents
// into a comparison: counts, classification + outcome mix,
// days lost, distinct employees, plus deltas.
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface JobIncidentYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByClassification: Partial<Record<IncidentClassification, number>>;
  priorByOutcome: Partial<Record<IncidentOutcome, number>>;
  priorTotalDaysAway: number;
  priorTotalDaysRestricted: number;
  priorDistinctEmployees: number;
  currentTotal: number;
  currentByClassification: Partial<Record<IncidentClassification, number>>;
  currentByOutcome: Partial<Record<IncidentOutcome, number>>;
  currentTotalDaysAway: number;
  currentTotalDaysRestricted: number;
  currentDistinctEmployees: number;
  totalDelta: number;
}

export interface JobIncidentYoyInputs {
  jobId: string;
  incidents: Incident[];
  currentYear: number;
}

export function buildJobIncidentYoy(
  inputs: JobIncidentYoyInputs,
): JobIncidentYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    byClassification: Map<IncidentClassification, number>;
    byOutcome: Map<IncidentOutcome, number>;
    daysAway: number;
    daysRestricted: number;
    employees: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      byClassification: new Map(),
      byOutcome: new Map(),
      daysAway: 0,
      daysRestricted: 0,
      employees: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inc of inputs.incidents) {
    if (inc.jobId !== inputs.jobId) continue;
    const year = Number(inc.incidentDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.byClassification.set(inc.classification, (b.byClassification.get(inc.classification) ?? 0) + 1);
    b.byOutcome.set(inc.outcome, (b.byOutcome.get(inc.outcome) ?? 0) + 1);
    b.daysAway += inc.daysAway ?? 0;
    b.daysRestricted += inc.daysRestricted ?? 0;
    if (inc.employeeId) b.employees.add(inc.employeeId);
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
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByClassification: classRecord(prior.byClassification),
    priorByOutcome: outcomeRecord(prior.byOutcome),
    priorTotalDaysAway: prior.daysAway,
    priorTotalDaysRestricted: prior.daysRestricted,
    priorDistinctEmployees: prior.employees.size,
    currentTotal: current.total,
    currentByClassification: classRecord(current.byClassification),
    currentByOutcome: outcomeRecord(current.byOutcome),
    currentTotalDaysAway: current.daysAway,
    currentTotalDaysRestricted: current.daysRestricted,
    currentDistinctEmployees: current.employees.size,
    totalDelta: current.total - prior.total,
  };
}
