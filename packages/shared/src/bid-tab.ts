// Bid tab — the agency-posted tabulation of bids on a public-works
// project. Two-purpose data:
//
//   1. The corpus the natural-language search engine runs across.
//      "Find every Caltrans Region 2 paving job under $5M opened in
//      2025 where Granite was the apparent low" — that's a query
//      against this collection.
//   2. The raw input for per-competitor profiles. Roll the tabs up by
//      bidder name and you get win rate, average overshoot vs. low,
//      agencies the competitor shows up at, frequency vs. YGE.
//
// Scope vs. bid-result.ts:
//   - bid-result.ts is YGE's own win/loss log — one row per bid YGE
//     submitted. It's where the post-bid debrief gets typed.
//   - bid-tab.ts is the broader public dataset YGE only sometimes
//     bids on. Most rows here are not YGE bids — they are the rest
//     of the market. The two collections cross-reference by jobId
//     when YGE was a bidder, which lets the per-competitor profile
//     compute "bids head-to-head with YGE."
//
// The scraper jobs (Caltrans BidExpress, Cal FIRE Cal eProcure,
// county portals) live elsewhere; this module is the canonical
// shape they write to + the read-side helpers everything else
// queries.

import { z } from 'zod';

// ---- Source taxonomy ----------------------------------------------------

/** Where this tab came from. Drives the per-agency scraper logic and
 *  shows up as a chip in the search UI. Every value here corresponds
 *  to a scraper module in the pipeline package. */
export const BidTabSourceSchema = z.enum([
  'CALTRANS',
  'CAL_FIRE',
  'CA_STATE_PARKS',
  'CA_DGS',          // Department of General Services state contracts
  'COUNTY',          // any California county portal
  'CITY',            // any California city portal
  'WATER_DISTRICT',
  'SCHOOL_DISTRICT',
  'TRANSIT',
  'FEDERAL_FHWA',
  'OTHER',
]);
export type BidTabSource = z.infer<typeof BidTabSourceSchema>;

/** What kind of contract owner posted the bid. Independent of source
 *  (a CA_DGS source can post a STATE contract; a COUNTY source can
 *  post on behalf of a city sub-division). */
export const BidTabOwnerTypeSchema = z.enum([
  'STATE',
  'FEDERAL',
  'COUNTY',
  'CITY',
  'SPECIAL_DISTRICT',
  'TRIBAL',
  'JOINT_POWERS',
  'OTHER_PUBLIC',
]);
export type BidTabOwnerType = z.infer<typeof BidTabOwnerTypeSchema>;

// ---- One bidder line on the tab -----------------------------------------

export const BidTabBidderSchema = z.object({
  /** Apparent rank at bid open. 1 = apparent low. Required because
   *  agencies post tabs in rank order; downstream math depends on it. */
  rank: z.number().int().positive(),
  /** Verbatim from the tab — preserves spelling for forensic
   *  cross-reference. The normalized form lives in `nameNormalized`. */
  name: z.string().min(1).max(200),
  /** Lowercased, punctuation-stripped, suffixes-removed (Inc / LLC /
   *  Corp / Co / The / Construction / Inc.) — the key the
   *  per-competitor profile rolls up by. Computed by
   *  `normalizeCompanyName`. */
  nameNormalized: z.string().min(1).max(200),
  /** Bid amount in cents. */
  totalCents: z.number().int().nonnegative(),
  /** Optional license / registration captured from the tab. */
  cslbLicense: z.string().max(40).optional(),
  dirRegistration: z.string().max(40).optional(),
  /** DBE / SBE / WBE / VBE flags as printed on the tab. */
  dbe: z.boolean().optional(),
  sbe: z.boolean().optional(),
  /** True for the apparent low that the agency went on to award. */
  awardedTo: z.boolean().optional(),
  /** Withdrew at bid open (bid bond pulled, math error apparent on
   *  the tab). */
  withdrawn: z.boolean().optional(),
  /** Agency rejected as non-responsive (missing addendum ack, missing
   *  sub list, late). */
  rejected: z.boolean().optional(),
  rejectionReason: z.string().max(500).optional(),
  /** Free-form note the scraper or estimator added. */
  notes: z.string().max(2000).optional(),
});
export type BidTabBidder = z.infer<typeof BidTabBidderSchema>;

// ---- The bid tab row ----------------------------------------------------

export const BidTabSchema = z.object({
  /** Stable id of the form `bidtab-<8hex>`. */
  id: z.string().min(1).max(80),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** The scraper run that produced this row. Lets the pipeline
   *  re-load + replace cleanly without orphaning. */
  scraperJobId: z.string().max(120).optional(),
  /** ISO timestamp the scrape ran. */
  scrapedAt: z.string(),
  /** Original public URL the tab was lifted from. */
  sourceUrl: z.string().url().max(800).optional(),

  source: BidTabSourceSchema,
  agencyName: z.string().min(1).max(200),
  ownerType: BidTabOwnerTypeSchema,

  /** Project name as the agency printed it. */
  projectName: z.string().min(1).max(400),
  /** Agency's project / contract / IFB number. Free-form across
   *  agencies — Caltrans calls it 'Contract', counties say 'Project
   *  No.', some only have a Bid #. */
  projectNumber: z.string().max(80).optional(),
  /** California county where the work is. Empty for federal /
   *  multi-county / unknown. */
  county: z.string().max(80).optional(),
  /** Two-letter state code. Defaults to 'CA'. */
  state: z.string().length(2).default('CA'),

  /** Engineer's estimate, when published. Cents. */
  engineersEstimateCents: z.number().int().nonnegative().optional(),

  /** ISO timestamp / yyyy-mm-dd. Required — without an open date,
   *  the row can't sort onto the timeline. */
  bidOpenedAt: z.string(),
  /** ISO date when the agency formally awarded. Optional because
   *  many awards happen weeks after open. */
  awardedAt: z.string().optional(),
  /** Apparent low at open vs. awarded — sometimes differs (apparent
   *  low rejected, second-low awarded). */
  awardedToBidderName: z.string().max(200).optional(),

  bidders: z.array(BidTabBidderSchema).min(1),

  /** Free-form scraper notes — pre-bid attendance count, addenda
   *  count, addenda due dates, anything the scraper can pluck off
   *  the page. Plain-English; the search engine indexes this. */
  notes: z.string().max(8000).optional(),

  /** When YGE bid this job, the cross-link back to YGE's own
   *  estimate / bid-result. Omitted otherwise (most rows). */
  ygeJobId: z.string().max(120).optional(),
  ygeBidResultId: z.string().max(120).optional(),
});
export type BidTab = z.infer<typeof BidTabSchema>;

export const BidTabCreateSchema = BidTabSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  state: z.string().length(2).optional(),
});
export type BidTabCreate = z.infer<typeof BidTabCreateSchema>;

// ---- Helpers ------------------------------------------------------------

export function newBidTabId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `bidtab-${hex.padStart(8, '0')}`;
}

/**
 * Canonicalize a company name for grouping. The key purpose:
 *   - 'Granite Construction Company, Inc.' and 'GRANITE CONSTRUCTION'
 *     and 'Granite Construction Co' should all roll up to the same
 *     competitor profile.
 *
 * Steps (in order):
 *   1. Lowercase.
 *   2. Strip the Unicode punctuation block — hyphens / commas /
 *      ampersands collapsing to a space, periods deleted.
 *   3. Drop common entity suffixes (inc / incorporated / llc /
 *      llp / lp / corp / corporation / co / company).
 *   4. Drop generic industry suffixes (construction / contractors /
 *      builders / engineering / engineers / contractor / inc.) when
 *      they appear at the end.
 *   5. Collapse repeated whitespace.
 *
 * The function is conservative — when in doubt, it leaves the
 * substring alone. That avoids "Granite Bay Construction" and
 * "Granite Construction" collapsing to the same profile.
 */
export function normalizeCompanyName(input: string): string {
  let s = input.toLowerCase().trim();
  // Drop content in trailing parens like "(prime)" or "(jv)".
  s = s.replace(/\(.*?\)\s*$/g, '');
  // Replace hyphens, commas, ampersands, slashes, periods with space.
  s = s.replace(/[.,&\-_/]+/g, ' ');
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();

  // Trim entity suffixes from the end. Apply repeatedly so
  // "ABC Construction Inc Corp" simplifies as
  // "ABC Construction" (stripping inc, then corp).
  const trailingDrops = [
    'incorporated',
    'inc',
    'llc',
    'l l c',
    'llp',
    'l l p',
    'lp',
    'l p',
    'corp',
    'corporation',
    'co',
    'company',
    'pllc',
    'pa',
    'pc',
  ];
  let dropped = true;
  while (dropped) {
    dropped = false;
    for (const sfx of trailingDrops) {
      const re = new RegExp(`\\s${sfx}$`);
      if (re.test(s)) {
        s = s.replace(re, '');
        dropped = true;
      }
    }
  }
  // One pass of generic-industry suffix trim — only at the very end.
  const industryDrops = ['construction', 'contractors', 'builders', 'contractor'];
  for (const sfx of industryDrops) {
    const re = new RegExp(`\\s${sfx}$`);
    if (re.test(s)) {
      s = s.replace(re, '');
      break;
    }
  }
  return s.trim();
}

/**
 * Per-competitor rollup across an arbitrary set of bid tabs. The set
 * is typically all tabs over a window the user is asking about
 * ("last 12 months in Caltrans Region 2"), filtered upstream and
 * passed in.
 */
export interface CompetitorProfile {
  nameNormalized: string;
  /** Most-frequent verbatim spelling — the display name on the
   *  profile card. */
  displayName: string;
  totalBids: number;
  totalWins: number;
  /** [0,1] — totalWins / totalBids. */
  winRate: number;
  /** Average rank across every bid (1 = won every time). */
  avgRank: number;
  /** Average % above the low bid on bids the competitor did NOT win.
   *  Higher number = consistently bidding higher than the apparent low. */
  avgPctOverLowOnLosses: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  agenciesSeen: string[];
  /** Bids YGE was also a bidder on. Computed via the row's
   *  `ygeJobId` link. */
  bidsAgainstYge: number;
  /** Of those, the count YGE won. */
  ygeWonAgainst: number;
}

export function buildCompetitorProfile(
  nameNormalized: string,
  tabs: BidTab[],
): CompetitorProfile | null {
  const matching: { tab: BidTab; bidder: BidTabBidder }[] = [];
  for (const t of tabs) {
    for (const b of t.bidders) {
      if (b.nameNormalized === nameNormalized) matching.push({ tab: t, bidder: b });
    }
  }
  if (matching.length === 0) return null;

  let totalWins = 0;
  let rankSum = 0;
  let pctOverLowSumOnLosses = 0;
  let lossesWithLow = 0;
  let firstSeenAt: string | null = null;
  let lastSeenAt: string | null = null;
  const displayCount = new Map<string, number>();
  const agencies = new Set<string>();
  let bidsAgainstYge = 0;
  let ygeWonAgainst = 0;

  for (const { tab, bidder } of matching) {
    if (bidder.awardedTo) totalWins += 1;
    rankSum += bidder.rank;
    if (!firstSeenAt || tab.bidOpenedAt < firstSeenAt) firstSeenAt = tab.bidOpenedAt;
    if (!lastSeenAt || tab.bidOpenedAt > lastSeenAt) lastSeenAt = tab.bidOpenedAt;
    displayCount.set(bidder.name, (displayCount.get(bidder.name) ?? 0) + 1);
    agencies.add(tab.agencyName);

    // % over low on losses: only meaningful when this competitor
    // didn't win and there's a low bid recorded.
    if (!bidder.awardedTo) {
      const low = tab.bidders.find((bb) => bb.rank === 1)?.totalCents;
      if (low && low > 0 && bidder.totalCents > low) {
        pctOverLowSumOnLosses += (bidder.totalCents - low) / low;
        lossesWithLow += 1;
      }
    }

    // YGE head-to-head: did this tab also have a YGE bidder?
    const ygeBid = tab.bidders.find((bb) => bb.nameNormalized === 'young general engineering' || bb.nameNormalized.startsWith('young general'));
    if (ygeBid) {
      bidsAgainstYge += 1;
      if (ygeBid.awardedTo) ygeWonAgainst += 1;
    }
  }

  const totalBids = matching.length;
  const winRate = totalBids === 0 ? 0 : totalWins / totalBids;
  const avgRank = totalBids === 0 ? 0 : rankSum / totalBids;
  const avgPctOverLowOnLosses = lossesWithLow === 0 ? 0 : pctOverLowSumOnLosses / lossesWithLow;

  // Pick the most-frequent verbatim spelling as displayName.
  let displayName = '';
  let bestCount = -1;
  for (const [name, c] of displayCount.entries()) {
    if (c > bestCount) { displayName = name; bestCount = c; }
  }

  return {
    nameNormalized,
    displayName,
    totalBids,
    totalWins,
    winRate,
    avgRank,
    avgPctOverLowOnLosses,
    firstSeenAt,
    lastSeenAt,
    agenciesSeen: Array.from(agencies).sort(),
    bidsAgainstYge,
    ygeWonAgainst,
  };
}

/**
 * Lightweight keyword search across a bid-tab corpus. Phase-1
 * placeholder — returns matches scored by simple field-weighted
 * substring hits. The natural-language layer (Claude turning a
 * query into structured filters) wraps this later.
 *
 * Field weights:
 *   - agencyName + projectName    weight 3
 *   - bidder name (any)           weight 2
 *   - county / project number     weight 2
 *   - notes                       weight 1
 */
export interface BidTabSearchHit {
  tab: BidTab;
  score: number;
  /** Human-readable reason hits fired — surfaces in the result list. */
  matches: string[];
}

export function searchBidTabs(
  query: string,
  tabs: BidTab[],
  opts?: { limit?: number },
): BidTabSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const limit = opts?.limit ?? 25;
  const out: BidTabSearchHit[] = [];

  for (const t of tabs) {
    let score = 0;
    const matches: string[] = [];
    if ((t.agencyName + ' ' + t.projectName).toLowerCase().includes(q)) {
      score += 3;
      matches.push(`project: ${t.projectName}`);
    }
    if (t.county && t.county.toLowerCase().includes(q)) {
      score += 2;
      matches.push(`county: ${t.county}`);
    }
    if (t.projectNumber && t.projectNumber.toLowerCase().includes(q)) {
      score += 2;
      matches.push(`project #${t.projectNumber}`);
    }
    for (const b of t.bidders) {
      if (b.name.toLowerCase().includes(q) || b.nameNormalized.includes(q)) {
        score += 2;
        matches.push(`bidder: ${b.name}`);
        break; // count once per tab
      }
    }
    if (t.notes && t.notes.toLowerCase().includes(q)) {
      score += 1;
      matches.push('notes');
    }
    if (score > 0) out.push({ tab: t, score, matches });
  }

  out.sort((a, b) => b.score - a.score
    || (a.tab.bidOpenedAt < b.tab.bidOpenedAt ? 1 : -1));
  return out.slice(0, limit);
}

export interface BidTabRollup {
  total: number;
  byAgency: Array<{ agencyName: string; count: number }>;
  bySource: Record<BidTabSource, number>;
  /** Most-recent bidOpenedAt across the set. */
  lastBidOpenedAt: string | null;
  /** Total dollar volume of all apparent-low winning bids in cents. */
  totalAwardedCents: number;
  /** Distinct competitor count (by nameNormalized). */
  distinctCompetitors: number;
}

export function computeBidTabRollup(tabs: BidTab[]): BidTabRollup {
  const byAgencyMap = new Map<string, number>();
  const bySource: Record<BidTabSource, number> = {
    CALTRANS: 0, CAL_FIRE: 0, CA_STATE_PARKS: 0, CA_DGS: 0,
    COUNTY: 0, CITY: 0, WATER_DISTRICT: 0, SCHOOL_DISTRICT: 0,
    TRANSIT: 0, FEDERAL_FHWA: 0, OTHER: 0,
  };
  const competitors = new Set<string>();
  let lastBidOpenedAt: string | null = null;
  let totalAwardedCents = 0;
  for (const t of tabs) {
    byAgencyMap.set(t.agencyName, (byAgencyMap.get(t.agencyName) ?? 0) + 1);
    bySource[t.source] += 1;
    if (!lastBidOpenedAt || t.bidOpenedAt > lastBidOpenedAt) lastBidOpenedAt = t.bidOpenedAt;
    const winner = t.bidders.find((b) => b.awardedTo) ?? t.bidders.find((b) => b.rank === 1);
    if (winner) totalAwardedCents += winner.totalCents;
    for (const b of t.bidders) competitors.add(b.nameNormalized);
  }
  return {
    total: tabs.length,
    byAgency: Array.from(byAgencyMap.entries())
      .map(([agencyName, count]) => ({ agencyName, count }))
      .sort((a, b) => b.count - a.count || a.agencyName.localeCompare(b.agencyName)),
    bySource,
    lastBidOpenedAt,
    totalAwardedCents,
    distinctCompetitors: competitors.size,
  };
}
