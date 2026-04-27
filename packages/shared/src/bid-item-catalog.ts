// Bid-item history catalog.
//
// Plain English: every priced estimate has a long list of bid items
// — "Class 2 base, 4-inch, TON", "asphalt patch, SY", "12-inch HDPE,
// LF". Across years of bidding, the same items show up over and
// over. This walks all priced estimates the user supplies and
// groups bid items by normalized description so the estimator can
// look up "what did we price 12-inch HDPE at the last 5 times?"
//
// Outputs:
//   - count of times the item appeared
//   - min / median / max unit price (cents)
//   - total quantity bid across history
//   - distinct units seen (data-quality flag — "12-inch HDPE" priced
//     in LF on three jobs and EA on one is a typo)
//
// Pure derivation. No persisted records.

import type { PricedEstimate } from './priced-estimate';

export interface BidItemCatalogRow {
  /** Normalized description used for grouping. */
  normalizedDescription: string;
  /** Display description (the most-recent encountered casing). */
  description: string;
  /** Most common unit observed (mode). */
  primaryUnit: string;
  /** Distinct unit strings seen (drives data-quality flag). */
  unitsSeen: string[];
  appearances: number;
  /** Sum of quantity across appearances (only when units agree). */
  totalQuantityIfUnitsAgree: number;
  /** Cents — min/median/max across appearances with a price set. */
  minUnitPriceCents: number | null;
  medianUnitPriceCents: number | null;
  maxUnitPriceCents: number | null;
  /** Number of appearances with unitPriceCents set (vs unpriced drafts). */
  pricedAppearances: number;
}

export interface BidItemCatalogRollup {
  estimatesConsidered: number;
  itemsConsidered: number;
  uniqueDescriptions: number;
}

export interface BidItemCatalogInputs {
  estimates: Pick<PricedEstimate, 'id' | 'bidItems'>[];
  /** Optional minimum appearances for a row to surface. Default 1. */
  minAppearances?: number;
}

export function buildBidItemCatalog(
  inputs: BidItemCatalogInputs,
): {
  rollup: BidItemCatalogRollup;
  rows: BidItemCatalogRow[];
} {
  const minAppearances = inputs.minAppearances ?? 1;

  type Bucket = {
    normalized: string;
    description: string; // last-seen casing
    unitCounts: Map<string, number>;
    appearances: number;
    quantitySum: number;
    quantityHasMixedUnits: boolean;
    prices: number[];
    pricedAppearances: number;
  };
  const buckets = new Map<string, Bucket>();
  let itemsConsidered = 0;

  for (const est of inputs.estimates) {
    for (const item of est.bidItems ?? []) {
      itemsConsidered += 1;
      const norm = normalize(item.description);
      if (norm === '') continue;
      const b = buckets.get(norm) ?? {
        normalized: norm,
        description: item.description.trim(),
        unitCounts: new Map<string, number>(),
        appearances: 0,
        quantitySum: 0,
        quantityHasMixedUnits: false,
        prices: [],
        pricedAppearances: 0,
      };
      b.appearances += 1;
      b.description = item.description.trim();

      const unitKey = item.unit.trim().toUpperCase();
      const prevPrimary = pickPrimaryUnit(b.unitCounts);
      b.unitCounts.set(unitKey, (b.unitCounts.get(unitKey) ?? 0) + 1);
      const newPrimary = pickPrimaryUnit(b.unitCounts);
      if (b.unitCounts.size > 1) b.quantityHasMixedUnits = true;
      // Only sum quantity when this unit matches the dominant one.
      if (unitKey === newPrimary || prevPrimary === unitKey) {
        b.quantitySum += item.quantity;
      }

      if (item.unitPriceCents !== null && item.unitPriceCents !== undefined) {
        b.prices.push(item.unitPriceCents);
        b.pricedAppearances += 1;
      }

      buckets.set(norm, b);
    }
  }

  const rows: BidItemCatalogRow[] = [];
  for (const b of buckets.values()) {
    if (b.appearances < minAppearances) continue;

    const sortedPrices = [...b.prices].sort((a, b) => a - b);
    const min = sortedPrices.length > 0 ? sortedPrices[0]! : null;
    const max =
      sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1]! : null;
    const median =
      sortedPrices.length === 0 ? null : computeMedian(sortedPrices);

    rows.push({
      normalizedDescription: b.normalized,
      description: b.description,
      primaryUnit: pickPrimaryUnit(b.unitCounts),
      unitsSeen: Array.from(b.unitCounts.keys()).sort(),
      appearances: b.appearances,
      totalQuantityIfUnitsAgree: b.quantityHasMixedUnits ? 0 : b.quantitySum,
      minUnitPriceCents: min,
      medianUnitPriceCents: median,
      maxUnitPriceCents: max,
      pricedAppearances: b.pricedAppearances,
    });
  }

  // Most-frequent first.
  rows.sort((a, b) => b.appearances - a.appearances);

  return {
    rollup: {
      estimatesConsidered: inputs.estimates.length,
      itemsConsidered,
      uniqueDescriptions: rows.length,
    },
    rows,
  };
}

function pickPrimaryUnit(unitCounts: Map<string, number>): string {
  let best = '';
  let bestN = -1;
  for (const [u, n] of unitCounts.entries()) {
    if (n > bestN) {
      best = u;
      bestN = n;
    }
  }
  return best;
}

function computeMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
