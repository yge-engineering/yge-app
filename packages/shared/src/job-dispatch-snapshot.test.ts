import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobDispatchSnapshot } from './job-dispatch-snapshot';

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'Trench + lay pipe',
    crew: [{ name: 'A' }, { name: 'B' }],
    equipment: [{ name: 'CAT 320E' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobDispatchSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobDispatchSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', jobId: 'j1' }),
        dp({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalDispatches).toBe(1);
  });

  it('sums crew + equipment seats', () => {
    const r = buildJobDispatchSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', crew: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], equipment: [{ name: 'X' }, { name: 'Y' }] }),
        dp({ id: 'b', crew: [{ name: 'D' }], equipment: [] }),
      ],
    });
    expect(r.totalCrewSeats).toBe(4);
    expect(r.totalEquipmentSlots).toBe(2);
  });

  it('breaks down by status + counts distinct foremen', () => {
    const r = buildJobDispatchSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', status: 'DRAFT', foremanName: 'Pat' }),
        dp({ id: 'b', status: 'POSTED', foremanName: 'Sam' }),
      ],
    });
    expect(r.byStatus.DRAFT).toBe(1);
    expect(r.byStatus.POSTED).toBe(1);
    expect(r.distinctForemen).toBe(2);
  });

  it('tracks last dispatch date', () => {
    const r = buildJobDispatchSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', scheduledFor: '2026-04-08' }),
        dp({ id: 'b', scheduledFor: '2026-04-22' }),
      ],
    });
    expect(r.lastDispatchDate).toBe('2026-04-22');
  });

  it('handles no matching dispatches', () => {
    const r = buildJobDispatchSnapshot({ jobId: 'j1', dispatches: [] });
    expect(r.totalDispatches).toBe(0);
    expect(r.lastDispatchDate).toBeNull();
  });
});
