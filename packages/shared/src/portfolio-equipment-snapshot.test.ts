import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildPortfolioEquipmentSnapshot } from './portfolio-equipment-snapshot';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'CAT',
    category: 'EXCAVATOR',
    make: 'CAT',
    year: 2020,
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildPortfolioEquipmentSnapshot', () => {
  it('counts total + active vs inactive + status mix', () => {
    const r = buildPortfolioEquipmentSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'OUT_FOR_REPAIR' }),
        eq({ id: 'd', status: 'SOLD' }),
      ],
    });
    expect(r.totalUnits).toBe(4);
    expect(r.activeCount).toBe(2);
    expect(r.inactiveCount).toBe(2);
    expect(r.byStatus.IN_YARD).toBe(1);
    expect(r.byStatus.ASSIGNED).toBe(1);
  });

  it('breaks down by category + make', () => {
    const r = buildPortfolioEquipmentSnapshot({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', category: 'EXCAVATOR', make: 'CAT' }),
        eq({ id: 'b', category: 'DOZER', make: 'CAT' }),
        eq({ id: 'c', category: 'EXCAVATOR', make: 'Komatsu' }),
      ],
    });
    expect(r.byCategory.EXCAVATOR).toBe(2);
    expect(r.byCategory.DOZER).toBe(1);
    expect(r.byMake.CAT).toBe(2);
    expect(r.byMake.Komatsu).toBe(1);
  });

  it('computes avg + max age', () => {
    const r = buildPortfolioEquipmentSnapshot({
      asOf: new Date('2026-06-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', year: 2020 }),
        eq({ id: 'b', year: 2010 }),
        eq({ id: 'c', year: 2024 }),
      ],
    });
    // Ages: 6, 16, 2 → mean 8, max 16
    expect(r.avgAgeYears).toBe(8);
    expect(r.maxAgeYears).toBe(16);
  });

  it('handles empty input', () => {
    const r = buildPortfolioEquipmentSnapshot({ equipment: [] });
    expect(r.totalUnits).toBe(0);
  });
});
