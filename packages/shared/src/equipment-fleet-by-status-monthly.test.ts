import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildEquipmentFleetByStatusMonthly } from './equipment-fleet-by-status-monthly';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    category: 'TRUCK',
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

describe('buildEquipmentFleetByStatusMonthly', () => {
  it('groups by (month, equipment status)', () => {
    const r = buildEquipmentFleetByStatusMonthly({
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'OUT_FOR_REPAIR' }),
      ],
      dispatches: [
        disp({ id: 'd1', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'd2', equipment: [{ equipmentId: 'b', name: 'Y' }] }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts unmatched (no equipmentId or no registry match)', () => {
    const r = buildEquipmentFleetByStatusMonthly({
      equipment: [],
      dispatches: [disp({ equipment: [{ name: 'Mystery' }, { equipmentId: 'unknown', name: 'X' }] })],
    });
    expect(r.rollup.unmatchedLines).toBe(2);
  });

  it('skips DRAFT', () => {
    const r = buildEquipmentFleetByStatusMonthly({
      equipment: [eq({ id: 'a' })],
      dispatches: [
        disp({ id: 'live', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'draft', status: 'DRAFT', equipment: [{ equipmentId: 'a', name: 'X' }] }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('counts distinct units per (month, status)', () => {
    const r = buildEquipmentFleetByStatusMonthly({
      equipment: [eq({ id: 'a' }), eq({ id: 'b' })],
      dispatches: [
        disp({ id: 'd1', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'd2', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'b', name: 'Y' }] }),
      ],
    });
    expect(r.rows[0]?.distinctUnits).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildEquipmentFleetByStatusMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      equipment: [eq({ id: 'a' })],
      dispatches: [
        disp({ id: 'mar', scheduledFor: '2026-03-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
        disp({ id: 'apr', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'a', name: 'X' }] }),
      ],
    });
    expect(r.rollup.totalDispatches).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildEquipmentFleetByStatusMonthly({ equipment: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
