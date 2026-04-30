import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentMaintenanceYoy } from './equipment-maintenance-yoy';

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

describe('buildEquipmentMaintenanceYoy', () => {
  it('compares two years for one unit', () => {
    const r = buildEquipmentMaintenanceYoy({
      currentYear: 2026,
      equipment: eq({
        maintenanceLog: [
          { performedAt: '2025-04-15T00:00:00Z', usageAtService: 800, kind: 'OIL_CHANGE', description: 'X', costCents: 50_000 },
          { performedAt: '2026-04-15T00:00:00Z', usageAtService: 950, kind: 'TIRE', description: 'X', costCents: 200_000 },
        ],
      }),
    });
    expect(r.priorEntries).toBe(1);
    expect(r.currentEntries).toBe(1);
    expect(r.priorCostCents).toBe(50_000);
    expect(r.currentCostCents).toBe(200_000);
    expect(r.costCentsDelta).toBe(150_000);
  });

  it('handles missing equipment', () => {
    const r = buildEquipmentMaintenanceYoy({ currentYear: 2026, equipment: undefined });
    expect(r.priorEntries).toBe(0);
  });
});
