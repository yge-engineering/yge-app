import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchByJobMonthly } from './dispatch-by-job-monthly';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Lopez',
    scopeOfWork: 'Dirt',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildDispatchByJobMonthly', () => {
  it('groups by (jobId, month) pair', () => {
    const r = buildDispatchByJobMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-03-15' }),
        disp({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct dates and foremen per pair', () => {
    const r = buildDispatchByJobMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15', foremanName: 'Lopez' }),
        disp({ id: 'b', scheduledFor: '2026-04-15', foremanName: 'Garcia' }),
        disp({ id: 'c', scheduledFor: '2026-04-16', foremanName: 'Lopez' }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctForemen).toBe(2);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildDispatchByJobMonthly({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildDispatchByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15' }),
        disp({ id: 'apr', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by jobId asc then month asc', () => {
    const r = buildDispatchByJobMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'Z', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', jobId: 'A', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', jobId: 'A', scheduledFor: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
    expect(r.rows[1]?.month).toBe('2026-04');
  });

  it('rolls up jobsConsidered, monthsConsidered, totalDispatches', () => {
    const r = buildDispatchByJobMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-03-15' }),
        disp({ id: 'b', jobId: 'j2', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.jobsConsidered).toBe(2);
    expect(r.rollup.monthsConsidered).toBe(2);
    expect(r.rollup.totalDispatches).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildDispatchByJobMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
