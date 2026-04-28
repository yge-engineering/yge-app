import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildDispatchEquipmentCategoryMix } from './dispatch-equipment-category-mix';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'CAT 320E',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    status: 'ACTIVE',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

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

describe('buildDispatchEquipmentCategoryMix', () => {
  it('groups equipment lines by category via id', () => {
    const r = buildDispatchEquipmentCategoryMix({
      equipment: [
        eq({ id: 'eq-1', category: 'EXCAVATOR' }),
        eq({ id: 'eq-2', category: 'TRUCK' }),
      ],
      dispatches: [disp({
        equipment: [
          { equipmentId: 'eq-1', name: 'CAT 320E' },
          { equipmentId: 'eq-2', name: 'F-450' },
        ],
      })],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('falls back to name match when equipmentId not set', () => {
    const r = buildDispatchEquipmentCategoryMix({
      equipment: [eq({ id: 'eq-1', name: 'CAT 320E', category: 'EXCAVATOR' })],
      dispatches: [disp({ equipment: [{ name: 'cat 320E' }] })],
    });
    expect(r.rows[0]?.category).toBe('EXCAVATOR');
  });

  it('uses UNKNOWN for unmatched name', () => {
    const r = buildDispatchEquipmentCategoryMix({
      equipment: [],
      dispatches: [disp({ equipment: [{ name: 'Mystery Machine' }] })],
    });
    expect(r.rows[0]?.category).toBe('UNKNOWN');
    expect(r.rollup.unknownLines).toBe(1);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildDispatchEquipmentCategoryMix({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'live', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'draft', status: 'DRAFT', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('counts distinct dispatches, dates, jobs, units', () => {
    const r = buildDispatchEquipmentCategoryMix({
      equipment: [
        eq({ id: 'a', category: 'EXCAVATOR' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
      ],
      dispatches: [
        disp({ id: 'd1', jobId: 'j1', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'd2', jobId: 'j2', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'b', name: 'Y' }] }),
      ],
    });
    expect(r.rows[0]?.distinctDispatches).toBe(2);
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctUnits).toBe(2);
  });

  it('computes share', () => {
    const r = buildDispatchEquipmentCategoryMix({
      equipment: [
        eq({ id: 'a', category: 'EXCAVATOR' }),
        eq({ id: 'b', category: 'TRUCK' }),
      ],
      dispatches: [disp({
        equipment: [
          { equipmentId: 'a', name: 'X' },
          { equipmentId: 'b', name: 'Y' },
          { equipmentId: 'b', name: 'Y' },
        ],
      })],
    });
    const truck = r.rows.find((x) => x.category === 'TRUCK');
    expect(truck?.share).toBeCloseTo(0.6667, 3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildDispatchEquipmentCategoryMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'in', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildDispatchEquipmentCategoryMix({ equipment: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
