import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobEquipmentMonthly } from './job-equipment-monthly';

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
    equipment: [{ name: 'CAT 320E' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobEquipmentMonthly', () => {
  it('groups by (jobId, month)', () => {
    const r = buildJobEquipmentMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'j1', scheduledFor: '2026-03-15' }),
        disp({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts equipment lines and distinct units', () => {
    const r = buildJobEquipmentMonthly({
      dispatches: [
        disp({
          id: 'a',
          equipment: [
            { equipmentId: 'eq-1', name: 'X' },
            { equipmentId: 'eq-2', name: 'Y' },
          ],
        }),
        disp({
          id: 'b',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
      ],
    });
    expect(r.rows[0]?.equipmentLines).toBe(3);
    expect(r.rows[0]?.distinctUnits).toBe(2);
  });

  it('skips dispatches with no equipment', () => {
    const r = buildJobEquipmentMonthly({
      dispatches: [
        disp({ id: 'with', equipment: [{ name: 'X' }] }),
        disp({ id: 'without', equipment: [] }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildJobEquipmentMonthly({
      dispatches: [
        disp({ id: 'live', status: 'POSTED' }),
        disp({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildJobEquipmentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15' }),
        disp({ id: 'apr', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobEquipmentMonthly({
      dispatches: [
        disp({ id: 'a', jobId: 'Z', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', jobId: 'A', scheduledFor: '2026-04-15' }),
        disp({ id: 'c', jobId: 'A', scheduledFor: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildJobEquipmentMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
