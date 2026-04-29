import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchByJob } from './dispatch-by-job';

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

describe('buildDispatchByJob', () => {
  it('groups dispatches by jobId', () => {
    const r = buildDispatchByJob({
      dispatches: [
        disp({ id: 'a', jobId: 'j1' }),
        disp({ id: 'b', jobId: 'j1' }),
        disp({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('skips DRAFT', () => {
    const r = buildDispatchByJob({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('computes avg crew size and avg equipment lines', () => {
    const r = buildDispatchByJob({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ name: 'A' }, { name: 'B' }],
          equipment: [{ name: 'X' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-16',
          crew: [{ name: 'C' }, { name: 'D' }, { name: 'E' }, { name: 'F' }],
          equipment: [{ name: 'X' }, { name: 'Y' }, { name: 'Z' }],
        }),
      ],
    });
    expect(r.rows[0]?.avgCrewSize).toBe(3);
    expect(r.rows[0]?.avgEquipmentLines).toBe(2);
  });

  it('counts distinct foremen, dates, employees', () => {
    const r = buildDispatchByJob({
      dispatches: [
        disp({
          id: 'a',
          scheduledFor: '2026-04-15',
          foremanName: 'Lopez',
          crew: [{ name: 'Joe' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-16',
          foremanName: 'Garcia',
          crew: [{ name: 'Mary' }],
        }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctForemen).toBe(2);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('tracks last dispatch date', () => {
    const r = buildDispatchByJob({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-10' }),
        disp({ id: 'b', scheduledFor: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-20');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildDispatchByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts by totalCrewPersonDays desc', () => {
    const r = buildDispatchByJob({
      dispatches: [
        disp({ id: 's', jobId: 'small', crew: [{ name: 'A' }] }),
        disp({
          id: 'b',
          jobId: 'big',
          crew: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
        }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildDispatchByJob({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
