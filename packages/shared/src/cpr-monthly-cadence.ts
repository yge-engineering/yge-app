// Per-month CertifiedPayroll submission cadence.
//
// Plain English: California DIR requires weekly CPRs on every
// public-works job during the time work is performed. Walks
// CertifiedPayroll records, buckets by yyyy-mm of weekStarting,
// and surfaces:
//   - filings count per month (total / submitted / accepted /
//     non-performance)
//   - total straight + OT hours and gross pay across the month's
//     filings
//   - distinct jobs reported on
//
// Different from cpr-gap-detector (job/week gap finder) — this
// is the time-series cadence view. Good for spotting months
// where filings dropped (vacation, payroll change, eCPR portal
// outage) and the trend of public-works hours.
//
// Pure derivation. No persisted records.

import type { CertifiedPayroll } from './certified-payroll';

export interface CprMonthlyCadenceRow {
  month: string;
  totalFilings: number;
  draftCount: number;
  submittedCount: number;
  acceptedCount: number;
  amendedCount: number;
  nonPerformanceCount: number;
  totalStraightHours: number;
  totalOvertimeHours: number;
  totalGrossPayCents: number;
  distinctJobs: number;
}

export interface CprMonthlyCadenceRollup {
  monthsConsidered: number;
  totalFilings: number;
  totalStraightHours: number;
  totalOvertimeHours: number;
  totalGrossPayCents: number;
  /** Latest vs prior month delta in totalFilings. 0 with <2 months. */
  monthOverMonthFilingsChange: number;
}

export interface CprMonthlyCadenceInputs {
  certifiedPayrolls: CertifiedPayroll[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildCprMonthlyCadence(
  inputs: CprMonthlyCadenceInputs,
): {
  rollup: CprMonthlyCadenceRollup;
  rows: CprMonthlyCadenceRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    draft: number;
    submitted: number;
    accepted: number;
    amended: number;
    nonPerformance: number;
    straight: number;
    ot: number;
    gross: number;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const cpr of inputs.certifiedPayrolls) {
    const month = cpr.weekStarting.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? {
      month,
      total: 0,
      draft: 0,
      submitted: 0,
      accepted: 0,
      amended: 0,
      nonPerformance: 0,
      straight: 0,
      ot: 0,
      gross: 0,
      jobs: new Set<string>(),
    };
    b.total += 1;
    switch (cpr.status) {
      case 'DRAFT': b.draft += 1; break;
      case 'SUBMITTED': b.submitted += 1; break;
      case 'ACCEPTED': b.accepted += 1; break;
      case 'AMENDED': b.amended += 1; break;
      case 'NON_PERFORMANCE': b.nonPerformance += 1; break;
    }
    for (const row of cpr.rows) {
      b.straight += row.straightHours;
      b.ot += row.overtimeHours;
      b.gross += row.grossPayCents;
    }
    b.jobs.add(cpr.jobId);
    buckets.set(month, b);
  }

  const rows: CprMonthlyCadenceRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      totalFilings: b.total,
      draftCount: b.draft,
      submittedCount: b.submitted,
      acceptedCount: b.accepted,
      amendedCount: b.amended,
      nonPerformanceCount: b.nonPerformance,
      totalStraightHours: round2(b.straight),
      totalOvertimeHours: round2(b.ot),
      totalGrossPayCents: b.gross,
      distinctJobs: b.jobs.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.totalFilings - prev.totalFilings;
  }

  let totalFilings = 0;
  let totalStraight = 0;
  let totalOt = 0;
  let totalGross = 0;
  for (const r of rows) {
    totalFilings += r.totalFilings;
    totalStraight += r.totalStraightHours;
    totalOt += r.totalOvertimeHours;
    totalGross += r.totalGrossPayCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalFilings,
      totalStraightHours: round2(totalStraight),
      totalOvertimeHours: round2(totalOt),
      totalGrossPayCents: totalGross,
      monthOverMonthFilingsChange: mom,
    },
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
