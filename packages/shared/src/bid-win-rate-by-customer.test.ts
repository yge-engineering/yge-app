import { describe, expect, it } from 'vitest';

import type { BidResult } from './bid-result';
import type { Job } from './job';

import { buildBidWinRateByCustomer } from './bid-win-rate-by-customer';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'BID_SUBMITTED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function res(over: Partial<BidResult>): BidResult {
  return {
    id: 'br-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    bidOpenedAt: '2026-04-15',
    outcome: 'TBD',
    bidders: [
      { bidderName: 'YGE', amountCents: 500_000_00, isYge: true },
      { bidderName: 'Competitor A', amountCents: 510_000_00, isYge: false },
    ],
    ...over,
  } as BidResult;
}

describe('buildBidWinRateByCustomer', () => {
  it('groups bid results by job ownerAgency', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'BLM Redding' }),
      ],
      bidResults: [
        res({ id: 'a', jobId: 'j1' }),
        res({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes win rate as won / decided', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [job({ id: 'j1', ownerAgency: 'A' })],
      bidResults: [
        res({ id: 'w1', jobId: 'j1', outcome: 'WON_BY_YGE' }),
        res({ id: 'w2', jobId: 'j1', outcome: 'WON_BY_YGE' }),
        res({ id: 'l1', jobId: 'j1', outcome: 'WON_BY_OTHER' }),
        res({ id: 't1', jobId: 'j1', outcome: 'TBD' }),
      ],
    });
    expect(r.rows[0]?.bidsWon).toBe(2);
    expect(r.rows[0]?.bidsLost).toBe(1);
    expect(r.rows[0]?.winRate).toBeCloseTo(0.6667, 3);
  });

  it('sums submitted + won $ from YGE bidder line', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [job({ id: 'j1', ownerAgency: 'A' })],
      bidResults: [
        res({
          id: 'r1',
          jobId: 'j1',
          outcome: 'WON_BY_YGE',
          bidders: [{ bidderName: 'YGE', amountCents: 100_000_00, isYge: true }],
        }),
        res({
          id: 'r2',
          jobId: 'j1',
          outcome: 'WON_BY_OTHER',
          bidders: [{ bidderName: 'YGE', amountCents: 50_000_00, isYge: true }],
        }),
      ],
    });
    expect(r.rows[0]?.totalSubmittedCents).toBe(150_000_00);
    expect(r.rows[0]?.totalWonCents).toBe(100_000_00);
  });

  it('counts TBD and NO_AWARD separately', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [job({ id: 'j1', ownerAgency: 'A' })],
      bidResults: [
        res({ id: 'a', jobId: 'j1', outcome: 'TBD' }),
        res({ id: 'b', jobId: 'j1', outcome: 'NO_AWARD' }),
      ],
    });
    expect(r.rows[0]?.bidsTbd).toBe(1);
    expect(r.rows[0]?.bidsNoAward).toBe(1);
  });

  it('counts results with no matching job as unattributed', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [job({ id: 'j1', ownerAgency: 'A' })],
      bidResults: [
        res({ id: 'good', jobId: 'j1' }),
        res({ id: 'orphan', jobId: 'j-missing' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by winRate desc, ties by bidsSubmitted desc', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [
        job({ id: 'j1', ownerAgency: 'High' }),
        job({ id: 'j2', ownerAgency: 'Low' }),
      ],
      bidResults: [
        res({ id: 'h1', jobId: 'j1', outcome: 'WON_BY_YGE' }),
        res({ id: 'l1', jobId: 'j2', outcome: 'WON_BY_YGE' }),
        res({ id: 'l2', jobId: 'j2', outcome: 'WON_BY_OTHER' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('High');
  });

  it('respects fromDate / toDate window on bidOpenedAt', () => {
    const r = buildBidWinRateByCustomer({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({ id: 'j1', ownerAgency: 'A' })],
      bidResults: [
        res({ id: 'old', jobId: 'j1', bidOpenedAt: '2026-03-15' }),
        res({ id: 'in', jobId: 'j1', bidOpenedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.bidsSubmitted).toBe(1);
  });

  it('rolls up portfolio win rate', () => {
    const r = buildBidWinRateByCustomer({
      jobs: [
        job({ id: 'j1', ownerAgency: 'A' }),
        job({ id: 'j2', ownerAgency: 'B' }),
      ],
      bidResults: [
        res({ id: 'a', jobId: 'j1', outcome: 'WON_BY_YGE' }),
        res({ id: 'b', jobId: 'j2', outcome: 'WON_BY_OTHER' }),
      ],
    });
    expect(r.rollup.portfolioWinRate).toBe(0.5);
  });

  it('handles empty input', () => {
    const r = buildBidWinRateByCustomer({ jobs: [], bidResults: [] });
    expect(r.rows).toHaveLength(0);
  });
});
