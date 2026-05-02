// Competitor profiles rolled up from the public bid-tab corpus.
//
// Sibling of competitor-frequency.ts, which rolls up YGE's own
// BidResult records. This module reads the broader BidTab corpus
// (jobs YGE didn't even bid) so the picture covers the whole local
// market: who shows up, where, how often, at what dollar range.
//
// Pure derivation; no persisted records.

import type { BidTab, BidTabBidder } from './bid-tab';

export interface CompetitorProfileRow {
  /** Canonical key (lowercased, suffix-stripped) — matches the
   *  nameNormalized field on BidTabBidder. */
  nameNormalized: string;
  /** Most-frequent verbatim spelling across the corpus, for display. */
  displayName: string;
  /** Bid tabs this competitor appeared on. */
  appearances: number;
  /** Tabs where they were the apparent low (rank 1). */
  apparentLowCount: number;
  /** Tabs where the agency went on to award them. */
  awardCount: number;
  /** Avg / min / max bid amount across appearances. Cents. */
  avgBidCents: number;
  minBidCents: number;
  maxBidCents: number;
  /** Avg rank (1.0 = always low; 5.0 = typically 5th-place bidder). */
  avgRank: number;
  /** Top 5 agencies they show up at, by appearance count. */
  topAgencies: Array<{ agencyName: string; count: number }>;
  /** Top 5 counties they work in, by appearance count. */
  topCounties: Array<{ county: string; count: number }>;
  /** Date range they've been active (yyyy-mm-dd). */
  firstSeenAt: string;
  lastSeenAt: string;
  /** Ever flagged DBE / SBE on any tab. */
  everDbe: boolean;
  everSbe: boolean;
  /** Withdrew on any tab; rejected on any tab. */
  everWithdrawn: boolean;
  everRejected: boolean;
  /** CSLB license seen on any tab (last non-empty). */
  cslbLicense?: string;
  dirRegistration?: string;
}

export interface CompetitorProfilesRollup {
  /** Total tabs the rollup walked. */
  tabsConsidered: number;
  uniqueCompetitors: number;
  /** Total bidder appearances summed across the corpus. */
  totalAppearances: number;
}

export interface CompetitorProfilesResult {
  rollup: CompetitorProfilesRollup;
  rows: CompetitorProfileRow[];
}

interface Acc {
  nameNormalized: string;
  displayCounts: Map<string, number>;
  appearances: number;
  apparentLow: number;
  awards: number;
  totalCents: number;
  minCents: number;
  maxCents: number;
  rankSum: number;
  agencyCounts: Map<string, number>;
  countyCounts: Map<string, number>;
  firstSeen: string;
  lastSeen: string;
  everDbe: boolean;
  everSbe: boolean;
  everWithdrawn: boolean;
  everRejected: boolean;
  cslbLicense?: string;
  dirRegistration?: string;
}

function bumpMap(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}

function topN(m: Map<string, number>, n: number): Array<{ key: string; count: number }> {
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key))
    .slice(0, n);
}

function pickMostFrequent(m: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [key, count] of m.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Roll up competitor profiles from a list of bid tabs.
 *
 * @param tabs The bid tabs to consider (all imported tabs).
 * @param minAppearances Minimum appearances to surface. Default 1.
 */
export function buildCompetitorProfilesFromTabs(
  tabs: BidTab[],
  minAppearances = 1,
): CompetitorProfilesResult {
  const accs = new Map<string, Acc>();
  let totalAppearances = 0;

  for (const tab of tabs) {
    const day = tab.bidOpenedAt.slice(0, 10);
    for (const b of tab.bidders) {
      const key = b.nameNormalized;
      if (!key) continue;
      let a = accs.get(key);
      if (!a) {
        a = {
          nameNormalized: key,
          displayCounts: new Map(),
          appearances: 0,
          apparentLow: 0,
          awards: 0,
          totalCents: 0,
          minCents: Number.POSITIVE_INFINITY,
          maxCents: 0,
          rankSum: 0,
          agencyCounts: new Map(),
          countyCounts: new Map(),
          firstSeen: day,
          lastSeen: day,
          everDbe: false,
          everSbe: false,
          everWithdrawn: false,
          everRejected: false,
        };
        accs.set(key, a);
      }
      a.appearances += 1;
      totalAppearances += 1;
      bumpMap(a.displayCounts, b.name);
      if (b.rank === 1) a.apparentLow += 1;
      if (b.awardedTo) a.awards += 1;
      a.totalCents += b.totalCents;
      if (b.totalCents < a.minCents) a.minCents = b.totalCents;
      if (b.totalCents > a.maxCents) a.maxCents = b.totalCents;
      a.rankSum += b.rank;
      bumpMap(a.agencyCounts, tab.agencyName);
      if (tab.county) bumpMap(a.countyCounts, tab.county);
      if (day < a.firstSeen) a.firstSeen = day;
      if (day > a.lastSeen) a.lastSeen = day;
      if (b.dbe) a.everDbe = true;
      if (b.sbe) a.everSbe = true;
      if (b.withdrawn) a.everWithdrawn = true;
      if (b.rejected) a.everRejected = true;
      if (b.cslbLicense) a.cslbLicense = b.cslbLicense;
      if (b.dirRegistration) a.dirRegistration = b.dirRegistration;
    }
  }

  const rows: CompetitorProfileRow[] = [];
  for (const a of accs.values()) {
    if (a.appearances < minAppearances) continue;
    rows.push({
      nameNormalized: a.nameNormalized,
      displayName: pickMostFrequent(a.displayCounts) || a.nameNormalized,
      appearances: a.appearances,
      apparentLowCount: a.apparentLow,
      awardCount: a.awards,
      avgBidCents: a.appearances > 0 ? Math.round(a.totalCents / a.appearances) : 0,
      minBidCents: Number.isFinite(a.minCents) ? a.minCents : 0,
      maxBidCents: a.maxCents,
      avgRank: a.appearances > 0 ? a.rankSum / a.appearances : 0,
      topAgencies: topN(a.agencyCounts, 5).map((e) => ({ agencyName: e.key, count: e.count })),
      topCounties: topN(a.countyCounts, 5).map((e) => ({ county: e.key, count: e.count })),
      firstSeenAt: a.firstSeen,
      lastSeenAt: a.lastSeen,
      everDbe: a.everDbe,
      everSbe: a.everSbe,
      everWithdrawn: a.everWithdrawn,
      everRejected: a.everRejected,
      cslbLicense: a.cslbLicense,
      dirRegistration: a.dirRegistration,
    });
  }

  rows.sort((a, b) => (b.appearances - a.appearances) || a.displayName.localeCompare(b.displayName));

  return {
    rollup: {
      tabsConsidered: tabs.length,
      uniqueCompetitors: rows.length,
      totalAppearances,
    },
    rows,
  };
}
