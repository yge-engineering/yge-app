import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentFleetByCategory } from './equipment-fleet-by-category';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    name: 'CAT 320E',
    category: 'EXCAVATOR',
    make: 'CAT',
    year: 2020,
    usageMetric: 'HOURS',
    currentUsage: 1000,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildEquipmentFleetByCategory', () => {
  it('groups by category', () => {
    const r = buildEquipmentFleetByCategory({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', category: 'EXCAVATOR' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
        eq({ id: 'c', category: 'DOZER' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts active vs inactive', () => {
    const r = buildEquipmentFleetByCategory({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'OUT_FOR_REPAIR' }),
        eq({ id: 'd', status: 'SOLD' }),
      ],
    });
    expect(r.rows[0]?.activeCount).toBe(2);
    expect(r.rows[0]?.inactiveCount).toBe(2);
  });

  it('computes avg + max age in years', () => {
    const r = buildEquipmentFleetByCategory({
      asOf: new Date('2026-06-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', year: 2020 }),
        eq({ id: 'b', year: 2010 }),
        eq({ id: 'c', year: 2024 }),
      ],
    });
    // Ages: 6, 16, 2 → mean 8, max 16
    expect(r.rows[0]?.avgAgeYears).toBe(8);
    expect(r.rows[0]?.maxAgeYears).toBe(16);
  });

  it('breaks down by make', () => {
    const r = buildEquipmentFleetByCategory({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', make: 'CAT' }),
        eq({ id: 'b', make: 'CAT' }),
        eq({ id: 'c', make: 'Komatsu' }),
      ],
    });
    expect(r.rows[0]?.makeMix.CAT).toBe(2);
    expect(r.rows[0]?.makeMix.Komatsu).toBe(1);
  });

  it('falls to Unknown when make is missing', () => {
    const r = buildEquipmentFleetByCategory({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [eq({ id: 'a', make: undefined })],
    });
    expect(r.rows[0]?.makeMix.Unknown).toBe(1);
  });

  it('sorts by total desc', () => {
    const r = buildEquipmentFleetByCategory({
      asOf: new Date('2026-04-15T00:00:00Z'),
      equipment: [
        eq({ id: 'a', category: 'DOZER' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
        eq({ id: 'c', category: 'EXCAVATOR' }),
      ],
    });
    expect(r.rows[0]?.category).toBe('EXCAVATOR');
  });

  it('handles empty input', () => {
    const r = buildEquipmentFleetByCategory({ equipment: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalUnits).toBe(0);
  });
});
