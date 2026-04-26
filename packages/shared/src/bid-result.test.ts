import { describe, expect, it } from 'vitest';
import {
  computeBidResultRollup,
  sortBidders,
  winningAmountCents,
  ygeBid,
  ygeDeltaToEngineerEstimateCents,
  ygeDeltaToWinnerCents,
  ygeRank,
  type BidResult,
  type BidResultBidder,
} from './bid-result';

function bidder(over: Partial<BidResultBidder>): BidResultBidder {
  return { bidderName: 'Acme Construction', amountCents: 1_000_00, isYge: false, ...over };
}

function result(over: Partial<BidResult>): BidResult {
  return {
    id: 'bid-result-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    jobId: 'job-2026-04-30-test-deadbeef',
    bidOpenedAt: '2026-04-30',
    outcome: 'TBD',
    bidders: [],
    ...over,
  };
}

describe('sortBidders + winningAmountCents', () => {
  it('sorts ascending and returns the lowest amount as winner', () => {
    const r = result({
      bidders: [
        bidder({ bidderName: 'High', amountCents: 1_500_00 }),
        bidder({ bidderName: 'Low', amountCents: 800_00 }),
        bidder({ bidderName: 'Mid', amountCents: 1_100_00 }),
      ],
    });
    expect(sortBidders(r.bidders)[0]!.bidderName).toBe('Low');
    expect(winningAmountCents(r)).toBe(800_00);
  });
});

describe('ygeBid + ygeRank', () => {
  it('finds YGE in the bidders list', () => {
    const r = result({
      bidders: [
        bidder({ bidderName: 'Acme', amountCents: 1_000_00 }),
        bidder({ bidderName: 'YGE', amountCents: 950_00, isYge: true }),
      ],
    });
    expect(ygeBid(r)?.bidderName).toBe('YGE');
    expect(ygeRank(r)).toBe(1);
  });

  it('returns undefined when YGE did not bid', () => {
    const r = result({
      bidders: [bidder({ bidderName: 'Acme', amountCents: 1_000_00 })],
    });
    expect(ygeBid(r)).toBeUndefined();
    expect(ygeRank(r)).toBeUndefined();
  });
});

describe('delta helpers', () => {
  it('computes YGE delta to winning bid (negative when YGE won)', () => {
    const r = result({
      bidders: [
        bidder({ bidderName: 'YGE', amountCents: 900_00, isYge: true }),
        bidder({ bidderName: 'Acme', amountCents: 1_000_00 }),
      ],
    });
    expect(ygeDeltaToWinnerCents(r)).toBe(0); // YGE was the winner
  });

  it('computes YGE delta when YGE was outbid', () => {
    const r = result({
      bidders: [
        bidder({ bidderName: 'Low', amountCents: 800_00 }),
        bidder({ bidderName: 'YGE', amountCents: 900_00, isYge: true }),
      ],
    });
    expect(ygeDeltaToWinnerCents(r)).toBe(100_00);
  });

  it('computes YGE delta to engineer estimate', () => {
    const r = result({
      engineersEstimateCents: 1_000_00,
      bidders: [bidder({ bidderName: 'YGE', amountCents: 900_00, isYge: true })],
    });
    expect(ygeDeltaToEngineerEstimateCents(r)).toBe(-100_00);
  });

  it('returns undefined when engineer estimate is missing', () => {
    const r = result({
      bidders: [bidder({ bidderName: 'YGE', amountCents: 900_00, isYge: true })],
    });
    expect(ygeDeltaToEngineerEstimateCents(r)).toBeUndefined();
  });
});

describe('computeBidResultRollup', () => {
  const fixtures: BidResult[] = [
    result({
      outcome: 'WON_BY_YGE',
      bidders: [
        bidder({ bidderName: 'YGE', amountCents: 800_00, isYge: true }),
        bidder({ bidderName: 'Acme', amountCents: 900_00 }),
      ],
    }),
    result({
      outcome: 'WON_BY_OTHER',
      bidders: [
        bidder({ bidderName: 'Cottonwood Paving', amountCents: 700_00 }),
        bidder({ bidderName: 'YGE', amountCents: 750_00, isYge: true }),
        bidder({ bidderName: 'Acme', amountCents: 800_00 }),
      ],
    }),
    result({
      outcome: 'WON_BY_OTHER',
      bidders: [
        bidder({ bidderName: 'Cottonwood Paving', amountCents: 600_00 }),
        bidder({ bidderName: 'YGE', amountCents: 650_00, isYge: true }),
      ],
    }),
    result({ outcome: 'TBD', bidders: [] }),
    result({
      outcome: 'TBD',
      bidders: [bidder({ bidderName: 'YGE', amountCents: 1_000_00, isYge: true })],
    }),
  ];

  it('counts wins / losses / TBD / no-award correctly', () => {
    const r = computeBidResultRollup(fixtures);
    expect(r.bidsTracked).toBe(4); // 4 of the 5 had YGE bids
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(2);
    expect(r.tbd).toBe(1); // the YGE-only TBD
  });

  it('computes a sensible win rate', () => {
    const r = computeBidResultRollup(fixtures);
    // 1 win / 3 decided = 0.333
    expect(r.winRate).toBe(0.333);
  });

  it('counts apparent-low finishes', () => {
    const r = computeBidResultRollup(fixtures);
    // YGE was apparent low on the WON_BY_YGE row + the TBD-with-only-YGE row
    expect(r.apparentLowCount).toBe(2);
  });

  it('rolls up competitor appearances + wins', () => {
    const r = computeBidResultRollup(fixtures);
    const cw = r.competitorAppearances.find((c) => c.bidderName === 'Cottonwood Paving');
    expect(cw?.appearances).toBe(2);
    expect(cw?.wins).toBe(2); // they won both losses
  });
});
