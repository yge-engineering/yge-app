import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildJobDispatchPostingLateness } from './job-dispatch-posting-lateness';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '2026-04-13T00:00:00.000Z',
    updatedAt: '2026-04-13T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Alice',
    scopeOfWork: 'work',
    crew: [],
    equipment: [],
    status: 'POSTED',
    postedAt: '2026-04-14T18:00:00.000Z', // posted 6 PM previous day → 12h lead
    ...over,
  } as Dispatch;
}

describe('buildJobDispatchPostingLateness', () => {
  it('counts posting in-time when lead >= inTimeHours (default 12)', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', postedAt: '2026-04-14T18:00:00.000Z' }), // 12h
        disp({ id: 'b', postedAt: '2026-04-14T12:00:00.000Z' }), // 18h
      ],
    });
    expect(r.rows[0]?.postedInTime).toBe(2);
    expect(r.rows[0]?.postedLate).toBe(0);
  });

  it('counts late postings (0-12h before start)', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', postedAt: '2026-04-15T00:00:00.000Z' }), // 6h before
        disp({ id: 'b', postedAt: '2026-04-15T05:00:00.000Z' }), // 1h before
      ],
    });
    expect(r.rows[0]?.postedLate).toBe(2);
    expect(r.rows[0]?.postedInTime).toBe(0);
    expect(r.rows[0]?.postedAfterStart).toBe(0);
  });

  it('counts posted-after-start', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', postedAt: '2026-04-15T08:00:00.000Z' }), // 2h after start
      ],
    });
    expect(r.rows[0]?.postedAfterStart).toBe(1);
  });

  it('skips DRAFT + CANCELLED', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'd', status: 'DRAFT' }),
        disp({ id: 'c', status: 'CANCELLED' }),
        disp({ id: 'p', status: 'POSTED' }),
      ],
    });
    expect(r.rollup.totalPosted).toBe(1);
  });

  it('skips dispatches with no postedAt', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [disp({ id: 'a', postedAt: undefined })],
    });
    expect(r.rollup.totalPosted).toBe(0);
  });

  it('respects custom inTimeHours threshold', () => {
    const r = buildJobDispatchPostingLateness({
      inTimeHours: 24,
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', postedAt: '2026-04-14T06:00:00.000Z' }), // 24h
        disp({ id: 'b', postedAt: '2026-04-14T18:00:00.000Z' }), // 12h
      ],
    });
    expect(r.rows[0]?.postedInTime).toBe(1);
    expect(r.rows[0]?.postedLate).toBe(1);
  });

  it('computes median lead hours', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', postedAt: '2026-04-14T18:00:00.000Z' }), // 12h
        disp({ id: 'b', postedAt: '2026-04-14T12:00:00.000Z' }), // 18h
        disp({ id: 'c', postedAt: '2026-04-14T06:00:00.000Z' }), // 24h
      ],
    });
    expect(r.rows[0]?.medianLeadHours).toBe(18);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts lowest in-time share first', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [
        job({ id: 'good' }),
        job({ id: 'bad' }),
      ],
      dispatches: [
        disp({ id: 'g', jobId: 'good', postedAt: '2026-04-14T06:00:00.000Z' }),
        disp({ id: 'b', jobId: 'bad', postedAt: '2026-04-15T05:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('bad');
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobDispatchPostingLateness({
      jobs: [job({})],
      dispatches: [
        disp({ id: 'a', postedAt: '2026-04-14T06:00:00.000Z' }), // in-time
        disp({ id: 'b', postedAt: '2026-04-15T03:00:00.000Z' }), // late
        disp({ id: 'c', postedAt: '2026-04-15T08:00:00.000Z' }), // after
      ],
    });
    expect(r.rollup.totalPosted).toBe(3);
    expect(r.rollup.totalInTime).toBe(1);
    expect(r.rollup.totalLate).toBe(1);
    expect(r.rollup.totalAfterStart).toBe(1);
    expect(r.rollup.blendedInTimeShare).toBeCloseTo(1 / 3, 4);
  });

  it('handles empty input', () => {
    const r = buildJobDispatchPostingLateness({ jobs: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
