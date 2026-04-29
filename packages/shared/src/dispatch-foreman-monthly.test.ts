import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchForemanMonthly } from './dispatch-foreman-monthly';

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

describe('buildDispatchForemanMonthly', () => {
  it('groups by (foreman, month) case-insensitive', () => {
    const r = buildDispatchForemanMonthly({
      dispatches: [
        disp({ id: 'a', foremanName: 'Lopez', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', foremanName: 'LOPEZ', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', foremanName: 'Garcia', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const lopez = r.rows.find((x) => x.foremanName.toLowerCase() === 'lopez');
    expect(lopez?.dispatches).toBe(2);
  });

  it('skips DRAFT', () => {
    const r = buildDispatchForemanMonthly({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts distinct dates and jobs', () => {
    const r = buildDispatchForemanMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', jobId: 'j2', scheduledFor: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sums crew + equipment lines', () => {
    const r = buildDispatchForemanMonthly({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ name: 'Joe' }, { name: 'Mary' }],
          equipment: [{ name: 'X' }],
        }),
      ],
    });
    expect(r.rows[0]?.totalCrewLines).toBe(2);
    expect(r.rows[0]?.totalEquipmentLines).toBe(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildDispatchForemanMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15' }),
        disp({ id: 'apr', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts by foreman asc, month asc', () => {
    const r = buildDispatchForemanMonthly({
      dispatches: [
        disp({ id: 'a', foremanName: 'Z', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', foremanName: 'A', scheduledFor: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildDispatchForemanMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
