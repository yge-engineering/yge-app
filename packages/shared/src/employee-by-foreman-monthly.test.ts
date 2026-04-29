import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEmployeeByForemanMonthly } from './employee-by-foreman-monthly';

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

describe('buildEmployeeByForemanMonthly', () => {
  it('groups by (foreman, month)', () => {
    const r = buildEmployeeByForemanMonthly({
      dispatches: [
        disp({ id: 'a', foremanName: 'Lopez', scheduledFor: '2026-03-15' }),
        disp({ id: 'b', foremanName: 'Lopez', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', foremanName: 'Garcia', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct employees per pair', () => {
    const r = buildEmployeeByForemanMonthly({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ employeeId: 'e1', name: 'Joe' }, { employeeId: 'e2', name: 'Mary' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-16',
          crew: [{ employeeId: 'e1', name: 'Joe' }, { employeeId: 'e3', name: 'Pete' }],
        }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(3);
  });

  it('counts dispatches and dispatchDays', () => {
    const r = buildEmployeeByForemanMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', scheduledFor: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.dispatches).toBe(3);
    expect(r.rows[0]?.dispatchDays).toBe(2);
  });

  it('skips DRAFT', () => {
    const r = buildEmployeeByForemanMonthly({
      dispatches: [
        disp({ id: 'live' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildEmployeeByForemanMonthly({
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
    const r = buildEmployeeByForemanMonthly({
      dispatches: [
        disp({ id: 'a', foremanName: 'Z', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', foremanName: 'A', scheduledFor: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildEmployeeByForemanMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
