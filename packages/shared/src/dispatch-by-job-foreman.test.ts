import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchByJobForeman } from './dispatch-by-job-foreman';

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

describe('buildDispatchByJobForeman', () => {
  it('groups by (job, foreman)', () => {
    const r = buildDispatchByJobForeman({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', foremanName: 'Lopez' }),
        disp({ id: 'b', jobId: 'j1', foremanName: 'Garcia' }),
        disp({ id: 'c', jobId: 'j2', foremanName: 'Lopez' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct dates and last dispatch date', () => {
    const r = buildDispatchByJobForeman({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-10' }),
        disp({ id: 'b', scheduledFor: '2026-04-20' }),
        disp({ id: 'c', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(3);
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-20');
  });

  it('skips DRAFT', () => {
    const r = buildDispatchByJobForeman({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sums crew and equipment lines', () => {
    const r = buildDispatchByJobForeman({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ name: 'A' }, { name: 'B' }],
          equipment: [{ name: 'X' }, { name: 'Y' }],
        }),
      ],
    });
    expect(r.rows[0]?.totalCrewLines).toBe(2);
    expect(r.rows[0]?.totalEquipmentLines).toBe(2);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildDispatchByJobForeman({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts by jobId asc, dispatches desc within job', () => {
    const r = buildDispatchByJobForeman({
      dispatches: [
        disp({ id: 'a1', jobId: 'A', foremanName: 'small' }),
        disp({ id: 'a2', jobId: 'A', foremanName: 'big' }),
        disp({ id: 'a3', jobId: 'A', foremanName: 'big' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildDispatchByJobForeman({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
