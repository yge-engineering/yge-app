import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildPortfolioBidMonthly } from './portfolio-bid-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'PURSUING',
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildPortfolioBidMonthly', () => {
  it('counts statuses per month', () => {
    const r = buildPortfolioBidMonthly({
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

  it('computes monthly + cumulative win rate', () => {
    const r = buildPortfolioBidMonthly({
      jobs: [
        // Apr: 1 W / 1 L → 50%
        job({ id: 'a', status: 'AWARDED', bidDueDate: '2026-04-15' }),
        job({ id: 'b', status: 'LOST', bidDueDate: '2026-04-15' }),
        // May: 1 W / 0 L → 100%, cumulative 2/3
        job({ id: 'c', status: 'AWARDED', bidDueDate: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBe(0.5);
    expect(r.rows[1]?.winRate).toBe(1);
    expect(r.rows[1]?.cumulativeWinRate).toBeCloseTo(2 / 3);
  });

  it('returns null winRate when no decided pursuits', () => {
    const r = buildPortfolioBidMonthly({
      jobs: [
        job({ id: 'a', status: 'PURSUING' }),
        job({ id: 'b', status: 'BID_SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBeNull();
    expect(r.rows[0]?.cumulativeWinRate).toBeNull();
  });

  it('skips jobs with no bidDueDate', () => {
    const r = buildPortfolioBidMonthly({
      jobs: [
        job({ id: 'a', bidDueDate: undefined }),
        job({ id: 'b' }),
      ],
    });
    expect(r.rollup.noDateSkipped).toBe(1);
    expect(r.rollup.totalPursuits).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioBidMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({ id: 'old', bidDueDate: '2026-03-15' }),
        job({ id: 'in', bidDueDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPursuits).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioBidMonthly({
      jobs: [
        job({ id: 'a', bidDueDate: '2026-06-15' }),
        job({ id: 'b', bidDueDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioBidMonthly({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
