import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildDispatchMonthlyVolume } from './dispatch-monthly-volume';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Alice',
    scopeOfWork: 'work',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildDispatchMonthlyVolume', () => {
  it('buckets dispatches by yyyy-mm of scheduledFor', () => {
    const r = buildDispatchMonthlyVolume({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-03-15' }),
        disp({ id: 'b', scheduledFor: '2026-03-25' }),
        disp({ id: 'c', scheduledFor: '2026-04-10' }),
      ],
    });
    expect(r.rows.find((x) => x.month === '2026-03')?.dispatchCount).toBe(2);
    expect(r.rows.find((x) => x.month === '2026-04')?.dispatchCount).toBe(1);
  });

  it('counts distinct foremen + jobs per month', () => {
    const r = buildDispatchMonthlyVolume({
      dispatches: [
        disp({ id: 'a', foremanName: 'Alice', jobId: 'j1' }),
        disp({ id: 'b', foremanName: 'Bob', jobId: 'j2' }),
        disp({ id: 'c', foremanName: 'Alice', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctForemen).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sums crew + equipment days', () => {
    const r = buildDispatchMonthlyVolume({
      dispatches: [
        disp({
          crew: [
            { name: 'a' }, { name: 'b' }, { name: 'c' },
          ],
          equipment: [
            { name: 'CAT 320' }, { name: 'F-350' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalCrewDays).toBe(3);
    expect(r.rows[0]?.totalEquipmentDays).toBe(2);
  });

  it('skips DRAFT + CANCELLED', () => {
    const r = buildDispatchMonthlyVolume({
      dispatches: [
        disp({ id: 'd', status: 'DRAFT' }),
        disp({ id: 'c', status: 'CANCELLED' }),
        disp({ id: 'p', status: 'POSTED' }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('respects month bounds', () => {
    const r = buildDispatchMonthlyVolume({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15' }),
        disp({ id: 'apr', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('captures peak month', () => {
    const r = buildDispatchMonthlyVolume({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-03-01' }),
        disp({ id: 'b', scheduledFor: '2026-04-01' }),
        disp({ id: 'c', scheduledFor: '2026-04-15' }),
        disp({ id: 'd', scheduledFor: '2026-04-25' }),
      ],
    });
    expect(r.rollup.peakMonth).toBe('2026-04');
    expect(r.rollup.peakDispatchCount).toBe(3);
  });

  it('computes month-over-month change', () => {
    const r = buildDispatchMonthlyVolume({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-03-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', scheduledFor: '2026-04-25' }),
      ],
    });
    expect(r.rollup.monthOverMonthChange).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildDispatchMonthlyVolume({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakMonth).toBe(null);
  });
});
