// Coverage for the bid-line unit-price rounding helper.

import { describe, it, expect } from 'vitest';
import { roundBidLines } from './bid-line-rounding';
import type { PricedEstimate, PricedBidItem } from './priced-estimate';

function item(over: Partial<PricedBidItem>): PricedBidItem {
  return {
    itemNumber: '1',
    description: 'Mob',
    unit: 'LS',
    quantity: 1,
    confidence: 'HIGH',
    unitPriceCents: 0,
    ...over,
  };
}

const baseEstimate: PricedEstimate = {
  id: 'est-test-1',
  fromDraftId: 'draft-test-1',
  jobId: 'job-test-1',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  projectName: 'Test',
  projectType: 'ROAD_RECONSTRUCTION',
  bidItems: [],
  oppPercent: 0.2,
  subBids: [],
  subLeveling: [],
  addenda: [],
};

describe('roundBidLines', () => {
  it('rounds to the nearest $5 by default', () => {
    const est: PricedEstimate = {
      ...baseEstimate,
      bidItems: [
        item({ itemNumber: '1', unitPriceCents: 1234 }), // $12.34 → $12.35
        item({ itemNumber: '2', unitPriceCents: 1267 }), // $12.67 → $12.65
        item({ itemNumber: '3', unitPriceCents: 1250 }), // $12.50 → $12.50 (no change)
      ],
    };
    const r = roundBidLines({ estimate: est, incrementCents: 5 });
    expect(r.items[0]!.unitPriceCents).toBe(1235);
    expect(r.items[1]!.unitPriceCents).toBe(1265);
    expect(r.items[2]!.unitPriceCents).toBe(1250);
    // Only items 1 + 2 changed.
    expect(r.diffs.map((d) => d.itemNumber)).toEqual(['1', '2']);
    expect(r.totalDeltaCents).toBe(1 - 2); // +1 from #1, -2 from #2 = -1
  });

  it('rounds UP when direction = UP', () => {
    const est: PricedEstimate = {
      ...baseEstimate,
      bidItems: [
        item({ itemNumber: '1', unitPriceCents: 1234 }), // $12.34 → $12.35
      ],
    };
    const r = roundBidLines({ estimate: est, incrementCents: 5, direction: 'UP' });
    expect(r.items[0]!.unitPriceCents).toBe(1235);
  });

  it('rounds DOWN when direction = DOWN', () => {
    const est: PricedEstimate = {
      ...baseEstimate,
      bidItems: [
        item({ itemNumber: '1', unitPriceCents: 1234 }), // $12.34 → $12.30
      ],
    };
    const r = roundBidLines({ estimate: est, incrementCents: 5, direction: 'DOWN' });
    expect(r.items[0]!.unitPriceCents).toBe(1230);
  });

  it('skips items with null unitPriceCents', () => {
    const est: PricedEstimate = {
      ...baseEstimate,
      bidItems: [
        item({ itemNumber: '1', unitPriceCents: null }),
        item({ itemNumber: '2', unitPriceCents: 1234 }),
      ],
    };
    const r = roundBidLines({ estimate: est, incrementCents: 5 });
    expect(r.items[0]!.unitPriceCents).toBeNull();
    expect(r.items[1]!.unitPriceCents).toBe(1235);
  });

  it('rounds to nearest $10', () => {
    const est: PricedEstimate = {
      ...baseEstimate,
      bidItems: [
        item({ itemNumber: '1', unitPriceCents: 12_34 }), // $12.34 → $10
        item({ itemNumber: '2', unitPriceCents: 15_67 }), // $15.67 → $20
      ],
    };
    const r = roundBidLines({ estimate: est, incrementCents: 1000 });
    expect(r.items[0]!.unitPriceCents).toBe(1000);
    expect(r.items[1]!.unitPriceCents).toBe(2000);
  });

  it('throws on a non-positive increment', () => {
    expect(() =>
      roundBidLines({ estimate: baseEstimate, incrementCents: 0 }),
    ).toThrow();
    expect(() =>
      roundBidLines({ estimate: baseEstimate, incrementCents: -5 }),
    ).toThrow();
  });

  it('returns an empty diff list when nothing changes', () => {
    const est: PricedEstimate = {
      ...baseEstimate,
      bidItems: [
        item({ itemNumber: '1', unitPriceCents: 5000 }),
        item({ itemNumber: '2', unitPriceCents: 1000 }),
      ],
    };
    const r = roundBidLines({ estimate: est, incrementCents: 500 });
    expect(r.diffs).toEqual([]);
    expect(r.totalDeltaCents).toBe(0);
  });
});
