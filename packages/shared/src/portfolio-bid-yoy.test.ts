import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildPortfolioBidYoy } from './portfolio-bid-yoy';

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

describe('buildPortfolioBidYoy', () => {
  it('compares prior vs current year pursuits + win rate', () => {
    const r = buildPortfolioBidYoy({
      currentYear: 2026,
      jobs: [
        // Prior: 2 W / 1 L / 1 NB → 2/4 = 50%
        job({ id: 'a', bidDueDate: '2025-04-15', status: 'AWARDED' }),
        job({ id: 'b', bidDueDate: '2025-04-15', status: 'AWARDED' }),
        job({ id: 'c', bidDueDate: '2025-04-15', status: 'LOST' }),
        job({ id: 'd', bidDueDate: '2025-04-15', status: 'NO_BID' }),
        // Current: 3 W / 1 L → 3/4 = 75%
        job({ id: 'e', bidDueDate: '2026-04-15', status: 'AWARDED' }),
        job({ id: 'f', bidDueDate: '2026-04-15', status: 'AWARDED' }),
        job({ id: 'g', bidDueDate: '2026-04-15', status: 'AWARDED' }),
        job({ id: 'h', bidDueDate: '2026-04-15', status: 'LOST' }),
      ],
    });
    expect(r.priorWinRate).toBe(0.5);
    expect(r.currentWinRate).toBe(0.75);
    expect(r.winRateDelta).toBeCloseTo(0.25);
    expect(r.pursuitsDelta).toBe(0);
    expect(r.awardedDelta).toBe(1);
  });

  it('returns null win rate when no decided pursuits', () => {
    const r = buildPortfolioBidYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', status: 'PURSUING' }),
        job({ id: 'b', status: 'BID_SUBMITTED' }),
      ],
    });
    expect(r.currentWinRate).toBeNull();
  });

  it('skips jobs with no bidDueDate', () => {
    const r = buildPortfolioBidYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', bidDueDate: undefined }),
      ],
    });
    expect(r.currentPursuits).toBe(0);
  });

  it('ignores jobs outside the two-year window', () => {
    const r = buildPortfolioBidYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', bidDueDate: '2024-04-15' }),
      ],
    });
    expect(r.priorPursuits).toBe(0);
    expect(r.currentPursuits).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioBidYoy({ currentYear: 2026, jobs: [] });
    expect(r.priorPursuits).toBe(0);
    expect(r.currentPursuits).toBe(0);
  });
});
