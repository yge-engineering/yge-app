// Bid result — agency-posted tabulation for a job we bid on.
//
// One BidResult per (job, bid-open event). Multiple results per job are
// rare but possible — agencies sometimes re-bid after rejecting all
// bids; storing each as its own row preserves the history.
//
// Pursuit-intel use cases:
//   - "What's our win rate this quarter?"
//   - "Where did we place against competitor X over the last year?"
//   - "What's the spread between low bid and engineer's estimate on
//     drainage projects?"
//
// Posting a result with awardedTo = 'YGE' should advance the linked
// Job's status to AWARDED; any other winner advances to LOST. That side
// effect lives in the API route, not in this pure-data module.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

/** A single bidder line on the agency's tabulation. */
export const BidResultBidderSchema = z.object({
  /** Company / contractor name as printed on the tab. Free-form so we
   *  can preserve spelling for later cross-referencing. */
  bidderName: z.string().min(1).max(200),
  /** Their submitted total in cents. */
  amountCents: z.number().int().nonnegative(),
  /** True iff this bidder is YGE. Lets the rollup math compute our
   *  rank + delta-to-winner without string-matching the name. */
  isYge: z.boolean().default(false),
  /** Free-form note. e.g. 'Apparent low — not yet verified', 'DBE',
   *  'Hometown shop, never lost a Caltrans Region 2 bid in 5 years'. */
  notes: z.string().max(2_000).optional(),
});
export type BidResultBidder = z.infer<typeof BidResultBidderSchema>;

/** Outcome buckets. */
export const BidOutcomeSchema = z.enum([
  'WON_BY_YGE',
  'WON_BY_OTHER',
  'NO_AWARD',         // agency rejected all bids
  'TBD',              // bids opened, not yet awarded
]);
export type BidOutcome = z.infer<typeof BidOutcomeSchema>;

export const BidResultSchema = z.object({
  /** Stable id of the form `bid-result-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** The job this result is for. */
  jobId: z.string().min(1).max(120),
  /** Date the bids were opened (yyyy-mm-dd). */
  bidOpenedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Optional date the contract was awarded (later than bidOpenedAt). */
  awardedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Agency-published bid tabulation URL, when available. */
  bidTabulationUrl: z.string().max(800).optional(),

  outcome: BidOutcomeSchema.default('TBD'),
  /** Engineer's estimate / agency budget, when published. Used for the
   *  delta-to-engineer's-estimate math. */
  engineersEstimateCents: z.number().int().nonnegative().optional(),

  /** All bidders, sorted ascending by amountCents. The ordering is
   *  preserved by the helper sortBidders() — never trust input order. */
  bidders: z.array(BidResultBidderSchema).default([]),

  /** Free-form pursuit-intel notes — what to remember for next time. */
  notes: z.string().max(10_000).optional(),
});
export type BidResult = z.infer<typeof BidResultSchema>;

export const BidResultCreateSchema = BidResultSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  bidders: z.array(BidResultBidderSchema).optional(),
  outcome: BidOutcomeSchema.optional(),
});
export type BidResultCreate = z.infer<typeof BidResultCreateSchema>;

export const BidResultPatchSchema = BidResultCreateSchema.partial();
export type BidResultPatch = z.infer<typeof BidResultPatchSchema>;

// ---- Pure helpers --------------------------------------------------------

/** Ascending sort by bid amount (low bid first). Stable for ties. */
export function sortBidders(bidders: BidResultBidder[]): BidResultBidder[] {
  return [...bidders].sort((a, b) => a.amountCents - b.amountCents);
}

/** What did YGE bid on this job? Undefined when YGE didn't bid (or the
 *  isYge flag isn't set on any row). */
export function ygeBid(result: Pick<BidResult, 'bidders'>): BidResultBidder | undefined {
  return result.bidders.find((b) => b.isYge);
}

/** Where did YGE finish? 1-indexed rank in the sorted list. Undefined
 *  when YGE didn't bid. */
export function ygeRank(result: Pick<BidResult, 'bidders'>): number | undefined {
  const sorted = sortBidders(result.bidders);
  const idx = sorted.findIndex((b) => b.isYge);
  return idx >= 0 ? idx + 1 : undefined;
}

/** Cents amount of the winning bid (i.e. the lowest bid). Undefined when
 *  there are no bidders on file. */
export function winningAmountCents(result: Pick<BidResult, 'bidders'>): number | undefined {
  const sorted = sortBidders(result.bidders);
  return sorted[0]?.amountCents;
}

/** YGE bid minus winning bid. Negative when YGE *was* the winner.
 *  Undefined when YGE didn't bid. */
export function ygeDeltaToWinnerCents(result: Pick<BidResult, 'bidders'>): number | undefined {
  const yge = ygeBid(result);
  const win = winningAmountCents(result);
  if (yge === undefined || win === undefined) return undefined;
  return yge.amountCents - win;
}

/** YGE bid minus engineer's estimate. Positive = YGE bid above the
 *  agency's budget; negative = YGE bid under. Undefined when either is
 *  missing. */
export function ygeDeltaToEngineerEstimateCents(
  result: Pick<BidResult, 'bidders' | 'engineersEstimateCents'>,
): number | undefined {
  if (result.engineersEstimateCents === undefined) return undefined;
  const yge = ygeBid(result);
  if (yge === undefined) return undefined;
  return yge.amountCents - result.engineersEstimateCents;
}

// ---- Multi-result rollup -------------------------------------------------

export interface BidResultRollup {
  /** How many results we've recorded YGE bids on. */
  bidsTracked: number;
  wins: number;
  losses: number;
  noAward: number;
  tbd: number;
  /** wins / (wins + losses), rounded to 0.001. NaN-safe (returns 0 when
   *  no completed results). */
  winRate: number;
  /** Average finishing position (1 = first). Excludes TBD + no-award
   *  results. NaN-safe. */
  averageRank: number;
  /** How often YGE has been the apparent low bidder, regardless of
   *  whether the contract was eventually awarded to us. */
  apparentLowCount: number;
  /** Per-bidder stats, sorted by appearance count desc. Useful for
   *  'who do we lose to most often'. */
  competitorAppearances: Array<{ bidderName: string; appearances: number; wins: number }>;
}

export function computeBidResultRollup(results: BidResult[]): BidResultRollup {
  let bidsTracked = 0;
  let wins = 0;
  let losses = 0;
  let noAward = 0;
  let tbd = 0;
  let apparentLowCount = 0;
  const ranks: number[] = [];
  const compMap = new Map<string, { appearances: number; wins: number }>();

  for (const r of results) {
    const ygeIn = ygeBid(r) !== undefined;
    if (!ygeIn) continue;
    bidsTracked += 1;
    const rank = ygeRank(r);
    if (rank !== undefined) ranks.push(rank);
    if (rank === 1) apparentLowCount += 1;

    switch (r.outcome) {
      case 'WON_BY_YGE': wins += 1; break;
      case 'WON_BY_OTHER': losses += 1; break;
      case 'NO_AWARD': noAward += 1; break;
      case 'TBD': tbd += 1; break;
    }

    // Competitor appearances + their wins.
    for (const bidder of r.bidders) {
      if (bidder.isYge) continue;
      const cur = compMap.get(bidder.bidderName) ?? { appearances: 0, wins: 0 };
      cur.appearances += 1;
      compMap.set(bidder.bidderName, cur);
    }
    if (r.outcome === 'WON_BY_OTHER') {
      const winningName = sortBidders(r.bidders)[0]?.bidderName;
      if (winningName) {
        const cur = compMap.get(winningName) ?? { appearances: 0, wins: 0 };
        cur.wins += 1;
        compMap.set(winningName, cur);
      }
    }
  }

  const decided = wins + losses;
  const winRate =
    decided > 0 ? Math.round((wins / decided) * 1000) / 1000 : 0;
  const averageRank =
    ranks.length > 0
      ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 100) /
        100
      : 0;
  const competitorAppearances = Array.from(compMap.entries())
    .map(([bidderName, v]) => ({ bidderName, ...v }))
    .sort((a, b) => b.appearances - a.appearances);

  return {
    bidsTracked,
    wins,
    losses,
    noAward,
    tbd,
    winRate,
    averageRank,
    apparentLowCount,
    competitorAppearances,
  };
}

// ---- Display helpers + id ------------------------------------------------

export function bidOutcomeLabel(o: BidOutcome, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `bidOutcome.${o}`);
}

export function newBidResultId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `bid-result-${hex.padStart(8, '0')}`;
}
