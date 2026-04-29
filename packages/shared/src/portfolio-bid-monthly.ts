// Portfolio bid pursuit by month with cumulative win rate.
//
// Plain English: per yyyy-mm of bidDueDate, count pursuits +
// awards + losses + no-bids + in-flight, plus this month's
// win rate and the cumulative win rate to date. Drives the
// estimating manager's monthly bid review.
//
// Per row: month, jobsPursued, awardedCount, lostCount,
// noBidCount, inFlightCount, winRate, cumulativeWinRate.
//
// Sort: month asc.
//
// Different from bid-pursuit-monthly (no cumulative),
// customer-bid-pursuit-monthly (per customer), bid-result-by-
// month (uses BidResult records, not Job status).
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface PortfolioBidMonthlyRow {
  month: string;
  jobsPursued: number;
  awardedCount: number;
  lostCount: number;
  noBidCount: number;
  inFlightCount: number;
  /** awarded / (awarded + lost + noBid). Null if denominator is 0. */
  winRate: number | null;
  cumulativeWinRate: number | null;
}

export interface PortfolioBidMonthlyRollup {
  monthsConsidered: number;
  totalPursuits: number;
  totalAwarded: number;
  totalLost: number;
  totalNoBid: number;
  totalInFlight: number;
  noDateSkipped: number;
}

export interface PortfolioBidMonthlyInputs {
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to bidDueDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioBidMonthly(
  inputs: PortfolioBidMonthlyInputs,
): {
  rollup: PortfolioBidMonthlyRollup;
  rows: PortfolioBidMonthlyRow[];
} {
  type Acc = {
    month: string;
    jobsPursued: number;
    awarded: number;
    lost: number;
    noBid: number;
    inFlight: number;
  };
  const accs = new Map<string, Acc>();

  let totalPursuits = 0;
  let totalAwarded = 0;
  let totalLost = 0;
  let totalNoBid = 0;
  let totalInFlight = 0;
  let noDateSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const j of inputs.jobs) {
    const due = j.bidDueDate;
    if (!due || !/^\d{4}-\d{2}/.test(due)) {
      noDateSkipped += 1;
      continue;
    }
    const month = due.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        jobsPursued: 0,
        awarded: 0,
        lost: 0,
        noBid: 0,
        inFlight: 0,
      };
      accs.set(month, a);
    }
    a.jobsPursued += 1;
    const status: JobStatus = j.status ?? 'PURSUING';
    if (status === 'AWARDED') {
      a.awarded += 1;
      totalAwarded += 1;
    } else if (status === 'LOST') {
      a.lost += 1;
      totalLost += 1;
    } else if (status === 'NO_BID') {
      a.noBid += 1;
      totalNoBid += 1;
    } else if (
      status === 'PROSPECT' ||
      status === 'PURSUING' ||
      status === 'BID_SUBMITTED'
    ) {
      a.inFlight += 1;
      totalInFlight += 1;
    }
    totalPursuits += 1;
  }

  const sorted = [...accs.values()].sort((x, y) => x.month.localeCompare(y.month));
  let cumAwarded = 0;
  let cumDecided = 0;

  const rows: PortfolioBidMonthlyRow[] = sorted.map((a) => {
    const decided = a.awarded + a.lost + a.noBid;
    const monthly = decided > 0 ? a.awarded / decided : null;
    cumAwarded += a.awarded;
    cumDecided += decided;
    const cumulative = cumDecided > 0 ? cumAwarded / cumDecided : null;
    return {
      month: a.month,
      jobsPursued: a.jobsPursued,
      awardedCount: a.awarded,
      lostCount: a.lost,
      noBidCount: a.noBid,
      inFlightCount: a.inFlight,
      winRate: monthly,
      cumulativeWinRate: cumulative,
    };
  });

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalPursuits,
      totalAwarded,
      totalLost,
      totalNoBid,
      totalInFlight,
      noDateSkipped,
    },
    rows,
  };
}
