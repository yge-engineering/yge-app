import { describe, expect, it } from 'vitest';

import type { BidResult } from './bid-result';

import { buildJobBidDetailSnapshot } from './job-bid-detail-snapshot';

function br(over: Partial<BidResult>): BidResult {
  return {
    id: 'br-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    bidOpenedAt: '2026-04-15',
    outcome: 'WON_BY_YGE',
    bidders: [],
    ...over,
  } as BidResult;
}

describe('buildJobBidDetailSnapshot', () => {
  it('returns one row per bidder sorted by avg ascending', () => {
    const r = buildJobBidDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      bidResults: [
        br({
          id: 'a',
          jobId: 'j1',
          bidOpenedAt: '2026-04-15',
          bidders: [
            { bidderName: 'YGE', amountCents: 1_000_000_00, isYge: true },
            { bidderName: 'Granite', amountCents: 1_100_000_00, isYge: false },
            { bidderName: 'Granite', amountCents: 1_200_000_00, isYge: false },
          ],
        }),
        br({ id: 'b', jobId: 'j2', bidders: [{ bidderName: 'Other', amountCents: 999, isYge: false }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.bidderName).toBe('YGE');
    expect(r.rows[0]?.isYge).toBe(true);
    expect(r.rows[0]?.lowBidCents).toBe(1_000_000_00);
    expect(r.rows[0]?.bidCount).toBe(1);
    expect(r.rows[1]?.bidderName).toBe('Granite');
    expect(r.rows[1]?.bidCount).toBe(2);
    expect(r.rows[1]?.lowBidCents).toBe(1_100_000_00);
    expect(r.rows[1]?.highBidCents).toBe(1_200_000_00);
    expect(r.rows[1]?.avgBidCents).toBe(1_150_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobBidDetailSnapshot({ jobId: 'X', bidResults: [] });
    expect(r.rows.length).toBe(0);
  });
});
