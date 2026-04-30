import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildPortfolioBidSnapshot } from './portfolio-bid-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'job-1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildPortfolioBidSnapshot', () => {
  it('counts statuses + win rate', () => {
    const r = buildPortfolioBidSnapshot({
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'a', status: 'AWARDED' }),
        jb({ id: 'b', status: 'AWARDED' }),
        jb({ id: 'c', status: 'LOST' }),
        jb({ id: 'd', status: 'NO_BID' }),
        jb({ id: 'e', status: 'PURSUING' }),
        jb({ id: 'f', status: 'BID_SUBMITTED' }),
      ],
    });
    expect(r.awardedCount).toBe(2);
    expect(r.lostCount).toBe(1);
    expect(r.noBidCount).toBe(1);
    expect(r.inFlightCount).toBe(2);
    expect(r.winRate).toBeCloseTo(2 / 4);
  });

  it('counts ytd bids due', () => {
    const r = buildPortfolioBidSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      jobs: [
        jb({ id: 'a', bidDueDate: '2025-04-15' }),
        jb({ id: 'b', bidDueDate: '2026-04-15' }),
        jb({ id: 'c', bidDueDate: '2026-04-20' }),
      ],
    });
    expect(r.ytdBidsDue).toBe(2);
  });

  it('counts upcoming due in window', () => {
    const r = buildPortfolioBidSnapshot({
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

  it('counts distinct owner agencies', () => {
    const r = buildPortfolioBidSnapshot({
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'a', ownerAgency: 'Caltrans' }),
        jb({ id: 'b', ownerAgency: 'CAL FIRE' }),
      ],
    });
    expect(r.distinctOwnerAgencies).toBe(2);
  });

  it('breaks down by status', () => {
    const r = buildPortfolioBidSnapshot({
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'a', status: 'AWARDED' }),
        jb({ id: 'b', status: 'PURSUING' }),
      ],
    });
    expect(r.byStatus.AWARDED).toBe(1);
    expect(r.byStatus.PURSUING).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioBidSnapshot({ jobs: [] });
    expect(r.totalJobs).toBe(0);
    expect(r.winRate).toBeNull();
  });
});
