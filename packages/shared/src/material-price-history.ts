// Material unit-price history tracker.
//
// Plain English: AP line items carry a description + unitPriceCents.
// Over a year, the same item ("3/4-in. drain rock", "#4 rebar 20-ft")
// shows up dozens of times at slightly different prices. Walking
// that history surfaces creep — a 22% jump in rebar pricing between
// last quarter and this one means the next bid needs to use the new
// number, not last year's.
//
// Pure derivation. No persisted records.
//
// Bucket key: normalized description (lowercased + collapsed
// whitespace + punctuation stripped). Caller can override to use
// costCode for tighter grouping when their AP coding is clean.

import type { ApInvoice } from './ap-invoice';

export type PriceTrend = 'STABLE' | 'RISING' | 'FALLING' | 'VOLATILE';

export interface MaterialPriceRow {
  /** Stable bucket key — the normalized description used for grouping. */
  key: string;
  /** Display description: most-frequent raw variant. */
  description: string;
  costCode?: string;
  /** Number of AP line items in the bucket. */
  observations: number;
  /** Earliest invoiceDate seen. */
  firstSeenOn: string;
  /** Latest invoiceDate seen. */
  lastSeenOn: string;
  /** Mean unitPriceCents across all observations (weighted by line). */
  meanUnitPriceCents: number;
  /** Min unit price seen. */
  minUnitPriceCents: number;
  /** Max unit price seen. */
  maxUnitPriceCents: number;
  /** Most recent unit price seen (latest invoiceDate; ties → max). */
  latestUnitPriceCents: number;
  /** First unit price seen. */
  firstUnitPriceCents: number;

  /** (latest - first) / first. 0 when first == 0. */
  totalChangeRate: number;
  /** (latest - mean) / mean. Detects current-vs-historical anomaly. */
  recentDeltaFromMean: number;
  trend: PriceTrend;
}

export interface MaterialPriceHistoryRollup {
  totalKeys: number;
  rising: number;
  falling: number;
  volatile: number;
  stable: number;
}

export interface MaterialPriceHistoryInputs {
  apInvoices: ApInvoice[];
  /** When true, group by costCode when present (and fall back to
   *  description otherwise). Default: false (group by description). */
  groupByCostCode?: boolean;
  /** Required minimum observations to classify trend. Below this,
   *  always STABLE. Default: 3. */
  minObservationsForTrend?: number;
}

export function buildMaterialPriceHistory(
  inputs: MaterialPriceHistoryInputs,
): { rows: MaterialPriceRow[]; rollup: MaterialPriceHistoryRollup } {
  const groupByCostCode = inputs.groupByCostCode === true;
  const minObs = inputs.minObservationsForTrend ?? 3;

  type Bucket = {
    key: string;
    descCounts: Map<string, number>;
    costCode?: string;
    observations: number;
    samples: Array<{ date: string; price: number }>;
    sumPrice: number;
    minPrice: number;
    maxPrice: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    for (const line of inv.lineItems ?? []) {
      const desc = line.description?.trim();
      if (!desc) continue;
      if (!Number.isFinite(line.unitPriceCents) || line.unitPriceCents <= 0) {
        continue;
      }
      const key = groupByCostCode && line.costCode
        ? `cc:${line.costCode.trim().toLowerCase()}`
        : `d:${normalize(desc)}`;
      const b =
        buckets.get(key) ??
        ({
          key,
          descCounts: new Map<string, number>(),
          costCode: line.costCode,
          observations: 0,
          samples: [],
          sumPrice: 0,
          minPrice: Number.POSITIVE_INFINITY,
          maxPrice: 0,
        } as Bucket);
      b.descCounts.set(desc, (b.descCounts.get(desc) ?? 0) + 1);
      if (line.costCode) b.costCode = line.costCode;
      b.observations += 1;
      b.samples.push({ date: inv.invoiceDate, price: line.unitPriceCents });
      b.sumPrice += line.unitPriceCents;
      if (line.unitPriceCents < b.minPrice) b.minPrice = line.unitPriceCents;
      if (line.unitPriceCents > b.maxPrice) b.maxPrice = line.unitPriceCents;
      buckets.set(key, b);
    }
  }

  const rows: MaterialPriceRow[] = [];
  for (const [, b] of buckets) {
    if (b.samples.length === 0) continue;
    // Sort samples by date for first/latest.
    const sorted = b.samples.slice().sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0]!;
    const latest = sorted[sorted.length - 1]!;

    // Pick most-frequent description as display.
    let bestDesc = '';
    let bestCount = 0;
    for (const [d, count] of b.descCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestDesc = d;
      }
    }

    const mean = Math.round(b.sumPrice / b.samples.length);
    const totalChangeRate =
      first.price === 0 ? 0 : (latest.price - first.price) / first.price;
    const recentDeltaFromMean =
      mean === 0 ? 0 : (latest.price - mean) / mean;

    let trend: PriceTrend = 'STABLE';
    if (b.samples.length >= minObs) {
      const range = b.maxPrice - b.minPrice;
      const meanForVolatility = mean || 1;
      const volatilityRatio = range / meanForVolatility;
      if (volatilityRatio > 0.5) trend = 'VOLATILE';
      else if (totalChangeRate > 0.1) trend = 'RISING';
      else if (totalChangeRate < -0.1) trend = 'FALLING';
    }

    rows.push({
      key: b.key,
      description: bestDesc,
      costCode: b.costCode,
      observations: b.observations,
      firstSeenOn: first.date,
      lastSeenOn: latest.date,
      meanUnitPriceCents: mean,
      minUnitPriceCents: b.minPrice,
      maxUnitPriceCents: b.maxPrice,
      latestUnitPriceCents: latest.price,
      firstUnitPriceCents: first.price,
      totalChangeRate: round4(totalChangeRate),
      recentDeltaFromMean: round4(recentDeltaFromMean),
      trend,
    });
  }

  // Sort: highest recentDeltaFromMean first (most recent price hike
  // relative to history). Descending.
  rows.sort((a, b) => b.recentDeltaFromMean - a.recentDeltaFromMean);

  let rising = 0;
  let falling = 0;
  let volatile = 0;
  let stable = 0;
  for (const r of rows) {
    if (r.trend === 'RISING') rising += 1;
    else if (r.trend === 'FALLING') falling += 1;
    else if (r.trend === 'VOLATILE') volatile += 1;
    else stable += 1;
  }

  return {
    rows,
    rollup: {
      totalKeys: rows.length,
      rising,
      falling,
      volatile,
      stable,
    },
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,'"`/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
