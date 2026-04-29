import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentUtilizationMonthly } from './equipment-utilization-monthly';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [],
    equipment: [
      { equipmentId: 'eq-1', name: 'CAT 320E', operatorName: 'Pat' },
    ],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentUtilizationMonthly', () => {
  it('groups by (equipment, month) with distinct dates', () => {
    const r = buildEquipmentUtilizationMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-16' }),
        disp({ id: 'c', scheduledFor: '2026-04-15' }), // dup date
      ],
    });
    expect(r.rows[0]?.dispatchDays).toBe(2);
  });

  it('skips DRAFT + CANCELLED dispatches', () => {
    const r = buildEquipmentUtilizationMonthly({
      dispatches: [
        disp({ id: 'a', status: 'POSTED' }),
        disp({ id: 'b', status: 'DRAFT' }),
        disp({ id: 'c', status: 'CANCELLED' }),
      ],
    });
    expect(r.rollup.totalDispatchDays).toBe(1);
    expect(r.rollup.draftSkipped).toBe(1);
    expect(r.rollup.cancelledSkipped).toBe(1);
  });

  it('counts distinct jobs and operators', () => {
    const r = buildEquipmentUtilizationMonthly({
      dispatches: [
        disp({
          id: 'a',
          jobId: 'j1',
          scheduledFor: '2026-04-15',
          equipment: [
            { equipmentId: 'eq-1', name: 'CAT 320E', operatorName: 'Pat' },
          ],
        }),
        disp({
          id: 'b',
          jobId: 'j2',
          scheduledFor: '2026-04-16',
          equipment: [
            { equipmentId: 'eq-1', name: 'CAT 320E', operatorName: 'Sam' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctOperators).toBe(2);
  });

  it('falls back to name when equipmentId is missing', () => {
    const r = buildEquipmentUtilizationMonthly({
      dispatches: [
        disp({
          id: 'a',
          equipment: [{ equipmentId: undefined, name: 'Service Truck' }],
        }),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('name:service truck');
  });

  it('handles dispatches with multiple equipment lines', () => {
    const r = buildEquipmentUtilizationMonthly({
      dispatches: [
        disp({
          id: 'a',
          equipment: [
            { equipmentId: 'eq-1', name: 'CAT 320E' },
            { equipmentId: 'eq-2', name: 'Roller' },
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildEquipmentUtilizationMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDispatchDays).toBe(1);
  });

  it('sorts by equipmentId asc, month asc', () => {
    const r = buildEquipmentUtilizationMonthly({
      dispatches: [
        disp({
          id: 'a',
          scheduledFor: '2026-04-15',
          equipment: [{ equipmentId: 'eq-Z', name: 'Roller' }],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-05-01',
          equipment: [{ equipmentId: 'eq-A', name: 'CAT' }],
        }),
        disp({
          id: 'c',
          scheduledFor: '2026-04-15',
          equipment: [{ equipmentId: 'eq-A', name: 'CAT' }],
        }),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('eq-A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.equipmentId).toBe('eq-Z');
  });

  it('handles empty input', () => {
    const r = buildEquipmentUtilizationMonthly({ dispatches: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalDispatchDays).toBe(0);
  });
});
