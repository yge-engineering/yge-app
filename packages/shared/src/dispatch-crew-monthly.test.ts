import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchCrewMonthly } from './dispatch-crew-monthly';

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

describe('buildDispatchCrewMonthly', () => {
  it('groups by (employee, month)', () => {
    const r = buildDispatchCrewMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-03-15', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-15', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'c', scheduledFor: '2026-04-15', crew: [{ employeeId: 'e2', name: 'Mary' }] }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct dispatch days per (employee, month)', () => {
    const r = buildDispatchCrewMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-15', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'c', scheduledFor: '2026-04-16', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
      ],
    });
    expect(r.rows[0]?.dispatchDays).toBe(2);
    expect(r.rows[0]?.dispatches).toBe(3);
  });

  it('counts distinct jobs', () => {
    const r = buildDispatchCrewMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'b', jobId: 'j2', scheduledFor: '2026-04-16', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildDispatchCrewMonthly({
      dispatches: [
        disp({ id: 'live', status: 'POSTED', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'draft', status: 'DRAFT', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('falls back to name when employeeId missing', () => {
    const r = buildDispatchCrewMonthly({
      dispatches: [disp({ crew: [{ name: 'Joe' }] })],
    });
    expect(r.rows[0]?.employeeId).toContain('joe');
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildDispatchCrewMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
        disp({ id: 'apr', scheduledFor: '2026-04-15', crew: [{ employeeId: 'e1', name: 'Joe' }] }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts by employeeId asc, month asc', () => {
    const r = buildDispatchCrewMonthly({
      dispatches: [
        disp({ id: 'a', crew: [{ employeeId: 'Z', name: 'X' }] }),
        disp({ id: 'b', crew: [{ employeeId: 'A', name: 'Y' }] }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildDispatchCrewMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
