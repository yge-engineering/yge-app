import { describe, expect, it } from 'vitest';

import type { BidResult, BidResultBidder } from './bid-result';

import { buildCompetitorFrequency } from './competitor-frequency';

function bidder(over: Partial<BidResultBidder>): BidResultBidder {
  return {
    bidderName: 'Acme Construction',
    amountCents: 1_000_000_00,
    isYge: false,
    ...over,
  } as BidResultBidder;
}

function result(over: Partial<BidResult>): BidResult {
  return {
    id: 'br-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    bidOpenedAt: '2026-04-01',
    outcome: 'WON_BY_OTHER',
    bidders: [],
    ...over,
  } as BidResult;
}

describe('buildCompetitorFrequency', () => {
  it('counts appearances per competitor across bid results', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({ bidders: [bidder({ bidderName: 'Acme Construction' })] }),
        result({ id: 'br-2', bidders: [bidder({ bidderName: 'Acme Construction' })] }),
        result({ id: 'br-3', bidders: [bidder({ bidderName: 'Beta Builders' })] }),
      ],
    });
    const acme = r.rows.find((x) => x.competitorName === 'Acme Construction');
    const beta = r.rows.find((x) => x.competitorName === 'Beta Builders');
    expect(acme?.bidsAppeared).toBe(2);
    expect(beta?.bidsAppeared).toBe(1);
  });

  it('skips YGE rows from the competitor list', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({
          bidders: [
            bidder({ bidderName: 'YGE', isYge: true }),
            bidder({ bidderName: 'Acme' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.competitorName).toBe('Acme');
  });

  it('case-insensitively collapses competitor names', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({ bidders: [bidder({ bidderName: 'ACME CONSTRUCTION INC.' })] }),
        result({ id: 'br-2', bidders: [bidder({ bidderName: 'Acme Construction Inc' })] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.bidsAppeared).toBe(2);
  });

  it('counts wins when this competitor took the job', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({
          outcome: 'WON_BY_OTHER',
          bidders: [
            bidder({ bidderName: 'Acme', amountCents: 800_000_00 }),
            bidder({ bidderName: 'Beta', amountCents: 1_000_000_00 }),
          ],
        }),
      ],
    });
    const acme = r.rows.find((x) => x.competitorName === 'Acme');
    expect(acme?.winsByCompetitor).toBe(1);
  });

  it('does not count win when YGE took the job', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({
          outcome: 'WON_BY_YGE',
          bidders: [
            bidder({ bidderName: 'YGE', amountCents: 800_000_00, isYge: true }),
            bidder({ bidderName: 'Acme', amountCents: 1_000_000_00 }),
          ],
        }),
      ],
    });
    const acme = r.rows.find((x) => x.competitorName === 'Acme');
    expect(acme?.winsByCompetitor).toBe(0);
  });

  it('computes avg rank across appearances', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({
          bidders: [
            bidder({ bidderName: 'Acme', amountCents: 1_000_000_00 }),  // rank 1
            bidder({ bidderName: 'Beta', amountCents: 1_500_000_00 }),  // rank 2
          ],
        }),
        result({
          id: 'br-2',
          bidders: [
            bidder({ bidderName: 'Beta', amountCents: 800_000_00 }),    // rank 1
            bidder({ bidderName: 'Acme', amountCents: 1_200_000_00 }),  // rank 2
          ],
        }),
      ],
    });
    const acme = r.rows.find((x) => x.competitorName === 'Acme');
    const beta = r.rows.find((x) => x.competitorName === 'Beta');
    expect(acme?.avgRank).toBe(1.5);
    expect(beta?.avgRank).toBe(1.5);
  });

  it('tracks head-to-head metrics when YGE was in the bid', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({
          outcome: 'WON_BY_OTHER',
          bidders: [
            bidder({ bidderName: 'Acme', amountCents: 800_000_00 }),
            bidder({ bidderName: 'YGE', amountCents: 1_000_000_00, isYge: true }),
          ],
        }),
        result({
          id: 'br-2',
          outcome: 'WON_BY_YGE',
          bidders: [
            bidder({ bidderName: 'YGE', amountCents: 700_000_00, isYge: true }),
            bidder({ bidderName: 'Acme', amountCents: 900_000_00 }),
          ],
        }),
      ],
    });
    const acme = r.rows.find((x) => x.competitorName === 'Acme');
    expect(acme?.headToHeadCount).toBe(2);
    expect(acme?.ygeLowerCount).toBe(1);
    expect(acme?.competitorWinsHeadToHead).toBe(1);
  });

  it('skips bid results with no bidders', () => {
    const r = buildCompetitorFrequency({
      bidResults: [result({ bidders: [] })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects minAppearances filter', () => {
    const r = buildCompetitorFrequency({
      minAppearances: 2,
      bidResults: [
        result({ bidders: [bidder({ bidderName: 'Solo Apparition' })] }),
        result({ id: 'br-2', bidders: [bidder({ bidderName: 'Repeat Customer' })] }),
        result({ id: 'br-3', bidders: [bidder({ bidderName: 'Repeat Customer' })] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.competitorName).toBe('Repeat Customer');
  });

  it('sorts by appearances desc', () => {
    const r = buildCompetitorFrequency({
      bidResults: [
        result({ bidders: [bidder({ bidderName: 'Once' })] }),
        result({ id: 'br-2', bidders: [bidder({ bidderName: 'Many' })] }),
        result({ id: 'br-3', bidders: [bidder({ bidderName: 'Many' })] }),
        result({ id: 'br-4', bidders: [bidder({ bidderName: 'Many' })] }),
      ],
    });
    expect(r.rows[0]?.competitorName).toBe('Many');
  });
});
