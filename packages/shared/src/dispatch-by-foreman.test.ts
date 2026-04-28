import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchByForeman } from './dispatch-by-foreman';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Lopez',
    scopeOfWork: 'Subgrade prep',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildDispatchByForeman', () => {
  it('groups dispatches by foremanName (case-insensitive)', () => {
    const r = buildDispatchByForeman({
      dispatches: [
        disp({ id: 'a', foremanName: 'Lopez' }),
        disp({ id: 'b', foremanName: 'LOPEZ' }),
        disp({ id: 'c', foremanName: 'lopez' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.dispatches).toBe(3);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildDispatchByForeman({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts COMPLETED dispatches', () => {
    const r = buildDispatchByForeman({
      dispatches: [disp({ id: 'done', status: 'COMPLETED' })],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts distinct dates + jobs per foreman', () => {
    const r = buildDispatchByForeman({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', jobId: 'j2', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', jobId: 'j1', scheduledFor: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('computes avg crew size and equipment lines', () => {
    const r = buildDispatchByForeman({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ name: 'Joe' }, { name: 'Mary' }, { name: 'Pete' }],
          equipment: [{ name: 'CAT 320E' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-16',
          crew: [{ name: 'Joe' }],
          equipment: [{ name: 'F-450' }, { name: 'CAT 320E' }],
        }),
      ],
    });
    expect(r.rows[0]?.crewLines).toBe(4);
    expect(r.rows[0]?.avgCrewSize).toBe(2);
    expect(r.rows[0]?.equipmentLines).toBe(3);
  });

  it('tracks last dispatch date', () => {
    const r = buildDispatchByForeman({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-10' }),
        disp({ id: 'b', scheduledFor: '2026-04-20' }),
        disp({ id: 'c', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-20');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildDispatchByForeman({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts foremen by dispatches desc', () => {
    const r = buildDispatchByForeman({
      dispatches: [
        disp({ id: 's', foremanName: 'Small' }),
        disp({ id: 'b1', foremanName: 'Big' }),
        disp({ id: 'b2', foremanName: 'Big' }),
        disp({ id: 'b3', foremanName: 'Big' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('Big');
  });

  it('handles empty input', () => {
    const r = buildDispatchByForeman({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
