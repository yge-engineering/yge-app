import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentMaintenanceByEquipmentMonthly } from './equipment-maintenance-by-equipment-monthly';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'CAT 320E',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    currentUsage: 1000,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildEquipmentMaintenanceByEquipmentMonthly', () => {
  it('groups by (equipment, month)', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      equipment: [
        eq({
          id: 'eq-1',
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'oil', costCents: 100_00 },
            { performedAt: '2026-05-01', usageAtService: 110, kind: 'INSPECTION', description: 'insp', costCents: 50_00 },
          ] as Equipment['maintenanceLog'],
        }),
        eq({
          id: 'eq-2',
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'oil', costCents: 100_00 },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums costCents per (equipment, month)', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      equipment: [
        eq({
          id: 'eq-1',
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a', costCents: 100_00 },
            { performedAt: '2026-04-20', usageAtService: 120, kind: 'OIL_CHANGE', description: 'b', costCents: 50_00 },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rows[0]?.totalCostCents).toBe(150_00);
    expect(r.rows[0]?.events).toBe(2);
  });

  it('counts events with no costCents recorded', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      equipment: [
        eq({
          id: 'eq-1',
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'INSPECTION', description: 'a' },
            { performedAt: '2026-04-20', usageAtService: 120, kind: 'OIL_CHANGE', description: 'b', costCents: 50_00 },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rows[0]?.costMissingCount).toBe(1);
    expect(r.rows[0]?.totalCostCents).toBe(50_00);
  });

  it('breaks down by kind', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      equipment: [
        eq({
          id: 'eq-1',
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a' },
            { performedAt: '2026-04-20', usageAtService: 120, kind: 'OIL_CHANGE', description: 'b' },
            { performedAt: '2026-04-25', usageAtService: 130, kind: 'INSPECTION', description: 'c' },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rows[0]?.byKind.OIL_CHANGE).toBe(2);
    expect(r.rows[0]?.byKind.INSPECTION).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      equipment: [
        eq({
          id: 'eq-1',
          maintenanceLog: [
            { performedAt: '2026-03-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'old' },
            { performedAt: '2026-04-15', usageAtService: 110, kind: 'OIL_CHANGE', description: 'in' },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rollup.totalEvents).toBe(1);
  });

  it('sorts by equipmentId asc, month asc', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      equipment: [
        eq({
          id: 'eq-Z',
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a' },
          ] as Equipment['maintenanceLog'],
        }),
        eq({
          id: 'eq-A',
          maintenanceLog: [
            { performedAt: '2026-05-01', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a' },
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'b' },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('eq-A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.equipmentId).toBe('eq-Z');
  });

  it('handles empty maintenance log', () => {
    const r = buildEquipmentMaintenanceByEquipmentMonthly({
      equipment: [eq({ id: 'eq-1', maintenanceLog: [] })],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalEvents).toBe(0);
  });
});
