import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobDispatchByDayOfWeek } from './job-dispatch-by-day-of-week';

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

describe('buildJobDispatchByDayOfWeek', () => {
  it('groups by (job, day of week)', () => {
    const r = buildJobDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13' }), // Mon
        disp({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-15' }), // Wed
        disp({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-13' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('skips DRAFT', () => {
    const r = buildJobDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'live' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts distinct dates', () => {
    const r = buildJobDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-13' }),
        disp({ id: 'b', scheduledFor: '2026-04-13' }),
        disp({ id: 'c', scheduledFor: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJobDispatchByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-04-13' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('sorts Mon-first within job', () => {
    const r = buildJobDispatchByDayOfWeek({
      dispatches: [
        disp({ id: 'sat', scheduledFor: '2026-04-18' }),
        disp({ id: 'mon', scheduledFor: '2026-04-13' }),
      ],
    });
    expect(r.rows[0]?.label).toBe('Monday');
  });

  it('handles empty input', () => {
    const r = buildJobDispatchByDayOfWeek({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
