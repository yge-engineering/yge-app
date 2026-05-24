// Coverage for the optional pricing fields added in plans-to-estimate@1.1.0.
// The bid-total rollup helper must (a) handle drafts with no prices, (b) sum
// only the lines that have prices, and (c) survive a mix of priced and
// unpriced lines without throwing.

import { describe, expect, it } from 'vitest';
import {
  PtoEBidItemSchema,
  PtoEOutputSchema,
  sumPtoEBidTotalCents,
  type PtoEBidItem,
} from './plans-to-estimate-output';

describe('PtoEBidItemSchema', () => {
  it('accepts a priced item with all the new fields', () => {
    const parsed = PtoEBidItemSchema.parse({
      itemNumber: '12',
      description: 'Class 2 aggregate base, 6" compacted',
      unit: 'TON',
      quantity: 1200,
      confidence: 'MEDIUM',
      estimatedUnitPriceCents: 4250, // $42.50/ton
      estimatedLineTotalCents: 1200 * 4250,
      priceSourceConfidence: 'MEDIUM',
      priceSourceNote: 'Caltrans 2024-2026 D2 avg + 20% O&P',
    });
    expect(parsed.estimatedUnitPriceCents).toBe(4250);
    expect(parsed.estimatedLineTotalCents).toBe(5_100_000);
  });

  it('accepts an unpriced item (legacy + T&M)', () => {
    const parsed = PtoEBidItemSchema.parse({
      itemNumber: '99',
      description: 'Unforeseen subgrade — T&M',
      unit: 'LS',
      quantity: 1,
      confidence: 'LOW',
    });
    expect(parsed.estimatedUnitPriceCents).toBeUndefined();
    expect(parsed.estimatedLineTotalCents).toBeUndefined();
  });

  it('rejects negative unit prices', () => {
    const result = PtoEBidItemSchema.safeParse({
      itemNumber: '1',
      description: 'Bad',
      unit: 'EA',
      quantity: 1,
      confidence: 'HIGH',
      estimatedUnitPriceCents: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe('PtoEOutputSchema', () => {
  it('accepts estimatedBidTotalCents at the top level', () => {
    const parsed = PtoEOutputSchema.parse({
      projectName: 'Hwy 36 shoulder rehab',
      projectType: 'ROAD_RECONSTRUCTION',
      bidItems: [
        {
          itemNumber: '1',
          description: 'Mobilization',
          unit: 'LS',
          quantity: 1,
          confidence: 'HIGH',
          estimatedUnitPriceCents: 5_000_000,
          estimatedLineTotalCents: 5_000_000,
        },
      ],
      overallConfidence: 'MEDIUM',
      estimatedBidTotalCents: 5_000_000,
    });
    expect(parsed.estimatedBidTotalCents).toBe(5_000_000);
    // Defaults still fire for assumptions / questionsForEstimator when omitted.
    expect(parsed.assumptions).toEqual([]);
    expect(parsed.questionsForEstimator).toEqual([]);
  });
});

describe('sumPtoEBidTotalCents', () => {
  function item(opts: Partial<PtoEBidItem> = {}): PtoEBidItem {
    return {
      itemNumber: '1',
      description: 'Item',
      unit: 'EA',
      quantity: 1,
      confidence: 'HIGH',
      ...opts,
    };
  }

  it('returns 0 for an empty list', () => {
    expect(sumPtoEBidTotalCents([])).toBe(0);
  });

  it('returns 0 when no items have a line total', () => {
    expect(
      sumPtoEBidTotalCents([item(), item({ itemNumber: '2' })]),
    ).toBe(0);
  });

  it('sums only the items that carry an estimatedLineTotalCents', () => {
    const total = sumPtoEBidTotalCents([
      item({ estimatedLineTotalCents: 1_000 }),
      item({ itemNumber: '2' }),                          // unpriced — ignored
      item({ itemNumber: '3', estimatedLineTotalCents: 250 }),
    ]);
    expect(total).toBe(1_250);
  });
});
