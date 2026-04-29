import { describe, expect, it } from 'vitest';

import type { BidResult } from './bid-result';

import { buildBidResultByMonth } from './bid-result-by-month';

function res(over: Partial<BidResult>): BidResult {
  return {
    id: 'br-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    bidOpenedAt: '2026-04-15',
    outcome: 'WON_BY_YGE',
    bidders: [
      { bidderName: 'YGE', amountCents: 500_000_00, isYge: true },
    ],
    ...over,
  } as BidResult;
}

describe('buildBidResultByMonth', () => {
  it('buckets by yyyy-mm of bidOpenedAt', () => {
    const r = buildBidResultByMonth({
      bidResults: [
        res({ id: 'a', bidOpenedAt: '2026-03-15' }),
        res({ id: 'b', bidOpenedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each outcome separately', () => {
    const r = buildBidResultByMonth({
      bidResults: [
        res({ id: 'w', outcome: 'WON_BY_YGE' }),
        res({ id: 'l', outcome: 'WON_BY_OTHER' }),
        res({ id: 't', outcome: 'TBD' }),
        res({ id: 'n', outcome: 'NO_AWARD' }),
      ],
    });
    expect(r.rows[0]?.won).toBe(1);
    expect(r.rows[0]?.lost).toBe(1);
    expect(r.rows[0]?.tbd).toBe(1);
    expect(r.rows[0]?.noAward).toBe(1);
  });

  it('sums YGE bidder $ for submitted + won', () => {
    const r = buildBidResultByMonth({
      bidResults: [
        res({
          id: 'won',
          outcome: 'WON_BY_YGE',
          bidders: [{ bidderName: 'YGE', amountCents: 100_000_00, isYge: true }],
        }),
        res({
          id: 'lost',
          outcome: 'WON_BY_OTHER',
          bidders: [{ bidderName: 'YGE', amountCents: 50_000_00, isYge: true }],
        }),
      ],
    });
    expect(r.rows[0]?.totalSubmittedCents).toBe(150_000_00);
    expect(r.rows[0]?.totalWonCents).toBe(100_000_00);
  });

  it('counts distinct jobs per month', () => {
    const r = buildBidResultByMonth({
      bidResults: [
        res({ id: 'a', jobId: 'j1' }),
        res({ id: 'b', jobId: 'j1' }),
        res({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildBidResultByMonth({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      bidResults: [
        res({ id: 'mar', bidOpenedAt: '2026-03-15' }),
        res({ id: 'apr', bidOpenedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month won change', () => {
    const r = buildBidResultByMonth({
      bidResults: [
        res({ id: 'mar1', bidOpenedAt: '2026-03-15', outcome: 'WON_BY_YGE' }),
        res({ id: 'apr1', bidOpenedAt: '2026-04-10', outcome: 'WON_BY_YGE' }),
        res({ id: 'apr2', bidOpenedAt: '2026-04-15', outcome: 'WON_BY_YGE' }),
        res({ id: 'apr3', bidOpenedAt: '2026-04-20', outcome: 'WON_BY_YGE' }),
      ],
    });
    expect(r.rollup.monthOverMonthWonChange).toBe(2);
  });

  it('sorts by month asc', () => {
    const r = buildBidResultByMonth({
      bidResults: [
        res({ id: 'late', bidOpenedAt: '2026-04-15' }),
        res({ id: 'early', bidOpenedAt: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildBidResultByMonth({ bidResults: [] });
    expect(r.rows).toHaveLength(0);
  });
});
