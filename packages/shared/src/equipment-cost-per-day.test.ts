import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildEquipmentCostPerDay } from './equipment-cost-per-day';

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

describe('buildEquipmentCostPerDay', () => {
  it('combines maintenance cost with dispatch days for $/day', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [eq({
        id: 'eq-1',
        maintenanceLog: [
          { performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1000, kind: 'OIL_CHANGE', description: 'Oil', costCents: 80_000 },
          { performedAt: '2026-04-15T00:00:00.000Z', usageAtService: 1100, kind: 'TIRE', description: 'Tires', costCents: 320_000 },
        ],
      })],
      dispatches: [
        disp({ id: 'a', equipment: [{ equipmentId: 'eq-1', name: 'CAT 320E' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'eq-1', name: 'CAT 320E' }] }),
      ],
    });
    expect(r.rows[0]?.totalCostCents).toBe(400_000);
    expect(r.rows[0]?.daysDispatched).toBe(2);
    expect(r.rows[0]?.costPerDayCents).toBe(200_000);
  });

  it('returns null costPerDay when no dispatch days', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [eq({
        id: 'eq-1',
        maintenanceLog: [
          { performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1000, kind: 'OIL_CHANGE', description: 'Oil', costCents: 80_000 },
        ],
      })],
      dispatches: [],
    });
    expect(r.rows[0]?.costPerDayCents).toBeNull();
  });

  it('counts distinct dispatch dates per equipment', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'c', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(2);
  });

  it('falls back to name match when equipmentId not set on dispatch', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [eq({ id: 'eq-1', name: 'CAT 320E' })],
      dispatches: [
        disp({ id: 'a', equipment: [{ name: 'cat 320E' }] }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(1);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'live', status: 'POSTED', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'draft', status: 'DRAFT', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(1);
  });

  it('respects fromDate / toDate window on maintenance + dispatches', () => {
    const r = buildEquipmentCostPerDay({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      equipment: [eq({
        id: 'eq-1',
        maintenanceLog: [
          { performedAt: '2026-03-15T00:00:00.000Z', usageAtService: 1000, kind: 'OIL_CHANGE', description: 'Old', costCents: 99_000 },
          { performedAt: '2026-04-15T00:00:00.000Z', usageAtService: 1100, kind: 'OIL_CHANGE', description: 'In', costCents: 80_000 },
        ],
      })],
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'in', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.rows[0]?.totalCostCents).toBe(80_000);
    expect(r.rows[0]?.daysDispatched).toBe(1);
  });

  it('sorts by costPerDayCents desc, nulls last', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [
        eq({ id: 'cheap', name: 'Cheap', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X', costCents: 10_000 }] }),
        eq({ id: 'spendy', name: 'Spendy', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'TIRE', description: 'X', costCents: 100_000 }] }),
        eq({ id: 'idle', name: 'Idle', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X', costCents: 50_000 }] }),
      ],
      dispatches: [
        disp({ id: 'a', equipment: [{ equipmentId: 'cheap', name: 'Cheap' }] }),
        disp({ id: 'b', equipment: [{ equipmentId: 'spendy', name: 'Spendy' }] }),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('spendy');
    expect(r.rows[1]?.equipmentId).toBe('cheap');
    expect(r.rows[2]?.equipmentId).toBe('idle');
  });

  it('rolls up portfolio cost-per-day', () => {
    const r = buildEquipmentCostPerDay({
      equipment: [eq({
        id: 'eq-1',
        maintenanceLog: [
          { performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1000, kind: 'OIL_CHANGE', description: 'X', costCents: 200_000 },
        ],
      })],
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.rollup.portfolioCostPerDayCents).toBe(100_000);
  });

  it('handles empty input', () => {
    const r = buildEquipmentCostPerDay({ equipment: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
