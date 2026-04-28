import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobDispatchSummary } from './job-dispatch-summary';

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

describe('buildJobDispatchSummary', () => {
  it('groups dispatches by jobId', () => {
    const r = buildJobDispatchSummary({
      dispatches: [
        disp({ id: 'a', jobId: 'j1' }),
        disp({ id: 'b', jobId: 'j1' }),
        disp({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildJobDispatchSummary({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts COMPLETED dispatches', () => {
    const r = buildJobDispatchSummary({
      dispatches: [disp({ id: 'done', status: 'COMPLETED' })],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts distinct dates, foremen, employees, equipment lines', () => {
    const r = buildJobDispatchSummary({
      dispatches: [
        disp({
          id: 'a',
          scheduledFor: '2026-04-15',
          foremanName: 'Lopez',
          crew: [
            { name: 'Joe' },
            { name: 'Mary' },
          ],
          equipment: [{ name: 'CAT 320E' }, { name: 'F-450' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-16',
          foremanName: 'Garcia',
          crew: [
            { name: 'Joe' },
          ],
          equipment: [{ name: 'CAT 320E' }],
        }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctForemen).toBe(2);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.equipmentLines).toBe(3);
  });

  it('tracks last dispatch date', () => {
    const r = buildJobDispatchSummary({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-10' }),
        disp({ id: 'b', scheduledFor: '2026-04-20' }),
        disp({ id: 'c', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-20');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJobDispatchSummary({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts by dispatches desc', () => {
    const r = buildJobDispatchSummary({
      dispatches: [
        disp({ id: 's', jobId: 'small' }),
        disp({ id: 'b1', jobId: 'big' }),
        disp({ id: 'b2', jobId: 'big' }),
        disp({ id: 'b3', jobId: 'big' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildJobDispatchSummary({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
