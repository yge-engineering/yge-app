import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerBidSnapshot } from './customer-bid-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildCustomerBidSnapshot', () => {
  it('filters to one customer', () => {
    const r = buildCustomerBidSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'a' }), jb({ id: 'b', ownerAgency: 'CAL FIRE' })],
    });
    expect(r.totalJobs).toBe(1);
  });

  it('counts statuses + win rate', () => {
    const r = buildCustomerBidSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'a', status: 'AWARDED' }),
        jb({ id: 'b', status: 'AWARDED' }),
        jb({ id: 'c', status: 'LOST' }),
        jb({ id: 'd', status: 'NO_BID' }),
        jb({ id: 'e', status: 'PURSUING' }),
      ],
    });
    expect(r.awardedCount).toBe(2);
    expect(r.lostCount).toBe(1);
    expect(r.noBidCount).toBe(1);
    expect(r.inFlightCount).toBe(1);
    expect(r.winRate).toBeCloseTo(2 / 4);
  });

  it('counts upcoming due in window', () => {
    const r = buildCustomerBidSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-15',
      upcomingWindowDays: 14,
      jobs: [
        jb({ id: 'a', bidDueDate: '2026-04-20' }),
        jb({ id: 'b', bidDueDate: '2026-04-28' }),
        jb({ id: 'c', bidDueDate: '2026-05-15' }),
      ],
    });
    expect(r.upcomingDueCount).toBe(2);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerBidSnapshot({ customerName: 'X', jobs: [] });
    expect(r.totalJobs).toBe(0);
    expect(r.winRate).toBeNull();
  });
});
