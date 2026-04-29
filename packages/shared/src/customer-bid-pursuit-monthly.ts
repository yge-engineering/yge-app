// Per (customer, month) bid pursuit + win rate.
//
// Plain English: bucket Job records by canonical ownerAgency +
// yyyy-mm of bidDueDate. Counts pursuits, awarded, lost, no-bid,
// in-flight. Win rate = AWARDED / (AWARDED + LOST + NO_BID),
// matching job-by-project-type's denominator. Tells YGE how
// each agency client is trending — "Caltrans D2 win rate dropped
// from 50% to 20% in Q1, what changed?"
//
// Per row: customerName, month, jobsPursued, awardedCount,
// lostCount, noBidCount, inFlightCount, winRate.
//
// Sort: customerName asc, month asc.
//
// Different from bid-pursuit-monthly (portfolio per month),
// bid-win-rate-by-customer (per-customer all-time, no month
// axis), bid-result-by-month (uses BidResult records, not Job
// status — different data source).
//
// Pure derivation. No persisted records.

import type { Job } from './job';

export interface CustomerBidPursuitMonthlyRow {
  customerName: string;
  month: string;
  jobsPursued: number;
  awardedCount: number;
  lostCount: number;
  noBidCount: number;
  inFlightCount: number;
  /** AWARDED / (AWARDED + LOST + NO_BID). Null when denominator is 0. */
  winRate: number | null;
}

export interface CustomerBidPursuitMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalPursuits: number;
  totalAwarded: number;
  totalLost: number;
  noDateSkipped: number;
}

export interface CustomerBidPursuitMonthlyInputs {
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to bidDueDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerBidPursuitMonthly(
  inputs: CustomerBidPursuitMonthlyInputs,
): {
  rollup: CustomerBidPursuitMonthlyRollup;
  rows: CustomerBidPursuitMonthlyRow[];
} {
  type Acc = {
    customerName: string;
    month: string;
    jobsPursued: number;
    awarded: number;
    lost: number;
    noBid: number;
    inFlight: number;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalPursuits = 0;
  let totalAwarded = 0;
  let totalLost = 0;
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

    const cKey = (j.ownerAgency ?? '').toLowerCase().trim();
    if (!cKey) {
      noDateSkipped += 1;
      continue;
    }
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName: j.ownerAgency ?? '',
        month,
        jobsPursued: 0,
        awarded: 0,
        lost: 0,
        noBid: 0,
        inFlight: 0,
      };
      accs.set(key, a);
    }
    a.jobsPursued += 1;
    const status = j.status ?? 'PURSUING';
    if (status === 'AWARDED') {
      a.awarded += 1;
      totalAwarded += 1;
    } else if (status === 'LOST') {
      a.lost += 1;
      totalLost += 1;
    } else if (status === 'NO_BID') {
      a.noBid += 1;
    } else if (
      status === 'PROSPECT' ||
      status === 'PURSUING' ||
      status === 'BID_SUBMITTED'
    ) {
      a.inFlight += 1;
    }

    customers.add(cKey);
    months.add(month);
    totalPursuits += 1;
  }

  const rows: CustomerBidPursuitMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const denom = a.awarded + a.lost + a.noBid;
      return {
        customerName: a.customerName,
        month: a.month,
        jobsPursued: a.jobsPursued,
        awardedCount: a.awarded,
        lostCount: a.lost,
        noBidCount: a.noBid,
        inFlightCount: a.inFlight,
        winRate: denom > 0 ? a.awarded / denom : null,
      };
    })
    .sort((x, y) => {
      const c = x.customerName.localeCompare(y.customerName);
      if (c !== 0) return c;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalPursuits,
      totalAwarded,
      totalLost,
      noDateSkipped,
    },
    rows,
  };
}
