// Customer-anchored incident year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of incident records into a comparison:
// counts, classification + outcome mix, total days lost,
// distinct employees + jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';
import type { Job } from './job';

export interface CustomerIncidentYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorByClassification: Partial<Record<IncidentClassification, number>>;
  priorByOutcome: Partial<Record<IncidentOutcome, number>>;
  priorTotalDaysAway: number;
  priorTotalDaysRestricted: number;
  priorDistinctEmployees: number;
  priorDistinctJobs: number;
  currentTotal: number;
  currentByClassification: Partial<Record<IncidentClassification, number>>;
  currentByOutcome: Partial<Record<IncidentOutcome, number>>;
  currentTotalDaysAway: number;
  currentTotalDaysRestricted: number;
  currentDistinctEmployees: number;
  currentDistinctJobs: number;
  totalDelta: number;
}

export interface CustomerIncidentYoyInputs {
  customerName: string;
  incidents: Incident[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerIncidentYoy(
  inputs: CustomerIncidentYoyInputs,
): CustomerIncidentYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    total: number;
    byClassification: Map<IncidentClassification, number>;
    byOutcome: Map<IncidentOutcome, number>;
    daysAway: number;
    daysRestricted: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      byClassification: new Map(),
      byOutcome: new Map(),
      daysAway: 0,
      daysRestricted: 0,
      employees: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inc of inputs.incidents) {
    if (!inc.jobId || !customerJobs.has(inc.jobId)) continue;
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
    b.jobs.add(inc.jobId);
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
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorByClassification: classRecord(prior.byClassification),
    priorByOutcome: outcomeRecord(prior.byOutcome),
    priorTotalDaysAway: prior.daysAway,
    priorTotalDaysRestricted: prior.daysRestricted,
    priorDistinctEmployees: prior.employees.size,
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentByClassification: classRecord(current.byClassification),
    currentByOutcome: outcomeRecord(current.byOutcome),
    currentTotalDaysAway: current.daysAway,
    currentTotalDaysRestricted: current.daysRestricted,
    currentDistinctEmployees: current.employees.size,
    currentDistinctJobs: current.jobs.size,
    totalDelta: current.total - prior.total,
  };
}
