// Head-to-head stats: a competitor against YGE, computed from the
// public bid-tab corpus. A 'head-to-head' = a tab on which both
// the competitor AND YGE appeared as bidders.
//
// What it answers: 'how have we matched up with Granite?'. The
// estimator reads the win/loss + average overshoot before pricing
// the next bid against that contractor.

import type { BidTab } from './bid-tab';
import { YGE_NORMALIZED_NAME_DEFAULT } from './bid-tab-link';

export interface HeadToHeadStats {
  /** Number of tabs both YGE and the competitor appeared on. */
  events: number;
  /** Of those, where YGE was lower (rank-wise). */
  ygeLowerCount: number;
  /** Of those, where the competitor was lower. */
  competitorLowerCount: number;
  /** Of those, where YGE was the apparent low (rank=1). */
  ygeApparentLowCount: number;
  /** Of those, where the competitor was the apparent low. */
  competitorApparentLowCount: number;
  /** Of those, where the agency awarded YGE. */
  ygeAwardedCount: number;
  /** Of those, where the agency awarded the competitor. */
  competitorAwardedCount: number;
  /** Average dollar delta between YGE and competitor bid. Positive
   *  = YGE bid HIGHER than the competitor on average; negative =
   *  YGE was lower on average. */
  avgYgeMinusCompetitorCents: number;
  /** Average percentage delta = (yge − comp) / comp. */
  avgYgeMinusCompetitorPct: number;
  /** First and last open dates the head-to-head covered. */
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface HeadToHeadInputs {
  tabs: BidTab[];
  /** The competitor's nameNormalized key. */
  competitorNameNormalized: string;
  /** Override for non-YGE tenants. Defaults to the canonical YGE key. */
  ygeNormalizedName?: string;
}

const EMPTY: HeadToHeadStats = {
  events: 0,
  ygeLowerCount: 0,
  competitorLowerCount: 0,
  ygeApparentLowCount: 0,
  competitorApparentLowCount: 0,
  ygeAwardedCount: 0,
  competitorAwardedCount: 0,
  avgYgeMinusCompetitorCents: 0,
  avgYgeMinusCompetitorPct: 0,
  firstSeenAt: null,
  lastSeenAt: null,
};

export function computeHeadToHead(inputs: HeadToHeadInputs): HeadToHeadStats {
  const ygeKey = inputs.ygeNormalizedName ?? YGE_NORMALIZED_NAME_DEFAULT;
  const compKey = inputs.competitorNameNormalized;
  if (!compKey || compKey === ygeKey) return EMPTY;

  let events = 0;
  let ygeLower = 0;
  let compLower = 0;
  let ygeAppLow = 0;
  let compAppLow = 0;
  let ygeAwarded = 0;
  let compAwarded = 0;
  let dollarSum = 0;
  let pctSum = 0;
  let pctCount = 0;
  let first: string | null = null;
  let last: string | null = null;

  for (const tab of inputs.tabs) {
    const ygeRow = tab.bidders.find((b) => b.nameNormalized === ygeKey);
    const compRow = tab.bidders.find((b) => b.nameNormalized === compKey);
    if (!ygeRow || !compRow) continue;
    events += 1;
    if (ygeRow.rank < compRow.rank) ygeLower += 1;
    else if (compRow.rank < ygeRow.rank) compLower += 1;
    if (ygeRow.rank === 1) ygeAppLow += 1;
    if (compRow.rank === 1) compAppLow += 1;
    if (ygeRow.awardedTo) ygeAwarded += 1;
    if (compRow.awardedTo) compAwarded += 1;
    dollarSum += ygeRow.totalCents - compRow.totalCents;
    if (compRow.totalCents > 0) {
      pctSum += (ygeRow.totalCents - compRow.totalCents) / compRow.totalCents;
      pctCount += 1;
    }
    const day = tab.bidOpenedAt.slice(0, 10);
    if (!first || day < first) first = day;
    if (!last || day > last) last = day;
  }

  if (events === 0) return EMPTY;

  return {
    events,
    ygeLowerCount: ygeLower,
    competitorLowerCount: compLower,
    ygeApparentLowCount: ygeAppLow,
    competitorApparentLowCount: compAppLow,
    ygeAwardedCount: ygeAwarded,
    competitorAwardedCount: compAwarded,
    avgYgeMinusCompetitorCents: Math.round(dollarSum / events),
    avgYgeMinusCompetitorPct: pctCount > 0 ? pctSum / pctCount : 0,
    firstSeenAt: first,
    lastSeenAt: last,
  };
}
