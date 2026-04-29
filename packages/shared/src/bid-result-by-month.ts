// Bid result outcomes by month.
//
// Plain English: bucket bid results by yyyy-mm of bidOpenedAt
// to see win/loss trend over time. Also tracks total YGE bid \$
// and won \$ per month so the topline pursuit conversion is on
// one chart.
//
// Per row: month, total, won, lost, tbd, noAward,
// totalSubmittedCents (YGE bidder amount sum), totalWonCents,
// distinctJobs.
//
// Sort by month asc.
//
// Different from bid-pursuit-monthly (jobs by bidDueDate),
// bid-win-rate-by-customer (per customer), and
// bid-to-award-variance (bid vs awarded contract).
//
// Pure derivation. No persisted records.

import type { BidResult, BidOutcome } from './bid-result';

export interface BidResultByMonthRow {
  month: string;
  total: number;
  won: number;
  lost: number;
  tbd: number;
  noAward: number;
  totalSubmittedCents: number;
  totalWonCents: number;
  distinctJobs: number;
}

export interface BidResultByMonthRollup {
  monthsConsidered: number;
  totalResults: number;
  totalWon: number;
  totalSubmittedCents: number;
  totalWonCents: number;
  monthOverMonthWonChange: number;
}

export interface BidResultByMonthInputs {
  bidResults: BidResult[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildBidResultByMonth(
  inputs: BidResultByMonthInputs,
): {
  rollup: BidResultByMonthRollup;
  rows: BidResultByMonthRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<BidOutcome, number>;
    submittedCents: number;
    wonCents: number;
    jobs: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: { WON_BY_YGE: 0, WON_BY_OTHER: 0, NO_AWARD: 0, TBD: 0 },
    submittedCents: 0,
    wonCents: 0,
    jobs: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const r of inputs.bidResults) {
    const month = r.bidOpenedAt.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const yge = (r.bidders ?? []).find((b) => b.isYge);
    const ygeAmount = yge ? yge.amountCents : 0;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[r.outcome] += 1;
    b.submittedCents += ygeAmount;
    if (r.outcome === 'WON_BY_YGE') b.wonCents += ygeAmount;
    b.jobs.add(r.jobId);
    buckets.set(month, b);
  }

  const rows: BidResultByMonthRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        won: b.counts.WON_BY_YGE,
        lost: b.counts.WON_BY_OTHER,
        tbd: b.counts.TBD,
        noAward: b.counts.NO_AWARD,
        totalSubmittedCents: b.submittedCents,
        totalWonCents: b.wonCents,
        distinctJobs: b.jobs.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let momWon = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) momWon = last.won - prev.won;
  }

  let totalResults = 0;
  let totalWon = 0;
  let totalSubmitted = 0;
  let totalWonCents = 0;
  for (const r of rows) {
    totalResults += r.total;
    totalWon += r.won;
    totalSubmitted += r.totalSubmittedCents;
    totalWonCents += r.totalWonCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalResults,
      totalWon,
      totalSubmittedCents: totalSubmitted,
      totalWonCents,
      monthOverMonthWonChange: momWon,
    },
    rows,
  };
}
