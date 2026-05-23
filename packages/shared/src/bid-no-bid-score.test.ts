import { describe, it, expect } from 'vitest';
import {
  BidNoBidInputSchema,
  scoreBidNoBid,
  type BidNoBidInput,
} from './bid-no-bid-score';

function input(over: Partial<BidNoBidInput> = {}): BidNoBidInput {
  return BidNoBidInputSchema.parse({
    priorWinsCount: 0,
    priorDisputesCount: 0,
    expectedMarginPct: 0.12,
    marginFloorPct: 0.08,
    bondAggregateUtilizationIfWon: 0.5,
    exceedsSingleJobBondCap: false,
    crewAvailability: 0.75,
    equipmentAvailability: 0.75,
    bidPrepHoursEstimate: 20,
    estimatedWinProbability: 0.4,
    strategicNewAgency: false,
    ...over,
  });
}

describe('scoreBidNoBid — verdict thresholds', () => {
  it('clean inputs land in TOSS_UP or LEAN_BID', () => {
    const r = scoreBidNoBid(input());
    expect(['TOSS_UP', 'LEAN_BID']).toContain(r.verdict);
  });

  it('all-good inputs land in BID', () => {
    const r = scoreBidNoBid(
      input({
        priorWinsCount: 8,
        expectedMarginPct: 0.2,
        bondAggregateUtilizationIfWon: 0.3,
        crewAvailability: 1,
        equipmentAvailability: 1,
        bidPrepHoursEstimate: 10,
        estimatedWinProbability: 0.7,
        strategicNewAgency: true,
      }),
    );
    expect(r.verdict).toBe('BID');
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('exceeding single-job bond cap tanks the score', () => {
    const r = scoreBidNoBid(input({ exceedsSingleJobBondCap: true }));
    expect(r.verdict).toBe('NO_BID');
  });
});

describe('scoreBidNoBid — per-factor', () => {
  it('agency relationship factor sums wins minus disputes (capped at ±15)', () => {
    const r = scoreBidNoBid(input({ priorWinsCount: 10, priorDisputesCount: 0 }));
    const factor = r.factors.find((f) => f.label === 'Agency relationship')!;
    expect(factor.delta).toBe(15);
  });

  it('margin below floor pushes negative', () => {
    const r = scoreBidNoBid(input({ expectedMarginPct: 0.04, marginFloorPct: 0.08 }));
    const factor = r.factors.find((f) => f.label === 'Margin vs floor')!;
    expect(factor.delta).toBeLessThan(0);
  });

  it('bonding 95% utilized deducts', () => {
    const r = scoreBidNoBid(input({ bondAggregateUtilizationIfWon: 0.95 }));
    const factor = r.factors.find((f) => f.label === 'Bond aggregate after win')!;
    expect(factor.delta).toBeLessThan(0);
  });

  it('high win probability rewards effort', () => {
    const r = scoreBidNoBid(input({ bidPrepHoursEstimate: 20, estimatedWinProbability: 0.8 }));
    const factor = r.factors.find((f) => f.label === 'Effort vs win probability')!;
    expect(factor.delta).toBeGreaterThan(0);
  });
});

describe('scoreBidNoBid — clamping', () => {
  it('score is always 0..100', () => {
    const lo = scoreBidNoBid(input({ exceedsSingleJobBondCap: true, expectedMarginPct: -0.05 }));
    const hi = scoreBidNoBid(
      input({
        priorWinsCount: 1000,
        expectedMarginPct: 1,
        crewAvailability: 1,
        equipmentAvailability: 1,
        bidPrepHoursEstimate: 1,
        estimatedWinProbability: 1,
        strategicNewAgency: true,
      }),
    );
    expect(lo.score).toBeGreaterThanOrEqual(0);
    expect(lo.score).toBeLessThanOrEqual(100);
    expect(hi.score).toBeGreaterThanOrEqual(0);
    expect(hi.score).toBeLessThanOrEqual(100);
  });
});
