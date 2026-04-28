import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildBidPursuitCycleTime } from './bid-pursuit-cycle-time';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildBidPursuitCycleTime', () => {
  it('buckets pursuits by daysToWindow', () => {
    const r = buildBidPursuitCycleTime({
      jobs: [
        job({ id: 'short', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-05' }), // 4 days
        job({ id: 'normal', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-15' }), // 14 days
        job({ id: 'long', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-05-01' }), // 30 days
        job({ id: 'verylong', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-06-15' }), // 75 days
        job({ id: 'missing', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: undefined }),
      ],
    });
    expect(r.rollup.shortCount).toBe(1);
    expect(r.rollup.normalCount).toBe(1);
    expect(r.rollup.longCount).toBe(1);
    expect(r.rollup.veryLongCount).toBe(1);
    expect(r.rollup.missingCount).toBe(1);
  });

  it('computes daysToWindow correctly', () => {
    const r = buildBidPursuitCycleTime({
      jobs: [
        job({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.daysToWindow).toBe(14);
  });

  it('skips ARCHIVED jobs', () => {
    const r = buildBidPursuitCycleTime({
      jobs: [
        job({ id: 'live', status: 'PURSUING' }),
        job({ id: 'gone', status: 'ARCHIVED' }),
      ],
    });
    expect(r.rollup.jobsConsidered).toBe(1);
  });

  it('handles unparseable bidDueDate as MISSING', () => {
    const r = buildBidPursuitCycleTime({
      jobs: [job({ id: 'a', bidDueDate: 'TBD' })],
    });
    expect(r.rows[0]?.bucket).toBe('MISSING');
    expect(r.rows[0]?.daysToWindow).toBeNull();
  });

  it('sorts by daysToWindow ascending, MISSING last', () => {
    const r = buildBidPursuitCycleTime({
      jobs: [
        job({ id: 'late', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-15' }),
        job({ id: 'tbd', bidDueDate: undefined }),
        job({ id: 'rush', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-05' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('rush');
    expect(r.rows[1]?.jobId).toBe('late');
    expect(r.rows[2]?.jobId).toBe('tbd');
  });

  it('respects fromDate / toDate window on createdAt', () => {
    const r = buildBidPursuitCycleTime({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [
        job({ id: 'old', createdAt: '2026-03-15T00:00:00.000Z' }),
        job({ id: 'in', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.jobsConsidered).toBe(1);
  });

  it('rolls up avg days to window over parseable rows only', () => {
    const r = buildBidPursuitCycleTime({
      jobs: [
        job({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-11' }), // 10
        job({ id: 'b', createdAt: '2026-04-01T00:00:00.000Z', bidDueDate: '2026-04-21' }), // 20
        job({ id: 'c', bidDueDate: undefined }),
      ],
    });
    expect(r.rollup.avgDaysToWindow).toBe(15);
  });

  it('handles empty input', () => {
    const r = buildBidPursuitCycleTime({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
