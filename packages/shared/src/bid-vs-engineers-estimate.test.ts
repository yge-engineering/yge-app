import { describe, expect, it } from 'vitest';

import type { BidResult } from './bid-result';

import { buildBidVsEngineersEstimate } from './bid-vs-engineers-estimate';

function res(over: Partial<BidResult>): BidResult {
  return {
    id: 'br-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    bidOpenedAt: '2026-04-15',
    outcome: 'TBD',
    engineersEstimateCents: 1_000_000_00,
    bidders: [
      { bidderName: 'YGE', amountCents: 1_000_000_00, isYge: true },
    ],
    ...over,
  } as BidResult;
}

describe('buildBidVsEngineersEstimate', () => {
  it('tiers BELOW (<95%), AT (95-105%), ABOVE (>105%)', () => {
    const r = buildBidVsEngineersEstimate({
      bidResults: [
        res({
          id: 'low',
          bidders: [{ bidderName: 'YGE', amountCents: 800_000_00, isYge: true }],
        }),
        res({
          id: 'at',
          bidders: [{ bidderName: 'YGE', amountCents: 1_000_000_00, isYge: true }],
        }),
        res({
          id: 'high',
          bidders: [{ bidderName: 'YGE', amountCents: 1_200_000_00, isYge: true }],
        }),
      ],
    });
    expect(r.rollup.belowCount).toBe(1);
    expect(r.rollup.atCount).toBe(1);
    expect(r.rollup.aboveCount).toBe(1);
  });

  it('flags MISSING when no YGE bidder line', () => {
    const r = buildBidVsEngineersEstimate({
      bidResults: [
        res({
          id: 'no-yge',
          bidders: [{ bidderName: 'Competitor', amountCents: 500_000_00, isYge: false }],
        }),
      ],
    });
    expect(r.rows[0]?.tier).toBe('MISSING');
    expect(r.rollup.missingCount).toBe(1);
  });

  it('flags MISSING when no engineer estimate', () => {
    const r = buildBidVsEngineersEstimate({
      bidResults: [res({ id: 'no-est', engineersEstimateCents: undefined })],
    });
    expect(r.rows[0]?.tier).toBe('MISSING');
  });

  it('computes varianceCents and variancePct', () => {
    const r = buildBidVsEngineersEstimate({
      bidResults: [
        res({
          id: 'a',
          engineersEstimateCents: 1_000_000_00,
          bidders: [{ bidderName: 'YGE', amountCents: 800_000_00, isYge: true }],
        }),
      ],
    });
    expect(r.rows[0]?.varianceCents).toBe(-200_000_00);
    expect(r.rows[0]?.variancePct).toBe(-0.2);
  });

  it('sorts by variancePct ascending, MISSING last', () => {
    const r = buildBidVsEngineersEstimate({
      bidResults: [
        res({
          id: 'high',
          bidders: [{ bidderName: 'YGE', amountCents: 1_200_000_00, isYge: true }],
        }),
        res({
          id: 'low',
          bidders: [{ bidderName: 'YGE', amountCents: 800_000_00, isYge: true }],
        }),
        res({ id: 'missing', engineersEstimateCents: undefined }),
      ],
    });
    expect(r.rows[0]?.bidResultId).toBe('low');
    expect(r.rows[1]?.bidResultId).toBe('high');
    expect(r.rows[2]?.bidResultId).toBe('missing');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildBidVsEngineersEstimate({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      bidResults: [
        res({ id: 'old', bidOpenedAt: '2026-03-15' }),
        res({ id: 'in', bidOpenedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.resultsConsidered).toBe(1);
  });

  it('rolls up portfolio avg variance pct', () => {
    const r = buildBidVsEngineersEstimate({
      bidResults: [
        res({
          id: 'a',
          bidders: [{ bidderName: 'YGE', amountCents: 900_000_00, isYge: true }],
        }),
        res({
          id: 'b',
          bidders: [{ bidderName: 'YGE', amountCents: 1_100_000_00, isYge: true }],
        }),
      ],
    });
    expect(r.rollup.avgVariancePct).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildBidVsEngineersEstimate({ bidResults: [] });
    expect(r.rows).toHaveLength(0);
  });
});
