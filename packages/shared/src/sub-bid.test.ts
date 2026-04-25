import { describe, it, expect } from 'vitest';
import {
  PCC_4104_HIGHWAY_FLOOR_CENTS,
  classifySubBids,
  isHighwayClassProjectType,
  newSubBidId,
  pcc4104ThresholdCents,
  type SubBid,
} from './sub-bid';

function s(partial: Partial<SubBid>): SubBid {
  return {
    id: partial.id ?? 'sub-1',
    contractorName: partial.contractorName ?? 'Acme Trucking',
    portionOfWork: partial.portionOfWork ?? 'Hauling',
    bidAmountCents: partial.bidAmountCents ?? 0,
    ...partial,
  };
}

describe('isHighwayClassProjectType', () => {
  it('classifies road / drainage / grading / bridge as highway', () => {
    expect(isHighwayClassProjectType('ROAD_RECONSTRUCTION')).toBe(true);
    expect(isHighwayClassProjectType('BRIDGE')).toBe(true);
    expect(isHighwayClassProjectType('DRAINAGE')).toBe(true);
    expect(isHighwayClassProjectType('GRADING')).toBe(true);
  });
  it('classifies fuel reduction / other as non-highway', () => {
    expect(isHighwayClassProjectType('FIRE_FUEL_REDUCTION')).toBe(false);
    expect(isHighwayClassProjectType('OTHER')).toBe(false);
  });
});

describe('pcc4104ThresholdCents', () => {
  it('uses 0.5% of bid for non-highway projects', () => {
    // $200,000 bid → 0.5% = $1,000.00 = 100_000 cents
    expect(pcc4104ThresholdCents(200_000_00, 'OTHER')).toBe(1_000_00);
  });
  it('uses $10K floor for small highway bids', () => {
    // $200,000 highway bid → 0.5% = $1,000 but floor of $10,000 wins
    expect(pcc4104ThresholdCents(200_000_00, 'ROAD_RECONSTRUCTION')).toBe(
      PCC_4104_HIGHWAY_FLOOR_CENTS,
    );
  });
  it('uses 0.5% when 0.5% exceeds the highway floor', () => {
    // $10M highway bid → 0.5% = $50,000, well above the $10K floor
    expect(pcc4104ThresholdCents(10_000_000_00, 'BRIDGE')).toBe(50_000_00);
  });
  it('returns 0 for a $0 bid (degenerate but defined)', () => {
    expect(pcc4104ThresholdCents(0, 'OTHER')).toBe(0);
    // Highway floor still applies even at $0 bid
    expect(pcc4104ThresholdCents(0, 'ROAD_RECONSTRUCTION')).toBe(
      PCC_4104_HIGHWAY_FLOOR_CENTS,
    );
  });
});

describe('classifySubBids', () => {
  it('flags subs above threshold as must-list', () => {
    const subs = [
      s({ id: 'sub-1', bidAmountCents: 25_000_00 }),
      s({ id: 'sub-2', bidAmountCents: 5_000_00 }),
    ];
    // $1M road bid → highway threshold = max($5K, $10K) = $10K
    const out = classifySubBids(subs, 1_000_000_00, 'ROAD_RECONSTRUCTION');
    expect(out.thresholdCents).toBe(10_000_00);
    expect(out.mustList.map((x) => x.id)).toEqual(['sub-1']);
    expect(out.optional.map((x) => x.id)).toEqual(['sub-2']);
    expect(out.borderline).toEqual([]);
    expect(out.totalSubCents).toBe(30_000_00);
  });

  it('flags borderline subs within $1,000 of threshold', () => {
    const subs = [
      s({ id: 'sub-just-over', bidAmountCents: 10_500_00 }), // $500 over $10K
      s({ id: 'sub-just-under', bidAmountCents: 9_200_00 }), // $800 under $10K
      s({ id: 'sub-far-over', bidAmountCents: 50_000_00 }),
      s({ id: 'sub-far-under', bidAmountCents: 1_000_00 }),
    ];
    const out = classifySubBids(subs, 200_000_00, 'ROAD_RECONSTRUCTION');
    expect(out.thresholdCents).toBe(10_000_00);
    expect(out.borderline.map((x) => x.id).sort()).toEqual([
      'sub-just-over',
      'sub-just-under',
    ]);
    expect(out.mustList.map((x) => x.id)).toEqual(['sub-far-over']);
    expect(out.optional.map((x) => x.id)).toEqual(['sub-far-under']);
  });

  it('reports highwayFloor=true only when the floor is binding', () => {
    // $200K highway bid: floor binds (0.5% = $1K, floor = $10K)
    const small = classifySubBids([], 200_000_00, 'ROAD_RECONSTRUCTION');
    expect(small.highwayFloor).toBe(true);
    // $10M highway bid: 0.5% binds ($50K)
    const big = classifySubBids([], 10_000_000_00, 'ROAD_RECONSTRUCTION');
    expect(big.highwayFloor).toBe(false);
    // Non-highway: never highwayFloor
    const nonHwy = classifySubBids([], 200_000_00, 'OTHER');
    expect(nonHwy.highwayFloor).toBe(false);
  });

  it('totals every sub regardless of bucket', () => {
    const subs = [
      s({ id: 'a', bidAmountCents: 1_000_00 }),
      s({ id: 'b', bidAmountCents: 2_000_00 }),
      s({ id: 'c', bidAmountCents: 3_000_00 }),
    ];
    const out = classifySubBids(subs, 1_000_000_00, 'OTHER');
    expect(out.totalSubCents).toBe(6_000_00);
  });
});

describe('newSubBidId', () => {
  it('produces a sub-prefixed 12-char id', () => {
    const id = newSubBidId();
    expect(id).toMatch(/^sub-[0-9a-f]{8}$/);
  });
  it('produces unique values across many calls (collision is statistically negligible)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(newSubBidId());
    // 200 of 4-byte ids should never collide; loose floor of 195 allows for rare coincidence in CI
    expect(ids.size).toBeGreaterThan(195);
  });
});
