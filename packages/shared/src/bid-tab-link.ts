// Bid-tab → YGE BidResult auto cross-link.
//
// When a bid tab is imported and YGE was on the bidder list, we
// want the BidTab.ygeJobId / BidTab.ygeBidResultId fields wired to
// the matching internal BidResult so:
//   - The competitor head-to-head math knows YGE was in the bid
//   - /bid-tabs/[id] can deep-link back to the YGE BidResult
//   - The 'we lost this one' email writes itself with both rows
//
// Match strategy (cheap to expensive):
//   1. Same projectNumber + bidOpenedAt match
//   2. Same projectName (case-insensitive) + bidOpenedAt match
//   3. projectName starts-with another (a Caltrans tab's project
//      name is sometimes "01-2H8804 — SR-299 paving" while the
//      YGE BidResult is "SR-299 paving"). bidOpenedAt still must
//      match within ±1 day to avoid false positives.
//
// Pure derivation; no IO. The store calls this on create with the
// fresh tab + the existing BidResult collection and writes the
// returned IDs into the persisted row.

import type { BidResult } from './bid-result';
import type { BidTab } from './bid-tab';
import { normalizeCompanyName } from './bid-tab';

/** Normalized name the matcher uses to detect YGE on a bidder
 *  list. Override via env / config when packaged for another
 *  tenant — multi-tenant from day one means YGE-specific strings
 *  shouldn't be hardcoded into the store. */
export const YGE_NORMALIZED_NAME_DEFAULT = normalizeCompanyName('Young General Engineering Inc');

export interface BidTabYgeLinkInputs {
  tab: BidTab;
  bidResults: BidResult[];
  /** Override the bidder-name-canonical key. */
  ygeNormalizedName?: string;
}

export interface BidTabYgeLinkResult {
  /** True iff YGE appears in the tab's bidder list. */
  ygeWasBidder: boolean;
  /** Best-match BidResult.id when one was found. Null otherwise. */
  matchedBidResultId: string | null;
  /** Best-match BidResult.jobId when one was found. Null otherwise. */
  matchedJobId: string | null;
  /** Which strategy fired ('projectNumber' / 'projectName' /
   *  'projectNamePrefix' / null when no match). */
  matchStrategy: 'projectNumber' | 'projectName' | 'projectNamePrefix' | null;
}

function withinOneDay(a: string, b: string): boolean {
  const ad = new Date(a + (a.includes('T') ? '' : 'T00:00:00Z')).getTime();
  const bd = new Date(b + (b.includes('T') ? '' : 'T00:00:00Z')).getTime();
  if (!Number.isFinite(ad) || !Number.isFinite(bd)) return false;
  return Math.abs(ad - bd) <= 24 * 60 * 60 * 1000;
}

function normalizeProjectName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function linkYgeOnImport(inputs: BidTabYgeLinkInputs): BidTabYgeLinkResult {
  const { tab, bidResults } = inputs;
  const ygeKey = inputs.ygeNormalizedName ?? YGE_NORMALIZED_NAME_DEFAULT;
  const ygeOnTab = tab.bidders.some((b) => b.nameNormalized === ygeKey);
  if (!ygeOnTab) {
    return {
      ygeWasBidder: false,
      matchedBidResultId: null,
      matchedJobId: null,
      matchStrategy: null,
    };
  }

  const candidates = bidResults.filter((r) => withinOneDay(r.bidOpenedAt, tab.bidOpenedAt));

  // 1. Match by projectNumber when both sides have it.
  if (tab.projectNumber) {
    const tnum = tab.projectNumber.trim().toLowerCase();
    const byNumber = candidates.find((r) => {
      // BidResult doesn't carry a projectNumber field directly; the
      // YGE Job's projectNumber lives on the Job record. The
      // BidResult schema does have projectNumber-shaped fields under
      // jobId; until the store joins them, fall back to
      // projectName matching here.
      const candidateNum =
        (r as unknown as { projectNumber?: string }).projectNumber ?? null;
      return candidateNum && candidateNum.toLowerCase() === tnum;
    });
    if (byNumber) {
      return {
        ygeWasBidder: true,
        matchedBidResultId: byNumber.id,
        matchedJobId: byNumber.jobId,
        matchStrategy: 'projectNumber',
      };
    }
  }

  // 2. Match by exact projectName.
  const tabName = normalizeProjectName(tab.projectName);
  const byName = candidates.find((r) => {
    const rn = normalizeProjectName(
      (r as unknown as { projectName?: string }).projectName ?? '',
    );
    return rn.length > 0 && rn === tabName;
  });
  if (byName) {
    return {
      ygeWasBidder: true,
      matchedBidResultId: byName.id,
      matchedJobId: byName.jobId,
      matchStrategy: 'projectName',
    };
  }

  // 3. Match by name starts-with (longer name contains the shorter).
  const byPrefix = candidates.find((r) => {
    const rn = normalizeProjectName(
      (r as unknown as { projectName?: string }).projectName ?? '',
    );
    if (rn.length < 6) return false;
    return tabName.includes(rn) || rn.includes(tabName);
  });
  if (byPrefix) {
    return {
      ygeWasBidder: true,
      matchedBidResultId: byPrefix.id,
      matchedJobId: byPrefix.jobId,
      matchStrategy: 'projectNamePrefix',
    };
  }

  return {
    ygeWasBidder: true,
    matchedBidResultId: null,
    matchedJobId: null,
    matchStrategy: null,
  };
}
