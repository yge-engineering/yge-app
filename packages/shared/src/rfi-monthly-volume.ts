// Per-month RFI portfolio volume.
//
// Plain English: for each calendar month, how many RFIs did YGE
// submit and how many came back answered? Plus the median +
// average days from sentAt to answeredAt across the month's
// answered RFIs. Engineer responsiveness is the cleanest leading
// indicator of an at-risk job — when median answer time creeps
// up, deliveries slip.
//
// Different from:
//   - daily-rfi-volume (per-day, single window)
//   - rfi-board (snapshot list of open RFIs)
//   - job-rfi-age (per-job aging)
//   - submittal-turnaround (engineer's submittal speed, not RFIs)
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface RfiMonthlyVolumeRow {
  month: string;
  submittedCount: number;
  answeredCount: number;
  /** Distinct jobs that submitted RFIs that month. */
  distinctJobs: number;
  /** Median days from sentAt → answeredAt across answered RFIs
   *  whose answeredAt fell in this month. Null if zero. */
  medianResponseDays: number | null;
  /** Average days same as median scope. Null if zero. */
  avgResponseDays: number | null;
}

export interface RfiMonthlyVolumeRollup {
  monthsConsidered: number;
  totalSubmitted: number;
  totalAnswered: number;
  /** Blended median across the window. */
  blendedMedianDays: number | null;
  /** Month with the most submissions. */
  peakSubmittedMonth: string | null;
  peakSubmittedCount: number;
  /** Latest month vs prior month delta in submitted. 0 with <2 months. */
  monthOverMonthSubmittedChange: number;
}

export interface RfiMonthlyVolumeInputs {
  rfis: Rfi[];
  /** Inclusive yyyy-mm bounds. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildRfiMonthlyVolume(inputs: RfiMonthlyVolumeInputs): {
  rollup: RfiMonthlyVolumeRollup;
  rows: RfiMonthlyVolumeRow[];
} {
  type Bucket = {
    month: string;
    submitted: number;
    answered: number;
    jobs: Set<string>;
    /** Response-day samples for answered RFIs whose answeredAt is
     *  in this month. */
    responseDays: number[];
  };
  const buckets = new Map<string, Bucket>();
  const allResponseDays: number[] = [];

  // 1) Submitted: bucket by sentAt month.
  for (const r of inputs.rfis) {
    if (r.sentAt) {
      const m = r.sentAt.slice(0, 7);
      if (!inputs.fromMonth || m >= inputs.fromMonth) {
        if (!inputs.toMonth || m <= inputs.toMonth) {
          const b = buckets.get(m) ?? freshBucket(m);
          b.submitted += 1;
          b.jobs.add(r.jobId);
          buckets.set(m, b);
        }
      }
    }
    // 2) Answered: bucket by answeredAt month.
    if (r.sentAt && r.answeredAt) {
      const m = r.answeredAt.slice(0, 7);
      if (!inputs.fromMonth || m >= inputs.fromMonth) {
        if (!inputs.toMonth || m <= inputs.toMonth) {
          const b = buckets.get(m) ?? freshBucket(m);
          b.answered += 1;
          const days = daysBetween(r.sentAt, r.answeredAt);
          if (days >= 0) {
            b.responseDays.push(days);
            allResponseDays.push(days);
          }
          buckets.set(m, b);
        }
      }
    }
  }

  const rows: RfiMonthlyVolumeRow[] = Array.from(buckets.values())
    .map((b) => {
      const median = computeMedian(b.responseDays);
      const avg = b.responseDays.length === 0
        ? null
        : Math.round((b.responseDays.reduce((a, c) => a + c, 0) / b.responseDays.length) * 10) / 10;
      return {
        month: b.month,
        submittedCount: b.submitted,
        answeredCount: b.answered,
        distinctJobs: b.jobs.size,
        medianResponseDays: median,
        avgResponseDays: avg,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // Peak submitted.
  let peakMonth: string | null = null;
  let peakSubmitted = 0;
  for (const r of rows) {
    if (r.submittedCount > peakSubmitted) {
      peakSubmitted = r.submittedCount;
      peakMonth = r.month;
    }
  }

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.submittedCount - prev.submittedCount;
  }

  let totalSubmitted = 0;
  let totalAnswered = 0;
  for (const r of rows) {
    totalSubmitted += r.submittedCount;
    totalAnswered += r.answeredCount;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalSubmitted,
      totalAnswered,
      blendedMedianDays: computeMedian(allResponseDays),
      peakSubmittedMonth: peakMonth,
      peakSubmittedCount: peakSubmitted,
      monthOverMonthSubmittedChange: mom,
    },
    rows,
  };
}

function freshBucket(month: string): {
  month: string;
  submitted: number;
  answered: number;
  jobs: Set<string>;
  responseDays: number[];
} {
  return {
    month,
    submitted: 0,
    answered: 0,
    jobs: new Set<string>(),
    responseDays: [],
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return Math.round(((a + b) / 2) * 10) / 10;
}
