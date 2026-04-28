// Per-job incident summary.
//
// Plain English: when an OSHA case lands on a job, that job needs
// the picture — how many recordables, how serious (death? days
// away? job transfer? medical only?), how many crew were affected,
// how many cases are still open. This rolls the incident log up
// by jobId so the safety review for any one job is one row.
//
// Per row: jobId, total, openCount, distinctEmployees,
// outcomeMix (DEATH / DAYS_AWAY / JOB_TRANSFER_OR_RESTRICTION /
// OTHER_RECORDABLE), classificationMix (INJURY / SKIN_DISORDER
// / RESPIRATORY / POISONING / HEARING_LOSS / OTHER_ILLNESS),
// totalDaysAway, totalDaysRestricted.
//
// Sort: total desc, ties by totalDaysAway desc.
//
// Different from incident-frequency (rolling rate),
// incident-monthly-trend (by month), heat-illness-audit
// (T8 §3395), and dart-rate-monthly. This is the per-job view.
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface JobIncidentSummaryRow {
  jobId: string;
  total: number;
  openCount: number;
  distinctEmployees: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  byOutcome: Partial<Record<IncidentOutcome, number>>;
  byClassification: Partial<Record<IncidentClassification, number>>;
}

export interface JobIncidentSummaryRollup {
  jobsConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalDaysRestricted: number;
  unattributed: number;
}

export interface JobIncidentSummaryInputs {
  incidents: Incident[];
  /** Optional yyyy-mm-dd window applied to incidentDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildJobIncidentSummary(
  inputs: JobIncidentSummaryInputs,
): {
  rollup: JobIncidentSummaryRollup;
  rows: JobIncidentSummaryRow[];
} {
  type Acc = {
    jobId: string;
    total: number;
    open: number;
    employees: Set<string>;
    daysAway: number;
    daysRestricted: number;
    outcomes: Map<IncidentOutcome, number>;
    classes: Map<IncidentClassification, number>;
  };
  const accs = new Map<string, Acc>();
  let totalIncidents = 0;
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  let unattributed = 0;

  for (const inc of inputs.incidents) {
    if (inputs.fromDate && inc.incidentDate < inputs.fromDate) continue;
    if (inputs.toDate && inc.incidentDate > inputs.toDate) continue;
    totalIncidents += 1;
    totalDaysAway += inc.daysAway;
    totalDaysRestricted += inc.daysRestricted;
    const jobId = (inc.jobId ?? '').trim();
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(jobId) ?? {
      jobId,
      total: 0,
      open: 0,
      employees: new Set<string>(),
      daysAway: 0,
      daysRestricted: 0,
      outcomes: new Map<IncidentOutcome, number>(),
      classes: new Map<IncidentClassification, number>(),
    };
    acc.total += 1;
    if (inc.daysAway != null) acc.daysAway += inc.daysAway;
    if (inc.daysRestricted != null) acc.daysRestricted += inc.daysRestricted;
    if (inc.employeeId) acc.employees.add(inc.employeeId);
    else if (inc.employeeName) acc.employees.add(`name:${inc.employeeName.toLowerCase()}`);
    acc.outcomes.set(inc.outcome, (acc.outcomes.get(inc.outcome) ?? 0) + 1);
    acc.classes.set(inc.classification, (acc.classes.get(inc.classification) ?? 0) + 1);
    if (inc.died) {
      // Open until logged appropriately — Phase 2 may want a separate flag.
    }
    // OPEN incidents bump the open counter regardless of outcome.
    // (Caller's status field is nullable; only count when present.)
    if ((inc as { status?: string }).status === 'OPEN') acc.open += 1;
    accs.set(jobId, acc);
  }

  const rows: JobIncidentSummaryRow[] = [];
  for (const acc of accs.values()) {
    const outObj: Partial<Record<IncidentOutcome, number>> = {};
    for (const [k, v] of acc.outcomes.entries()) outObj[k] = v;
    const clsObj: Partial<Record<IncidentClassification, number>> = {};
    for (const [k, v] of acc.classes.entries()) clsObj[k] = v;
    rows.push({
      jobId: acc.jobId,
      total: acc.total,
      openCount: acc.open,
      distinctEmployees: acc.employees.size,
      totalDaysAway: acc.daysAway,
      totalDaysRestricted: acc.daysRestricted,
      byOutcome: outObj,
      byClassification: clsObj,
    });
  }

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return b.totalDaysAway - a.totalDaysAway;
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalIncidents,
      totalDaysAway,
      totalDaysRestricted,
      unattributed,
    },
    rows,
  };
}
