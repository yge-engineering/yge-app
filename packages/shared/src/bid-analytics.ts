// Bid analytics — pursuit intel from BidResult history.
//
// Plain English: where do we win, where do we leave money on the
// table, how does our pricing compare to the engineer's estimate
// and the second-place bidder? Pure derivation over the BidResult
// records the user has already entered.
//
// Five views:
//   1. Overall win rate + bid count
//   2. YGE margin to winner (when we lose) and to 2nd place (when we win)
//   3. YGE margin to engineer's estimate (when published)
//   4. Win rate by project type
//   5. Win rate by owner agency
//
// Phase 1 simplification: project type + owner agency are passed in
// alongside the bid results because BidResult itself only carries
// jobId. Caller looks up Job to get those metadata fields and zips
// them into the input. Phase 2 collapses the lookup into the report
// once the API exposes a /api/bid-results?expand=job endpoint.

import type { BidResult, BidResultBidder } from './bid-result';

export interface BidAnalyticsRow {
  /** Job id this bid was for. */
  jobId: string;
  /** Date bids were opened (yyyy-mm-dd). */
  bidOpenedAt: string;
  /** Outcome at the time the rollup ran. */
  outcome: BidResult['outcome'];

  /** YGE's bid in cents — null if YGE did not bid this job. */
  ygeBidCents: number | null;
  /** Winner amount in cents — null when there's no winner yet. */
  winnerBidCents: number | null;
  /** Second-place amount in cents (the next-lowest bidder after winner). */
  secondPlaceBidCents: number | null;
  engineersEstimateCents: number | null;

  /** YGE's rank, 1 = low. null if no YGE bid. */
  ygeRank: number | null;
  /** Number of bidders. */
  bidderCount: number;

  /** Spread between YGE and the winner (cents). Positive = YGE was
   *  higher than winner; negative = YGE was lower. null when YGE
   *  didn't bid. */
  spreadToWinnerCents: number | null;
  /** Spread between YGE and 2nd-place. Positive = YGE was lower (we
   *  won by this much); null when YGE didn't bid or there's no 2nd. */
  spreadToSecondCents: number | null;
  /** Spread between YGE and engineer's estimate. Positive = YGE
   *  higher than EE. null when no EE published. */
  spreadToEngineersEstimateCents: number | null;
}

export interface BidAnalyticsSummary {
  /** Number of bid events in the rollup. */
  bidsConsidered: number;
  /** Number where YGE actually bid. */
  ygeBidCount: number;
  /** Number where YGE won. */
  ygeWonCount: number;
  /** ygeWonCount / ygeBidCount (excluding TBD). */
  winRate: number;

  /** Avg cents YGE was over winner across the LOST bids (positive). */
  avgLossSpreadCents: number;
  /** Avg cents YGE was UNDER 2nd place across the WON bids
   *  (the "money left on the table" number). */
  avgWinCushionCents: number;
  /** Avg cents YGE was UNDER engineer's estimate across all bids. */
  avgYgeVsEngineersEstimateCents: number;

  /** Win rate by project type. Map<projectType, {wins, total, rate}>. */
  byProjectType: Map<string, BidAnalyticsByDimension>;
  /** Win rate by owner agency. */
  byOwnerAgency: Map<string, BidAnalyticsByDimension>;
}

export interface BidAnalyticsByDimension {
  wins: number;
  totalBids: number; // YGE actually bid
  rate: number;       // wins / totalBids
}

export interface BidAnalyticsInputs {
  bidResults: BidResult[];
  /** Map<jobId, projectType>. Missing entries roll into the "Other"
   *  bucket on the by-project-type breakdown. */
  projectTypeByJobId?: Map<string, string>;
  /** Map<jobId, ownerAgency>. */
  ownerAgencyByJobId?: Map<string, string>;
}

export function buildBidAnalytics(inputs: BidAnalyticsInputs): {
  rows: BidAnalyticsRow[];
  summary: BidAnalyticsSummary;
} {
  const { bidResults, projectTypeByJobId, ownerAgencyByJobId } = inputs;
  const rows: BidAnalyticsRow[] = [];

  for (const r of bidResults) {
    const sorted = [...r.bidders].sort((a, b) => a.amountCents - b.amountCents);
    const yge = sorted.find((b) => b.isYge) ?? null;
    const winner = sorted[0] ?? null;
    const second = sorted[1] ?? null;

    const ygeRank = yge ? sorted.findIndex((b) => b === yge) + 1 : null;

    const spreadToWinnerCents =
      yge && winner ? yge.amountCents - winner.amountCents : null;
    const spreadToSecondCents = computeSpreadToSecond(yge, sorted);
    const spreadToEngineersEstimateCents =
      yge && r.engineersEstimateCents != null
        ? yge.amountCents - r.engineersEstimateCents
        : null;

    rows.push({
      jobId: r.jobId,
      bidOpenedAt: r.bidOpenedAt,
      outcome: r.outcome,
      ygeBidCents: yge?.amountCents ?? null,
      winnerBidCents: winner?.amountCents ?? null,
      secondPlaceBidCents: second?.amountCents ?? null,
      engineersEstimateCents: r.engineersEstimateCents ?? null,
      ygeRank,
      bidderCount: sorted.length,
      spreadToWinnerCents,
      spreadToSecondCents,
      spreadToEngineersEstimateCents,
    });
  }

  // Sort newest first so analytics tables read most-recent-on-top.
  rows.sort((a, b) => b.bidOpenedAt.localeCompare(a.bidOpenedAt));

  // ---- summary --------------------------------------------------

  const ygeBidRows = rows.filter((r) => r.ygeBidCents != null);
  const decided = ygeBidRows.filter((r) => r.outcome !== 'TBD');
  const wonRows = ygeBidRows.filter((r) => r.outcome === 'WON_BY_YGE');
  const lostRows = ygeBidRows.filter((r) => r.outcome === 'WON_BY_OTHER');

  const winRate =
    decided.length === 0 ? 0 : wonRows.length / decided.length;

  const avgLossSpreadCents = mean(
    lostRows
      .map((r) => r.spreadToWinnerCents)
      .filter((n): n is number => n != null && n > 0),
  );
  const avgWinCushionCents = mean(
    wonRows
      .map((r) => r.spreadToSecondCents)
      // For a YGE win, spreadToSecond is negative (we beat 2nd by N).
      // Flip sign so a positive number = "left $X on the table."
      .filter((n): n is number => n != null)
      .map((n) => -n),
  );
  const avgYgeVsEngineersEstimateCents = mean(
    ygeBidRows
      .map((r) => r.spreadToEngineersEstimateCents)
      .filter((n): n is number => n != null),
  );

  const byProjectType = breakdown(
    rows,
    projectTypeByJobId,
  );
  const byOwnerAgency = breakdown(rows, ownerAgencyByJobId);

  return {
    rows,
    summary: {
      bidsConsidered: rows.length,
      ygeBidCount: ygeBidRows.length,
      ygeWonCount: wonRows.length,
      winRate,
      avgLossSpreadCents,
      avgWinCushionCents,
      avgYgeVsEngineersEstimateCents,
      byProjectType,
      byOwnerAgency,
    },
  };
}

/** Spread between YGE and the next-lowest non-YGE bidder. Positive
 *  when YGE is over that bidder; negative when YGE is under. */
function computeSpreadToSecond(
  yge: BidResultBidder | null,
  sorted: BidResultBidder[],
): number | null {
  if (!yge) return null;
  // Find the next-lowest bidder that ISN'T YGE.
  const ygeIdx = sorted.findIndex((b) => b === yge);
  let neighbor: BidResultBidder | null = null;
  if (ygeIdx === 0) {
    // YGE is low — neighbor is whoever's at index 1.
    neighbor = sorted[1] ?? null;
  } else {
    // YGE is not low — neighbor is the lowest non-YGE bidder, which
    // is sorted[0] when sorted[0] isn't YGE (always true here).
    neighbor = sorted[0] ?? null;
  }
  if (!neighbor) return null;
  return yge.amountCents - neighbor.amountCents;
}

function breakdown(
  rows: BidAnalyticsRow[],
  byJob: Map<string, string> | undefined,
): Map<string, BidAnalyticsByDimension> {
  const out = new Map<string, BidAnalyticsByDimension>();
  if (!byJob) return out;

  for (const r of rows) {
    if (r.ygeBidCents == null) continue;
    if (r.outcome === 'TBD') continue;
    const key = byJob.get(r.jobId) ?? 'Other';
    const cur = out.get(key) ?? { wins: 0, totalBids: 0, rate: 0 };
    cur.totalBids += 1;
    if (r.outcome === 'WON_BY_YGE') cur.wins += 1;
    cur.rate = cur.wins / cur.totalBids;
    out.set(key, cur);
  }

  return out;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return Math.round(sum / xs.length);
}
