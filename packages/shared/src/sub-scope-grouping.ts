// Sub-bid scope grouping.
//
// Plain English: when an estimate has multiple sub bids that cover
// similar scopes ("paving", "striping", "AC milling"), the bid
// reviewer wants a quick view of total sub-spend per scope. This
// rolls subBids on a priced estimate by normalized portionOfWork.
//
// Pure derivation. No persisted records.

import type { PricedEstimate } from './priced-estimate';
import type { SubBid } from './sub-bid';

export interface SubScopeRow {
  scope: string;
  /** Display version (most-frequent raw casing of the scope text). */
  displayScope: string;
  subCount: number;
  totalCents: number;
  subs: Array<{ subId: string; contractorName: string; bidAmountCents: number }>;
}

export interface SubScopeReport {
  estimateId: string;
  totalSubCents: number;
  rows: SubScopeRow[];
}

export interface SubScopeInputs {
  estimate: Pick<PricedEstimate, 'id' | 'subBids'>;
}

export function buildSubScopeReport(inputs: SubScopeInputs): SubScopeReport {
  const subs = inputs.estimate.subBids ?? [];

  type Bucket = {
    scope: string;
    rawCounts: Map<string, number>;
    subCount: number;
    totalCents: number;
    subs: Array<{ subId: string; contractorName: string; bidAmountCents: number }>;
  };
  const byScope = new Map<string, Bucket>();
  let totalSubCents = 0;

  for (const s of subs as SubBid[]) {
    const raw = s.portionOfWork.trim();
    const key = normalize(raw);
    if (!key) continue;
    const b =
      byScope.get(key) ??
      ({
        scope: key,
        rawCounts: new Map<string, number>(),
        subCount: 0,
        totalCents: 0,
        subs: [],
      } as Bucket);
    b.rawCounts.set(raw, (b.rawCounts.get(raw) ?? 0) + 1);
    b.subCount += 1;
    b.totalCents += s.bidAmountCents;
    b.subs.push({
      subId: s.id,
      contractorName: s.contractorName,
      bidAmountCents: s.bidAmountCents,
    });
    byScope.set(key, b);
    totalSubCents += s.bidAmountCents;
  }

  const rows: SubScopeRow[] = [];
  for (const [, b] of byScope) {
    let bestRaw = '';
    let bestCount = 0;
    for (const [raw, count] of b.rawCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestRaw = raw;
      }
    }
    b.subs.sort((a, b) => b.bidAmountCents - a.bidAmountCents);
    rows.push({
      scope: b.scope,
      displayScope: bestRaw,
      subCount: b.subCount,
      totalCents: b.totalCents,
      subs: b.subs,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    estimateId: inputs.estimate.id,
    totalSubCents,
    rows,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
