// Per-customer bid win rate.
//
// Plain English: every bid result on file has a job, every job has
// an owner agency (Caltrans D2, BLM, county public works, private
// owner). Joining those two tells us which customers we're winning
// work from and which we're chasing without converting. A 0/12
// record on Caltrans D2 over the last year is a signal — either
// our number is too high, or we're not yet on their preferred-
// bidder shortlist, or the work isn't a fit.
//
// Per row: customerName (canonical from job.ownerAgency),
// bidsSubmitted, bidsWon, bidsLost, bidsTbd, bidsNoAward,
// winRate (won / decided where decided = won + lost),
// totalSubmittedCents (YGE's bid amount across all results),
// totalWonCents.
//
// Sort: winRate desc, ties by bidsSubmitted desc.
//
// Different from bid-result (per-bid record),
// bid-to-award-variance (per-bid spread), customer-job-pipeline
// (status mix not just bid outcomes), and competitor-frequency
// (per-competitor counts).
//
// Pure derivation. No persisted records.

import type { BidResult } from './bid-result';
import type { Job } from './job';

export interface BidWinRateByCustomerRow {
  customerName: string;
  bidsSubmitted: number;
  bidsWon: number;
  bidsLost: number;
  bidsTbd: number;
  bidsNoAward: number;
  winRate: number;
  totalSubmittedCents: number;
  totalWonCents: number;
}

export interface BidWinRateByCustomerRollup {
  customersConsidered: number;
  bidsSubmitted: number;
  bidsWon: number;
  bidsLost: number;
  portfolioWinRate: number;
  totalSubmittedCents: number;
  totalWonCents: number;
  unattributed: number;
}

export interface BidWinRateByCustomerInputs {
  jobs: Job[];
  bidResults: BidResult[];
  /** Optional yyyy-mm-dd window applied to bidOpenedAt. */
  fromDate?: string;
  toDate?: string;
}

export function buildBidWinRateByCustomer(
  inputs: BidWinRateByCustomerInputs,
): {
  rollup: BidWinRateByCustomerRollup;
  rows: BidWinRateByCustomerRow[];
} {
  const ownerByJob = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) ownerByJob.set(j.id, j.ownerAgency);
  }

  type Acc = {
    display: string;
    submitted: number;
    won: number;
    lost: number;
    tbd: number;
    noAward: number;
    submittedCents: number;
    wonCents: number;
  };
  const accs = new Map<string, Acc>();
  let totalSub = 0;
  let totalWon = 0;
  let totalLost = 0;
  let totalSubCents = 0;
  let totalWonCents = 0;
  let unattributed = 0;

  for (const r of inputs.bidResults) {
    if (inputs.fromDate && r.bidOpenedAt < inputs.fromDate) continue;
    if (inputs.toDate && r.bidOpenedAt > inputs.toDate) continue;
    totalSub += 1;
    const ygeBid = (r.bidders ?? []).find((b) => b.isYge);
    const ygeAmount = ygeBid?.amountCents ?? 0;
    totalSubCents += ygeAmount;
    if (r.outcome === 'WON_BY_YGE') {
      totalWon += 1;
      totalWonCents += ygeAmount;
    }
    if (r.outcome === 'WON_BY_OTHER') totalLost += 1;
    const display = ownerByJob.get(r.jobId);
    if (!display) {
      unattributed += 1;
      continue;
    }
    const key = canonicalize(display);
    const acc = accs.get(key) ?? {
      display,
      submitted: 0,
      won: 0,
      lost: 0,
      tbd: 0,
      noAward: 0,
      submittedCents: 0,
      wonCents: 0,
    };
    acc.submitted += 1;
    acc.submittedCents += ygeAmount;
    if (r.outcome === 'WON_BY_YGE') {
      acc.won += 1;
      acc.wonCents += ygeAmount;
    } else if (r.outcome === 'WON_BY_OTHER') {
      acc.lost += 1;
    } else if (r.outcome === 'TBD') {
      acc.tbd += 1;
    } else if (r.outcome === 'NO_AWARD') {
      acc.noAward += 1;
    }
    accs.set(key, acc);
  }

  const rows: BidWinRateByCustomerRow[] = [];
  for (const acc of accs.values()) {
    const decided = acc.won + acc.lost;
    const winRate = decided === 0
      ? 0
      : Math.round((acc.won / decided) * 10_000) / 10_000;
    rows.push({
      customerName: acc.display,
      bidsSubmitted: acc.submitted,
      bidsWon: acc.won,
      bidsLost: acc.lost,
      bidsTbd: acc.tbd,
      bidsNoAward: acc.noAward,
      winRate,
      totalSubmittedCents: acc.submittedCents,
      totalWonCents: acc.wonCents,
    });
  }

  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.bidsSubmitted - a.bidsSubmitted;
  });

  const decided = totalWon + totalLost;
  const portfolio = decided === 0
    ? 0
    : Math.round((totalWon / decided) * 10_000) / 10_000;

  return {
    rollup: {
      customersConsidered: rows.length,
      bidsSubmitted: totalSub,
      bidsWon: totalWon,
      bidsLost: totalLost,
      portfolioWinRate: portfolio,
      totalSubmittedCents: totalSubCents,
      totalWonCents: totalWonCents,
      unattributed,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
