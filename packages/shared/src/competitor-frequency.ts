// Competitor frequency tracker.
//
// Plain English: every public-works bid tab posted by the agency
// names every bidder that submitted. Across years of bids, the
// same handful of contractors show up over and over — the local
// market. Knowing who they are and how they price tells YGE
// where it's competitive vs where it's leaving money on the
// table or chasing the wrong agency.
//
// Walks BidResult records, groups bidders by normalized name,
// and for each:
//   - bids appeared on
//   - wins (this competitor took the job)
//   - avg + min + max bid
//   - average position (1 = low) when both YGE and the competitor
//     were in the same bid
//   - YGE win/loss against this competitor in head-to-head
//
// Pure derivation. No persisted records.

import type { BidResult } from './bid-result';

export interface CompetitorRow {
  competitorName: string;
  /** Bids this competitor appeared on (any outcome). */
  bidsAppeared: number;
  /** Bids where this competitor was the winner. */
  winsByCompetitor: number;
  /** Average bid amount (cents) across appearances. */
  avgBidCents: number;
  minBidCents: number;
  maxBidCents: number;
  /** Average rank (1 = low) across appearances. */
  avgRank: number;
  /** Head-to-head bids: both YGE and this competitor appeared. */
  headToHeadCount: number;
  /** Out of headToHeadCount, the count where YGE was lower (won
   *  the position even if not awarded). */
  ygeLowerCount: number;
  /** Out of headToHeadCount, where this competitor took the job. */
  competitorWinsHeadToHead: number;
}

export interface CompetitorRollup {
  bidResultsConsidered: number;
  uniqueCompetitors: number;
}

export interface CompetitorFrequencyInputs {
  bidResults: BidResult[];
  /** Min appearances to surface. Default 1. */
  minAppearances?: number;
}

export function buildCompetitorFrequency(
  inputs: CompetitorFrequencyInputs,
): {
  rollup: CompetitorRollup;
  rows: CompetitorRow[];
} {
  const minAppearances = inputs.minAppearances ?? 1;

  type Bucket = {
    name: string;
    bidsAppeared: number;
    winsByCompetitor: number;
    sumBid: number;
    minBid: number;
    maxBid: number;
    rankSum: number;
    headToHead: number;
    ygeLower: number;
    competitorWonHeadToHead: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const result of inputs.bidResults) {
    if (!result.bidders || result.bidders.length === 0) continue;
    // Sort ascending so rank = position + 1.
    const sortedBidders = [...result.bidders].sort(
      (a, b) => a.amountCents - b.amountCents,
    );
    const ygeBidder = sortedBidders.find((b) => b.isYge) ?? null;
    const winner = sortedBidders[0];

    sortedBidders.forEach((b, i) => {
      if (b.isYge) return; // skip YGE for the "competitor" rollup
      const key = normalize(b.bidderName);
      if (key === '') return;
      const bucket = buckets.get(key) ?? {
        name: b.bidderName.trim(),
        bidsAppeared: 0,
        winsByCompetitor: 0,
        sumBid: 0,
        minBid: b.amountCents,
        maxBid: b.amountCents,
        rankSum: 0,
        headToHead: 0,
        ygeLower: 0,
        competitorWonHeadToHead: 0,
      };
      bucket.bidsAppeared += 1;
      bucket.sumBid += b.amountCents;
      if (b.amountCents < bucket.minBid) bucket.minBid = b.amountCents;
      if (b.amountCents > bucket.maxBid) bucket.maxBid = b.amountCents;
      bucket.rankSum += i + 1;
      const wonByThis = winner === b && result.outcome === 'WON_BY_OTHER';
      if (wonByThis) bucket.winsByCompetitor += 1;
      if (ygeBidder) {
        bucket.headToHead += 1;
        if (ygeBidder.amountCents < b.amountCents) bucket.ygeLower += 1;
        if (wonByThis) bucket.competitorWonHeadToHead += 1;
      }
      buckets.set(key, bucket);
    });
  }

  const rows: CompetitorRow[] = [];
  for (const b of buckets.values()) {
    if (b.bidsAppeared < minAppearances) continue;
    rows.push({
      competitorName: b.name,
      bidsAppeared: b.bidsAppeared,
      winsByCompetitor: b.winsByCompetitor,
      avgBidCents: Math.round(b.sumBid / b.bidsAppeared),
      minBidCents: b.minBid,
      maxBidCents: b.maxBid,
      avgRank: round2(b.rankSum / b.bidsAppeared),
      headToHeadCount: b.headToHead,
      ygeLowerCount: b.ygeLower,
      competitorWinsHeadToHead: b.competitorWonHeadToHead,
    });
  }

  rows.sort((a, b) => b.bidsAppeared - a.bidsAppeared);

  return {
    rollup: {
      bidResultsConsidered: inputs.bidResults.length,
      uniqueCompetitors: rows.length,
    },
    rows,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
