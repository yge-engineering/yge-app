import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchByDayOfWeek } from './dispatch-by-day-of-week';

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

describe('buildDispatchByDayOfWeek', () => {
  it('groups by UTC day of week (2026-04-15 is Wednesday)', () => {
    const r = buildDispatchByDayOfWeek({
      dispatches: [disp({ scheduledFor: '2026-04-15' })],
    });
    expect(r.rows[0]?.label).toBe('Wednesday');
    expect(r.rows[0]?.dayOfWeek).toBe(3);
  });

  it('counts distinct dates and jobs per day-of-week', () => {
    // 2026-04-13 = Monday, 2026-04-20 = Monday
    const r = buildDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-13', jobId: 'j1' }),
        disp({ id: 'b', scheduledFor: '2026-04-13', jobId: 'j2' }),
        disp({ id: 'c', scheduledFor: '2026-04-20', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.label).toBe('Monday');
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.dispatches).toBe(3);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'a', status: 'POSTED' }),
        disp({ id: 'b', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sums crew + equipment lines, computes avg crew size', () => {
    const r = buildDispatchByDayOfWeek({
      dispatches: [
        disp({
          id: 'a',
          crew: [{ name: 'Joe' }, { name: 'Mary' }],
          equipment: [{ name: 'CAT 320E' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-22',
          crew: [{ name: 'Pete' }, { name: 'Sue' }, { name: 'Tom' }],
          equipment: [{ name: 'F-450' }],
        }),
      ],
    });
    // Both 04-15 and 04-22 are Wednesdays, so both fall on Wednesday row.
    expect(r.rows[0]?.totalCrewLines).toBe(5);
    expect(r.rows[0]?.avgCrewSize).toBe(2.5);
    expect(r.rows[0]?.totalEquipmentLines).toBe(2);
  });

  it('sorts Mon → Tue → Wed → Thu → Fri → Sat → Sun', () => {
    // 2026-04-13=Mon, 14=Tue, 15=Wed, 19=Sun, 18=Sat
    const r = buildDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'sun', scheduledFor: '2026-04-19' }),
        disp({ id: 'sat', scheduledFor: '2026-04-18' }),
        disp({ id: 'wed', scheduledFor: '2026-04-15' }),
        disp({ id: 'mon', scheduledFor: '2026-04-13' }),
      ],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Wednesday', 'Saturday', 'Sunday']);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildDispatchByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-04-13' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildDispatchByDayOfWeek({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
