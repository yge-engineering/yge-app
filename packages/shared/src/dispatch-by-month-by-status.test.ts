import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchByMonthByStatus } from './dispatch-by-month-by-status';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildDispatchByMonthByStatus', () => {
  it('groups by month', () => {
    const r = buildDispatchByMonthByStatus({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-22' }),
        disp({ id: 'c', scheduledFor: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('breaks down by status', () => {
    const r = buildDispatchByMonthByStatus({
      dispatches: [
        disp({ id: 'a', status: 'DRAFT' }),
        disp({ id: 'b', status: 'POSTED' }),
        disp({ id: 'c', status: 'POSTED' }),
        disp({ id: 'd', status: 'COMPLETED' }),
        disp({ id: 'e', status: 'CANCELLED' }),
      ],
    });
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.posted).toBe(2);
    expect(r.rows[0]?.completed).toBe(1);
    expect(r.rows[0]?.cancelled).toBe(1);
  });

  it('counts distinct jobs and foremen per month', () => {
    const r = buildDispatchByMonthByStatus({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', foremanName: 'Pat' }),
        disp({ id: 'b', jobId: 'j2', foremanName: 'Pat' }),
        disp({ id: 'c', jobId: 'j1', foremanName: 'Sam' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctForemen).toBe(2);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildDispatchByMonthByStatus({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
        disp({ id: 'late', scheduledFor: '2026-05-01' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('computes portfolio shares', () => {
    const r = buildDispatchByMonthByStatus({
      dispatches: [
        disp({ id: 'a', status: 'POSTED' }),
        disp({ id: 'b', status: 'POSTED' }),
        disp({ id: 'c', status: 'COMPLETED' }),
        disp({ id: 'd', status: 'CANCELLED' }),
      ],
    });
    expect(r.rollup.postedShare).toBe(0.5);
    expect(r.rollup.completedShare).toBe(0.25);
    expect(r.rollup.cancelledShare).toBe(0.25);
  });

  it('sorts by month ascending', () => {
    const r = buildDispatchByMonthByStatus({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-06-01' }),
        disp({ id: 'b', scheduledFor: '2026-04-01' }),
        disp({ id: 'c', scheduledFor: '2026-05-01' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildDispatchByMonthByStatus({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalDispatches).toBe(0);
  });
});
