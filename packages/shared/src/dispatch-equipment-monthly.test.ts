import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildDispatchEquipmentMonthly } from './dispatch-equipment-monthly';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'CAT 320E',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    status: 'IN_YARD',
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

describe('buildDispatchEquipmentMonthly', () => {
  it('groups by (month, category)', () => {
    const r = buildDispatchEquipmentMonthly({
      equipment: [
        eq({ id: 'a', category: 'EXCAVATOR' }),
        eq({ id: 'b', category: 'TRUCK' }),
      ],
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'b', name: 'Y' }] }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('tags unmatched name as UNKNOWN', () => {
    const r = buildDispatchEquipmentMonthly({
      equipment: [],
      dispatches: [disp({ equipment: [{ name: 'Mystery' }] })],
    });
    expect(r.rows[0]?.category).toBe('UNKNOWN');
    expect(r.rollup.unknownLines).toBe(1);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildDispatchEquipmentMonthly({
      equipment: [eq({ id: 'a' })],
      dispatches: [
        disp({ id: 'live', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'draft', status: 'DRAFT', equipment: [{ equipmentId: 'a', name: 'X' }] }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('counts distinct dates and units', () => {
    const r = buildDispatchEquipmentMonthly({
      equipment: [eq({ id: 'a' }), eq({ id: 'b' })],
      dispatches: [
        disp({ id: 'd1', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'd2', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'b', name: 'Y' }] }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctUnits).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildDispatchEquipmentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      equipment: [eq({ id: 'a' })],
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'apr', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
      ],
    });
    expect(r.rollup.totalLines).toBe(1);
  });

  it('sorts by month asc, category asc', () => {
    const r = buildDispatchEquipmentMonthly({
      equipment: [
        eq({ id: 'a', category: 'TRUCK' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
      ],
      dispatches: [
        disp({ id: 'd1', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }, { equipmentId: 'b', name: 'Y' }] }),
        disp({ id: 'd2', scheduledFor: '2026-03-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-03');
    expect(r.rows[1]?.month).toBe('2026-04');
    expect(r.rows[1]?.category).toBe('EXCAVATOR');
  });

  it('handles empty input', () => {
    const r = buildDispatchEquipmentMonthly({ equipment: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
