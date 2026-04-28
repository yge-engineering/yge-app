// Per-month new-job pipeline volume.
//
// Plain English: bucket Job records by yyyy-mm of createdAt to
// see how many new pursuits / prospects entered the pipeline
// each month, and what their current status mix looks like.
//
// Different from bid-pursuit-monthly (buckets by bidDueDate) —
// this views the front of the funnel (when a job entered the
// system), not the bid-day window.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface JobCreationMonthRow {
  month: string;
  total: number;
  prospect: number;
  pursuing: number;
  bidSubmitted: number;
  awarded: number;
  lost: number;
  noBid: number;
  archived: number;
  /** Distinct project types observed that month. */
  distinctProjectTypes: number;
}

export interface JobCreationMonthlyRollup {
  monthsConsidered: number;
  totalCreated: number;
  totalAwarded: number;
  monthOverMonthCreatedChange: number;
}

export interface JobCreationMonthlyInputs {
  jobs: Job[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobCreationMonthly(
  inputs: JobCreationMonthlyInputs,
): {
  rollup: JobCreationMonthlyRollup;
  rows: JobCreationMonthRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<JobStatus, number>;
    types: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: {
      PROSPECT: 0,
      PURSUING: 0,
      BID_SUBMITTED: 0,
      AWARDED: 0,
      LOST: 0,
      NO_BID: 0,
      ARCHIVED: 0,
    },
    types: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const j of inputs.jobs) {
    const month = j.createdAt.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[j.status] += 1;
    b.types.add(j.projectType);
    buckets.set(month, b);
  }

  const rows: JobCreationMonthRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        prospect: b.counts.PROSPECT,
        pursuing: b.counts.PURSUING,
        bidSubmitted: b.counts.BID_SUBMITTED,
        awarded: b.counts.AWARDED,
        lost: b.counts.LOST,
        noBid: b.counts.NO_BID,
        archived: b.counts.ARCHIVED,
        distinctProjectTypes: b.types.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.total - prev.total;
  }

  let totalCreated = 0;
  let totalAwarded = 0;
  for (const r of rows) {
    totalCreated += r.total;
    totalAwarded += r.awarded;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalCreated,
      totalAwarded,
      monthOverMonthCreatedChange: mom,
    },
    rows,
  };
}
