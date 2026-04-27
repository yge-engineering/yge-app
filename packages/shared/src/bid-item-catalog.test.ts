import { describe, expect, it } from 'vitest';

import type { PricedBidItem, PricedEstimate } from './priced-estimate';

import { buildBidItemCatalog } from './bid-item-catalog';

function item(over: Partial<PricedBidItem>): PricedBidItem {
  return {
    itemNumber: '1',
    description: 'Class 2 Aggregate Base, 4-inch',
    unit: 'TON',
    quantity: 100,
    confidence: 'HIGH',
    unitPriceCents: 25_00,
    ...over,
  } as PricedBidItem;
}

function est(
  id: string,
  bidItems: PricedBidItem[],
): Pick<PricedEstimate, 'id' | 'bidItems'> {
  return { id, bidItems };
}

describe('buildBidItemCatalog', () => {
  it('groups identical descriptions across estimates', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ description: 'Class 2 Base, 4-inch', unitPriceCents: 25_00 })]),
        est('e2', [item({ description: 'Class 2 Base, 4-inch', unitPriceCents: 27_00 })]),
        est('e3', [item({ description: 'Class 2 Base, 4-inch', unitPriceCents: 30_00 })]),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.appearances).toBe(3);
  });

  it('case-insensitively collapses descriptions', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ description: 'CLASS 2 BASE' })]),
        est('e2', [item({ description: 'class 2 base' })]),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes min / median / max unit price', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ unitPriceCents: 10_00 })]),
        est('e2', [item({ unitPriceCents: 30_00 })]),
        est('e3', [item({ unitPriceCents: 20_00 })]),
      ],
    });
    expect(r.rows[0]?.minUnitPriceCents).toBe(10_00);
    expect(r.rows[0]?.medianUnitPriceCents).toBe(20_00);
    expect(r.rows[0]?.maxUnitPriceCents).toBe(30_00);
  });

  it('returns null prices when no priced appearances', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ unitPriceCents: null })]),
      ],
    });
    expect(r.rows[0]?.minUnitPriceCents).toBe(null);
    expect(r.rows[0]?.medianUnitPriceCents).toBe(null);
    expect(r.rows[0]?.maxUnitPriceCents).toBe(null);
    expect(r.rows[0]?.pricedAppearances).toBe(0);
  });

  it('sums quantity when units agree', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ unit: 'TON', quantity: 100 })]),
        est('e2', [item({ unit: 'TON', quantity: 250 })]),
      ],
    });
    expect(r.rows[0]?.totalQuantityIfUnitsAgree).toBe(350);
    expect(r.rows[0]?.unitsSeen).toEqual(['TON']);
  });

  it('zeroes total quantity when units mismatch (data-quality flag)', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ unit: 'TON', quantity: 100 })]),
        est('e2', [item({ unit: 'CY', quantity: 50 })]),
      ],
    });
    expect(r.rows[0]?.totalQuantityIfUnitsAgree).toBe(0);
    expect(r.rows[0]?.unitsSeen).toEqual(['CY', 'TON']);
  });

  it('picks the most-frequent unit as primaryUnit', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ unit: 'TON' })]),
        est('e2', [item({ unit: 'TON' })]),
        est('e3', [item({ unit: 'CY' })]),
      ],
    });
    expect(r.rows[0]?.primaryUnit).toBe('TON');
  });

  it('respects minAppearances filter', () => {
    const r = buildBidItemCatalog({
      minAppearances: 2,
      estimates: [
        est('e1', [item({ description: 'Common', unitPriceCents: 100_00 })]),
        est('e2', [item({ description: 'Common', unitPriceCents: 110_00 })]),
        est('e3', [item({ description: 'One-off', unitPriceCents: 99_00 })]),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.description).toBe('Common');
  });

  it('rolls up estimate + item counts', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ description: 'A' }), item({ description: 'B' })]),
        est('e2', [item({ description: 'A' })]),
      ],
    });
    expect(r.rollup.estimatesConsidered).toBe(2);
    expect(r.rollup.itemsConsidered).toBe(3);
    expect(r.rollup.uniqueDescriptions).toBe(2);
  });

  it('sorts most frequent first', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [
          item({ description: 'common' }),
          item({ description: 'common' }),
          item({ description: 'rare' }),
        ]),
        est('e2', [item({ description: 'common' })]),
      ],
    });
    expect(r.rows[0]?.description).toBe('common');
    expect(r.rows[0]?.appearances).toBe(3);
    expect(r.rows[1]?.description).toBe('rare');
  });

  it('computes median for even-count price lists as integer cents', () => {
    const r = buildBidItemCatalog({
      estimates: [
        est('e1', [item({ unitPriceCents: 100 })]),
        est('e2', [item({ unitPriceCents: 200 })]),
      ],
    });
    expect(r.rows[0]?.medianUnitPriceCents).toBe(150);
  });
});
