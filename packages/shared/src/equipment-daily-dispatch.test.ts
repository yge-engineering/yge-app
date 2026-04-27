import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentDispatchDaily } from './equipment-daily-dispatch';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    scheduledFor: '2026-04-01',
    foremanName: 'Lopez',
    scopeOfWork: 'Grade base',
    status: 'POSTED',
    crew: [],
    equipment: [],
    ...over,
  } as Dispatch;
}

describe('buildEquipmentDispatchDaily', () => {
  it('respects window bounds', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'd-old', scheduledFor: '2026-03-01' }),
        disp({ id: 'd-in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('counts distinct equipment per day', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({
          id: 'd-1',
          scheduledFor: '2026-04-15',
          equipment: [
            { equipmentId: 'eq-1', name: 'Cat D6T' },
            { equipmentId: 'eq-2', name: 'F-450' },
          ],
        }),
        disp({
          id: 'd-2',
          scheduledFor: '2026-04-15',
          equipment: [
            { equipmentId: 'eq-1', name: 'Cat D6T' }, // dup
            { equipmentId: 'eq-3', name: 'Roller' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.unitsDispatched).toBe(3);
    expect(r.rows[0]?.dispatchCount).toBe(2);
  });

  it('counts distinct jobs per day', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-15', jobId: 'job-A' }),
        disp({ id: 'd-2', scheduledFor: '2026-04-15', jobId: 'job-B' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('only counts POSTED + COMPLETED by default', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({
          id: 'd-1',
          status: 'DRAFT',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
        disp({
          id: 'd-2',
          status: 'CANCELLED',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('includes DRAFT when includeDraftDispatches=true', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      includeDraftDispatches: true,
      dispatches: [
        disp({
          id: 'd-1',
          status: 'DRAFT',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
      ],
    });
    expect(r.rows[0]?.unitsDispatched).toBe(1);
  });

  it('handles unlinked equipment by name fallback', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({
          id: 'd-1',
          scheduledFor: '2026-04-15',
          equipment: [
            { name: 'Rented Mini-Ex' },
            { name: 'Rented Mini-Ex' }, // dup name (no id)
          ],
        }),
      ],
    });
    expect(r.rows[0]?.unitsDispatched).toBe(1);
  });

  it('rolls up peak day', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({
          id: 'd-light',
          scheduledFor: '2026-04-01',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }],
        }),
        disp({
          id: 'd-heavy',
          scheduledFor: '2026-04-15',
          equipment: [
            { equipmentId: 'eq-1', name: 'X' },
            { equipmentId: 'eq-2', name: 'Y' },
            { equipmentId: 'eq-3', name: 'Z' },
          ],
        }),
      ],
    });
    expect(r.rollup.peakUnitsDispatched).toBe(3);
    expect(r.rollup.peakDate).toBe('2026-04-15');
  });

  it('computes avg units per active day', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({
          id: 'd-1',
          scheduledFor: '2026-04-01',
          equipment: [{ equipmentId: 'eq-1', name: 'X' }, { equipmentId: 'eq-2', name: 'Y' }],
        }),
        disp({
          id: 'd-2',
          scheduledFor: '2026-04-02',
          equipment: [
            { equipmentId: 'eq-1', name: 'X' },
            { equipmentId: 'eq-2', name: 'Y' },
            { equipmentId: 'eq-3', name: 'Z' },
            { equipmentId: 'eq-4', name: 'W' },
          ],
        }),
      ],
    });
    expect(r.rollup.avgUnitsPerActiveDay).toBe(3);
  });

  it('sorts rows by date asc', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [
        disp({ id: 'd-late', scheduledFor: '2026-04-25' }),
        disp({ id: 'd-early', scheduledFor: '2026-04-05' }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
    expect(r.rows[1]?.date).toBe('2026-04-25');
  });

  it('handles empty input', () => {
    const r = buildEquipmentDispatchDaily({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dispatches: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakDate).toBe(null);
  });
});
