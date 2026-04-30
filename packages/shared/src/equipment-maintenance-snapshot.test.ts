import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentMaintenanceSnapshot } from './equipment-maintenance-snapshot';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'Cat D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 1000,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildEquipmentMaintenanceSnapshot', () => {
  it('counts entries + sums cost', () => {
    const r = buildEquipmentMaintenanceSnapshot({
      asOf: '2026-04-30',
      equipment: eq({
        maintenanceLog: [
          { performedAt: '2026-04-15T00:00:00Z', usageAtService: 950, kind: 'OIL_CHANGE', description: 'Oil', costCents: 50_000 },
          { performedAt: '2026-04-20T00:00:00Z', usageAtService: 980, kind: 'TIRE', description: 'Tire', costCents: 200_000 },
        ],
      }),
    });
    expect(r.totalEntries).toBe(2);
    expect(r.totalCostCents).toBe(250_000);
    expect(r.byKind.OIL_CHANGE).toBe(1);
    expect(r.byKind.TIRE).toBe(1);
  });

  it('tracks last service date', () => {
    const r = buildEquipmentMaintenanceSnapshot({
      asOf: '2026-04-30',
      equipment: eq({
        maintenanceLog: [
          { performedAt: '2026-04-08T00:00:00Z', usageAtService: 900, kind: 'OIL_CHANGE', description: 'Oil', costCents: 0 },
          { performedAt: '2026-04-22T00:00:00Z', usageAtService: 950, kind: 'TIRE', description: 'Tire', costCents: 0 },
        ],
      }),
    });
    expect(r.lastServiceDate).toBe('2026-04-22');
  });

  it('flags service due', () => {
    const r = buildEquipmentMaintenanceSnapshot({
      asOf: '2026-04-30',
      equipment: eq({
        currentUsage: 600,
        lastServiceUsage: 100,
        serviceIntervalUsage: 250,
      }),
    });
    expect(r.isServiceDue).toBe(true);
  });

  it('handles missing equipment', () => {
    const r = buildEquipmentMaintenanceSnapshot({ equipment: undefined });
    expect(r.totalEntries).toBe(0);
    expect(r.isServiceDue).toBe(false);
  });
});
