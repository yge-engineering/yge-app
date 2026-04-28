// Per-month active workforce headcount.
//
// Plain English: for each calendar month, how many distinct
// employees actually showed up on a submitted daily report?
// That's the "active" workforce — different from the Employee
// roster (which is the *available* pool) because it captures
// who was on the books vs. who was just sitting at the yard.
//
// Different from:
//   - employee-tenure (per-employee tenure snapshot)
//   - employee-cooccurrence (who works with whom)
//   - employee-dr-appearances (per-employee appearance count)
//   - dispatch-utilization (per-employee show-up rate)
//
// Per row: month, distinctActive (unique employee count), total
// crew rows (i.e. person-days), distinct jobs touched, MoM change.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';

export interface WorkforceHeadcountMonthRow {
  /** yyyy-mm bucket. */
  month: string;
  /** Distinct employees on submitted DRs that month. */
  distinctActive: number;
  /** Total person-days (crewOnSite rows summed). */
  totalPersonDays: number;
  /** Distinct jobs touched in the month. */
  distinctJobs: number;
}

export interface WorkforceHeadcountRollup {
  monthsConsidered: number;
  /** Month with the highest distinctActive. Null if none. */
  peakMonth: string | null;
  peakActive: number;
  /** Latest month vs prior month delta in distinctActive. 0 with
   *  fewer than 2 months. Positive = trending up. */
  monthOverMonthChange: number;
  /** Distinct employees across the WHOLE window. */
  totalDistinctEmployees: number;
}

export interface WorkforceHeadcountInputs {
  reports: DailyReport[];
  /** Optional yyyy-mm bounds. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildWorkforceHeadcountMonthly(
  inputs: WorkforceHeadcountInputs,
): {
  rollup: WorkforceHeadcountRollup;
  rows: WorkforceHeadcountMonthRow[];
} {
  type Bucket = {
    month: string;
    employees: Set<string>;
    personDays: number;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  const allEmployees = new Set<string>();

  for (const r of inputs.reports) {
    if (!r.submitted) continue;
    const month = r.date.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;

    const b = buckets.get(month) ?? {
      month,
      employees: new Set<string>(),
      personDays: 0,
      jobs: new Set<string>(),
    };
    b.jobs.add(r.jobId);
    for (const row of r.crewOnSite) {
      b.employees.add(row.employeeId);
      allEmployees.add(row.employeeId);
      b.personDays += 1;
    }
    buckets.set(month, b);
  }

  const rows: WorkforceHeadcountMonthRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      distinctActive: b.employees.size,
      totalPersonDays: b.personDays,
      distinctJobs: b.jobs.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Peak.
  let peakMonth: string | null = null;
  let peakActive = 0;
  for (const r of rows) {
    if (r.distinctActive > peakActive) {
      peakActive = r.distinctActive;
      peakMonth = r.month;
    }
  }

  // MoM change.
  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) {
      mom = last.distinctActive - prev.distinctActive;
    }
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      peakMonth,
      peakActive,
      monthOverMonthChange: mom,
      totalDistinctEmployees: allEmployees.size,
    },
    rows,
  };
}
