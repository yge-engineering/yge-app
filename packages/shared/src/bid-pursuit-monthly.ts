// Per-month bid pursuit summary.
//
// Plain English: bid-pipeline gives the snapshot of what's
// currently in pursuit. This module aggregates jobs by their
// bidDueDate year-month so we can see month-over-month bid
// volume + outcome.
//
// Per row:
//   - jobs pursued (any job with a bidDueDate that month)
//   - awarded count (status === AWARDED)
//   - lost count (status === LOST)
//   - no-bid count (status === NO_BID)
//   - in-flight count (PROSPECT / PURSUING / BID_SUBMITTED)
//   - win rate = awarded / (awarded + lost) — excludes no-bids
//     and in-flight from the denominator
//
// Pure derivation. No persisted records.

import type { Job } from './job';

export interface BidPursuitMonthRow {
  yearMonth: string;          // yyyy-mm
  jobsPursued: number;
  awardedCount: number;
  lostCount: number;
  noBidCount: number;
  inFlightCount: number;
  /** awarded / (awarded + lost). Null when both are zero. */
  winRate: number | null;
}

export interface BidPursuitMonthlyRollup {
  monthsConsidered: number;
  totalJobsPursued: number;
  totalAwarded: number;
  totalLost: number;
  totalNoBid: number;
  totalInFlight: number;
  /** Blended win rate across the window. */
  blendedWinRate: number | null;
}

export interface BidPursuitMonthlyInputs {
  jobs: Pick<Job, 'id' | 'status' | 'bidDueDate'>[];
  /** Optional yyyy-mm-dd window applied against bidDueDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildBidPursuitMonthly(
  inputs: BidPursuitMonthlyInputs,
): {
  rollup: BidPursuitMonthlyRollup;
  rows: BidPursuitMonthRow[];
} {
  type Bucket = {
    yearMonth: string;
    pursued: number;
    awarded: number;
    lost: number;
    noBid: number;
    inFlight: number;
  };
  const buckets = new Map<string, Bucket>();

  let totalPursued = 0;
  let totalAwarded = 0;
  let totalLost = 0;
  let totalNoBid = 0;
  let totalInFlight = 0;

  for (const j of inputs.jobs) {
    if (!j.bidDueDate) continue;
    // bidDueDate is free-form; try to pull yyyy-mm from the front.
    const head = j.bidDueDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) continue;
    if (inputs.fromDate && head < inputs.fromDate) continue;
    if (inputs.toDate && head > inputs.toDate) continue;

    const ym = head.slice(0, 7);
    const b = buckets.get(ym) ?? {
      yearMonth: ym,
      pursued: 0,
      awarded: 0,
      lost: 0,
      noBid: 0,
      inFlight: 0,
    };
    b.pursued += 1;
    totalPursued += 1;

    switch (j.status) {
      case 'AWARDED':
        b.awarded += 1;
        totalAwarded += 1;
        break;
      case 'LOST':
        b.lost += 1;
        totalLost += 1;
        break;
      case 'NO_BID':
        b.noBid += 1;
        totalNoBid += 1;
        break;
      case 'PROSPECT':
      case 'PURSUING':
      case 'BID_SUBMITTED':
        b.inFlight += 1;
        totalInFlight += 1;
        break;
      // ARCHIVED: counted toward jobsPursued but not in any
      // outcome bucket.
    }

    buckets.set(ym, b);
  }

  const rows: BidPursuitMonthRow[] = Array.from(buckets.values())
    .map((b) => {
      const denom = b.awarded + b.lost;
      const winRate = denom === 0 ? null : round4(b.awarded / denom);
      return {
        yearMonth: b.yearMonth,
        jobsPursued: b.pursued,
        awardedCount: b.awarded,
        lostCount: b.lost,
        noBidCount: b.noBid,
        inFlightCount: b.inFlight,
        winRate,
      };
    })
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

  const blendedDenom = totalAwarded + totalLost;
  const blendedWinRate =
    blendedDenom === 0 ? null : round4(totalAwarded / blendedDenom);

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalJobsPursued: totalPursued,
      totalAwarded,
      totalLost,
      totalNoBid,
      totalInFlight,
      blendedWinRate,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
