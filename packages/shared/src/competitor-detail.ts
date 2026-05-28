// Competitor detail — per-bidder rollup across all bid results.
//
// Plain English: given a competitor name (e.g. "Ford Construction"),
// walks every BidResult tab YGE recorded and reports head-to-head
// stats with that competitor. Drives /bid-results/competitor-detail
// — the page that's been "coming soon" since the bid-results module
// shipped.
//
// What it tells you:
//   - How often did we see this contractor on the same tab as YGE
//   - How often did they win those tabs
//   - How often did WE win those tabs
//   - Their median gap to YGE (positive = they were lower)
//   - Their biggest win + biggest loss against us
//   - Which agencies they show up on most
//   - Lifetime $ awarded to them on tabs we also bid
//
// Pure derivation. No I/O. Tests live next door.

import type { BidResult, BidResultBidder } from './bid-result';

export interface CompetitorAgencyAppearance {
  /** Agency name as stored on the BidResult (free-form). */
  agency: string;
  appearances: number;
  /** How many of those they won. */
  wins: number;
}

export interface CompetitorHeadToHead {
  /** The bid result they shared with YGE. */
  bidResultId: string;
  jobId: string;
  bidOpenedAt: string;
  /** Their amount in cents. */
  theirAmountCents: number;
  /** YGE amount in cents. */
  ygeAmountCents: number;
  /** theirAmount - ygeAmount, in cents. Negative = competitor was
   *  lower than YGE. */
  gapCents: number;
  /** Who actually won this tab. */
  outcome: BidResult['outcome'];
}

export interface CompetitorDetailSummary {
  /** Echoed back so the page can render the title. */
  bidderName: string;
  /** Total times this bidder showed up on any tab. */
  appearances: number;
  /** Tabs they won outright. */
  wins: number;
  /** Tabs where both they AND YGE appeared. */
  headToHeadCount: number;
  /** Of the head-to-head tabs, how many they won. */
  headToHeadTheyWon: number;
  /** Of the head-to-head tabs, how many YGE won. */
  headToHeadYgeWon: number;
  /** Median gap (their amount minus YGE amount) across head-to-head
   *  tabs, in cents. Negative = they were typically lower than YGE. */
  medianGapCents: number;
  /** Their biggest win amount in cents (across all tabs). */
  biggestWinCents: number;
  /** Their average winning amount in cents (0 when no wins). */
  averageWinCents: number;
  /** Lifetime $ won across every tab in the dataset. */
  totalWonCents: number;
  /** Per-agency rollup, sorted by appearance count desc. */
  byAgency: CompetitorAgencyAppearance[];
  /** Head-to-head encounters with YGE, most recent first. */
  headToHead: CompetitorHeadToHead[];
  /** ISO date of the most recent tab they appeared on, or null. */
  lastSeenAt: string | null;
}

// ---- internal helpers ----------------------------------------------------

/** Normalize a name for matching — lowercase, trim, collapse whitespace. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findBidder(
  bidders: ReadonlyArray<BidResultBidder>,
  predicate: (b: BidResultBidder) => boolean,
): BidResultBidder | undefined {
  return bidders.find(predicate);
}

function median(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

// ---- public --------------------------------------------------------------

/** Compute a per-competitor rollup from the full bid result set.
 *  Case-insensitive match on bidderName + collapses whitespace so
 *  "Ford Construction" matches "ford  construction" too. */
export function summarizeCompetitor(
  bidderName: string,
  bidResults: ReadonlyArray<BidResult>,
  agencyResolver?: (result: BidResult) => string,
): CompetitorDetailSummary {
  const target = normalize(bidderName);

  let appearances = 0;
  let wins = 0;
  let totalWonCents = 0;
  const winsForAverage: number[] = [];
  const gapsHeadToHead: number[] = [];
  const headToHead: CompetitorHeadToHead[] = [];
  const byAgencyMap = new Map<string, { appearances: number; wins: number }>();
  let lastSeenAt: string | null = null;
  let biggestWinCents = 0;
  let headToHeadTheyWon = 0;
  let headToHeadYgeWon = 0;

  for (const r of bidResults) {
    const them = findBidder(r.bidders, (b) => normalize(b.bidderName) === target);
    if (!them) continue;

    appearances += 1;
    if (!lastSeenAt || r.bidOpenedAt > lastSeenAt) lastSeenAt = r.bidOpenedAt;

    const agency = agencyResolver ? agencyResolver(r) : '—';
    const existing = byAgencyMap.get(agency) ?? { appearances: 0, wins: 0 };
    existing.appearances += 1;
    byAgencyMap.set(agency, existing);

    const wonTheTab =
      r.outcome === 'WON_BY_OTHER' &&
      r.bidders.length > 0 &&
      normalize(r.bidders[0]!.bidderName) === target;
    if (wonTheTab) {
      wins += 1;
      totalWonCents += them.amountCents;
      winsForAverage.push(them.amountCents);
      if (them.amountCents > biggestWinCents) biggestWinCents = them.amountCents;
      const ag = byAgencyMap.get(agency)!;
      ag.wins += 1;
    }

    const yge = findBidder(r.bidders, (b) => b.isYge);
    if (yge) {
      const gap = them.amountCents - yge.amountCents;
      gapsHeadToHead.push(gap);
      headToHead.push({
        bidResultId: r.id,
        jobId: r.jobId,
        bidOpenedAt: r.bidOpenedAt,
        theirAmountCents: them.amountCents,
        ygeAmountCents: yge.amountCents,
        gapCents: gap,
        outcome: r.outcome,
      });
      if (wonTheTab) headToHeadTheyWon += 1;
      if (r.outcome === 'WON_BY_YGE') headToHeadYgeWon += 1;
    }
  }

  headToHead.sort((a, b) => (a.bidOpenedAt < b.bidOpenedAt ? 1 : -1));

  const byAgency: CompetitorAgencyAppearance[] = Array.from(byAgencyMap.entries())
    .map(([agency, v]) => ({ agency, appearances: v.appearances, wins: v.wins }))
    .sort((a, b) => b.appearances - a.appearances);

  const averageWinCents =
    winsForAverage.length === 0
      ? 0
      : Math.round(
          winsForAverage.reduce((s, x) => s + x, 0) / winsForAverage.length,
        );

  return {
    bidderName,
    appearances,
    wins,
    headToHeadCount: headToHead.length,
    headToHeadTheyWon,
    headToHeadYgeWon,
    medianGapCents: median(gapsHeadToHead),
    biggestWinCents,
    averageWinCents,
    totalWonCents,
    byAgency,
    headToHead,
    lastSeenAt,
  };
}
