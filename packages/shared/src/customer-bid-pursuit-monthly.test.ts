import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerBidPursuitMonthly } from './customer-bid-pursuit-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'job-2026-04-01-test-aaaaaaaa',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'PURSUING',
    ownerAgency: 'Caltrans D2',
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildCustomerBidPursuitMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerBidPursuitMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'Caltrans D2', bidDueDate: '2026-04-15' }),
        job({ id: 'b', ownerAgency: 'Caltrans D2', bidDueDate: '2026-05-01' }),
        job({ id: 'c', ownerAgency: 'CAL FIRE', bidDueDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts statuses', () => {
    const r = buildCustomerBidPursuitMonthly({
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'b', status: 'LOST' }),
        job({ id: 'c', status: 'NO_BID' }),
        job({ id: 'd', status: 'PURSUING' }),
        job({ id: 'e', status: 'BID_SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.awardedCount).toBe(1);
    expect(r.rows[0]?.lostCount).toBe(1);
    expect(r.rows[0]?.noBidCount).toBe(1);
    expect(r.rows[0]?.inFlightCount).toBe(2);
  });

  it('computes win rate over decided pursuits', () => {
    const r = buildCustomerBidPursuitMonthly({
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'b', status: 'AWARDED' }),
        job({ id: 'c', status: 'LOST' }),
        job({ id: 'd', status: 'NO_BID' }),
        job({ id: 'e', status: 'PURSUING' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBeCloseTo(2 / 4);
  });

  it('returns null win rate when denominator is zero', () => {
    const r = buildCustomerBidPursuitMonthly({
      jobs: [
        job({ id: 'a', status: 'PURSUING' }),
        job({ id: 'b', status: 'BID_SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBeNull();
  });

  it('skips jobs with no bidDueDate or no ownerAgency', () => {
    const r = buildCustomerBidPursuitMonthly({
      jobs: [
        job({ id: 'a', bidDueDate: undefined }),
        job({ id: 'b', ownerAgency: undefined }),
        job({ id: 'c' }),
      ],
    });
    expect(r.rollup.noDateSkipped).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerBidPursuitMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({ id: 'old', bidDueDate: '2026-03-15' }),
        job({ id: 'in', bidDueDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPursuits).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerBidPursuitMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'Z Agency', bidDueDate: '2026-04-15' }),
        job({ id: 'b', ownerAgency: 'A Agency', bidDueDate: '2026-05-01' }),
        job({ id: 'c', ownerAgency: 'A Agency', bidDueDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerBidPursuitMonthly({ jobs: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalPursuits).toBe(0);
  });
});
