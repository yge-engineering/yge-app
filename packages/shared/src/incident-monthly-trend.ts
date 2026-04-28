// Per-month incident trend.
//
// Plain English: bucket every Form-300-recordable incident by the
// calendar month it happened in, so the safety meeting can see
// whether things are trending up or down. Each month carries:
//   - total incident count
//   - count by OSHA outcome (DEATH / DAYS_AWAY / RESTRICTION / OTHER)
//   - count by classification (INJURY / illness sub-types)
//   - DART days for the month (days away + restricted, summed
//     across all incidents whose incidentDate falls in the month)
//
// Why month and not week? OSHA reports + EMR carriers + the
// Form 300A summary all roll on the calendar year, so monthly
// buckets line up with how the data ends up reported externally.
//
// Pure derivation. No persisted records.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface IncidentMonthRow {
  /** yyyy-mm bucket key. */
  month: string;
  totalIncidents: number;
  /** OSHA outcome counts. */
  deathCount: number;
  daysAwayCount: number;
  restrictionCount: number;
  otherRecordableCount: number;
  /** Classification counts. */
  injuryCount: number;
  illnessCount: number;
  /** Sum of daysAway + daysRestricted across the month's incidents.
   *  This is the "DART days" figure carriers track. */
  dartDays: number;
  /** Total daysAway only. */
  daysAwayTotal: number;
  /** Distinct employees involved this month. */
  distinctEmployees: number;
  /** Distinct jobs that had an incident this month. Incidents
   *  without a jobId don't contribute to this count. */
  distinctJobs: number;
}

export interface IncidentMonthlyRollup {
  monthsWithIncidents: number;
  totalIncidents: number;
  totalDartDays: number;
  totalDeaths: number;
  /** Month with the highest totalIncidents. Null if no months. */
  peakMonth: string | null;
  peakIncidents: number;
  /** Most-recent month vs prior month. Positive = trending up. */
  monthOverMonthChange: number;
}

export interface IncidentMonthlyInputs {
  incidents: Incident[];
  /** Optional inclusive lower bound (yyyy-mm). */
  fromMonth?: string;
  /** Optional inclusive upper bound (yyyy-mm). */
  toMonth?: string;
}

export function buildIncidentMonthlyTrend(
  inputs: IncidentMonthlyInputs,
): {
  rollup: IncidentMonthlyRollup;
  rows: IncidentMonthRow[];
} {
  type Bucket = {
    total: number;
    death: number;
    daysAway: number;
    restriction: number;
    otherRec: number;
    injury: number;
    illness: number;
    dart: number;
    daysAwayDays: number;
    employees: Set<string>;
    jobs: Set<string>;
  };

  const buckets = new Map<string, Bucket>();

  for (const inc of inputs.incidents) {
    if (!inc.incidentDate) continue;
    const month = inc.incidentDate.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;

    const b = buckets.get(month) ?? freshBucket();
    b.total += 1;
    bumpOutcome(b, inc.outcome);
    bumpClassification(b, inc.classification);
    b.dart += inc.daysAway + inc.daysRestricted;
    b.daysAwayDays += inc.daysAway;
    if (inc.employeeId) b.employees.add(inc.employeeId);
    else b.employees.add(`name:${inc.employeeName.toLowerCase().trim()}`);
    if (inc.jobId) b.jobs.add(inc.jobId);
    buckets.set(month, b);
  }

  const rows: IncidentMonthRow[] = [];
  for (const [month, b] of buckets.entries()) {
    rows.push({
      month,
      totalIncidents: b.total,
      deathCount: b.death,
      daysAwayCount: b.daysAway,
      restrictionCount: b.restriction,
      otherRecordableCount: b.otherRec,
      injuryCount: b.injury,
      illnessCount: b.illness,
      dartDays: b.dart,
      daysAwayTotal: b.daysAwayDays,
      distinctEmployees: b.employees.size,
      distinctJobs: b.jobs.size,
    });
  }

  rows.sort((a, b) => a.month.localeCompare(b.month));

  // Peak.
  let peakMonth: string | null = null;
  let peakIncidents = 0;
  for (const r of rows) {
    if (r.totalIncidents > peakIncidents) {
      peakIncidents = r.totalIncidents;
      peakMonth = r.month;
    }
  }

  // Month-over-month change: latest minus prior. 0 when fewer than
  // 2 months.
  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) {
      mom = last.totalIncidents - prev.totalIncidents;
    }
  }

  let totalIncidents = 0;
  let totalDart = 0;
  let totalDeaths = 0;
  for (const r of rows) {
    totalIncidents += r.totalIncidents;
    totalDart += r.dartDays;
    totalDeaths += r.deathCount;
  }

  return {
    rollup: {
      monthsWithIncidents: rows.length,
      totalIncidents,
      totalDartDays: totalDart,
      totalDeaths,
      peakMonth,
      peakIncidents,
      monthOverMonthChange: mom,
    },
    rows,
  };
}

function freshBucket(): {
  total: number;
  death: number;
  daysAway: number;
  restriction: number;
  otherRec: number;
  injury: number;
  illness: number;
  dart: number;
  daysAwayDays: number;
  employees: Set<string>;
  jobs: Set<string>;
} {
  return {
    total: 0,
    death: 0,
    daysAway: 0,
    restriction: 0,
    otherRec: 0,
    injury: 0,
    illness: 0,
    dart: 0,
    daysAwayDays: 0,
    employees: new Set<string>(),
    jobs: new Set<string>(),
  };
}

function bumpOutcome(
  b: ReturnType<typeof freshBucket>,
  o: IncidentOutcome,
): void {
  switch (o) {
    case 'DEATH':
      b.death += 1;
      break;
    case 'DAYS_AWAY':
      b.daysAway += 1;
      break;
    case 'JOB_TRANSFER_OR_RESTRICTION':
      b.restriction += 1;
      break;
    case 'OTHER_RECORDABLE':
      b.otherRec += 1;
      break;
  }
}

function bumpClassification(
  b: ReturnType<typeof freshBucket>,
  c: IncidentClassification,
): void {
  if (c === 'INJURY') {
    b.injury += 1;
  } else {
    b.illness += 1;
  }
}
