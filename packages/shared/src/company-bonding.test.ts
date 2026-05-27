import { describe, it, expect } from 'vitest';

import {
  BondingProfileSchema,
  bondingCapacityState,
  bondingFeasibilityForBid,
  type BondingProfile,
} from './company-bonding';

const baseProfile: BondingProfile = {
  suretyName: 'Liberty Mutual',
  agentName: 'Westland',
  aggregateCapacityCents: 25_000_000_00,        // $25M
  singleProjectCapacityCents: 10_000_000_00,    // $10M
  currentBondedWorkOnHandCents: 8_000_000_00,   // $8M
  renewalDate: '2026-12-31',
};

describe('BondingProfileSchema', () => {
  it('parses a valid profile', () => {
    expect(() => BondingProfileSchema.parse(baseProfile)).not.toThrow();
  });

  it('rejects negative capacities', () => {
    expect(() =>
      BondingProfileSchema.parse({ ...baseProfile, aggregateCapacityCents: -1 }),
    ).toThrow();
  });

  it('rejects malformed renewal dates', () => {
    expect(() =>
      BondingProfileSchema.parse({ ...baseProfile, renewalDate: '12/31/2026' }),
    ).toThrow();
  });
});

describe('bondingCapacityState', () => {
  it('reports remaining capacity = aggregate − WOH', () => {
    const state = bondingCapacityState(baseProfile, new Date('2026-06-01T00:00:00Z'));
    expect(state.remainingAggregateCapacityCents).toBe(17_000_000_00);
  });

  it('clamps remaining to 0 when WOH exceeds aggregate', () => {
    const state = bondingCapacityState(
      { ...baseProfile, currentBondedWorkOnHandCents: 30_000_000_00 },
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(state.remainingAggregateCapacityCents).toBe(0);
    expect(state.utilizationPercent).toBe(100);
  });

  it('rounds utilization to integer percent', () => {
    const state = bondingCapacityState(baseProfile, new Date('2026-06-01T00:00:00Z'));
    // 8M / 25M = 32%
    expect(state.utilizationPercent).toBe(32);
  });

  it('computes days until renewal', () => {
    const state = bondingCapacityState(
      baseProfile,
      new Date('2026-12-01T00:00:00Z'),
    );
    expect(state.daysUntilRenewal).toBe(30);
  });

  it('reports negative days for past-due renewal', () => {
    const state = bondingCapacityState(
      baseProfile,
      new Date('2027-01-15T00:00:00Z'),
    );
    expect(state.daysUntilRenewal).toBeLessThan(0);
  });
});

describe('bondingFeasibilityForBid', () => {
  it('returns null when bid is within both capacities', () => {
    expect(bondingFeasibilityForBid(baseProfile, 2_000_000_00)).toBeNull();
  });

  it('flags bid over single-project capacity', () => {
    const reason = bondingFeasibilityForBid(baseProfile, 15_000_000_00);
    expect(reason).toMatch(/single-project capacity/);
  });

  it('flags bid that pushes WOH over aggregate', () => {
    // WOH is $8M, agg cap $25M, single cap $10M. A $9M bid is under single but
    // pushes WOH to $17M which is still fine; a $20M bid trips single first.
    // Test the WOH-only trip: lower single cap and try.
    const reason = bondingFeasibilityForBid(
      {
        ...baseProfile,
        singleProjectCapacityCents: 20_000_000_00,
        currentBondedWorkOnHandCents: 22_000_000_00,
      },
      5_000_000_00,
    );
    expect(reason).toMatch(/aggregate capacity/);
  });
});
