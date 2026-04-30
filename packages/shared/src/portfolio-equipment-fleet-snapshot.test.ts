import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildPortfolioEquipmentFleetSnapshot } from './portfolio-equipment-fleet-snapshot';

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
    year: 2020,
    ...over,
  } as Equipment;
}

describe('buildPortfolioEquipmentFleetSnapshot', () => {
  it('counts units + status mix', () => {
    const r = buildPortfolioEquipmentFleetSnapshot({
      asOf: '2026-04-30',
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'IN_SERVICE' }),
        eq({ id: 'd', status: 'OUT_FOR_REPAIR' }),
        eq({ id: 'e', status: 'RETIRED' }),
        eq({ id: 'f', status: 'SOLD' }),
      ],
    });
    expect(r.totalUnits).toBe(6);
    expect(r.activeUnits).toBe(4);
    expect(r.retiredOrSoldUnits).toBe(2);
    expect(r.inYardUnits).toBe(1);
    expect(r.assignedUnits).toBe(1);
    expect(r.inServiceUnits).toBe(1);
    expect(r.outForRepairUnits).toBe(1);
  });

  it('breaks down by category', () => {
    const r = buildPortfolioEquipmentFleetSnapshot({
      asOf: '2026-04-30',
      equipment: [
        eq({ id: 'a', category: 'DOZER' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
        eq({ id: 'c', category: 'TRUCK' }),
      ],
    });
    expect(r.byCategory.DOZER).toBe(1);
    expect(r.byCategory.EXCAVATOR).toBe(1);
    expect(r.byCategory.TRUCK).toBe(1);
  });

  it('counts service-due units (excluding retired)', () => {
    const r = buildPortfolioEquipmentFleetSnapshot({
      asOf: '2026-04-30',
      equipment: [
        eq({
          id: 'a',
          status: 'IN_YARD',
          currentUsage: 600,
          lastServiceUsage: 100,
          serviceIntervalUsage: 250,
        }),
      ],
    });
    expect(r.serviceDueUnits).toBe(1);
  });

  it('averages active model year', () => {
    const r = buildPortfolioEquipmentFleetSnapshot({
      asOf: '2026-04-30',
      equipment: [
        eq({ id: 'a', status: 'IN_YARD', year: 2020 }),
        eq({ id: 'b', status: 'ASSIGNED', year: 2024 }),
        eq({ id: 'c', status: 'RETIRED', year: 1985 }),
      ],
    });
    expect(r.averageActiveModelYear).toBe(2022);
  });

  it('handles empty input', () => {
    const r = buildPortfolioEquipmentFleetSnapshot({ equipment: [] });
    expect(r.totalUnits).toBe(0);
    expect(r.averageActiveModelYear).toBeNull();
  });
});
