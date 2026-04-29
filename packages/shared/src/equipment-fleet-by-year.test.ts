import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentFleetByYear } from './equipment-fleet-by-year';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    category: 'TRUCK',
    usageMetric: 'HOURS',
    status: 'IN_YARD',
    year: 2020,
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildEquipmentFleetByYear', () => {
  it('groups by year', () => {
    const r = buildEquipmentFleetByYear({
      equipment: [
        eq({ id: 'a', year: 2020 }),
        eq({ id: 'b', year: 2020 }),
        eq({ id: 'c', year: 2022 }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts active vs total', () => {
    const r = buildEquipmentFleetByYear({
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'SOLD' }),
      ],
    });
    expect(r.rows[0]?.total).toBe(3);
    expect(r.rows[0]?.activeCount).toBe(2);
  });

  it('breaks down by category', () => {
    const r = buildEquipmentFleetByYear({
      equipment: [
        eq({ id: 'a', category: 'TRUCK' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
        eq({ id: 'c', category: 'TRUCK' }),
      ],
    });
    expect(r.rows[0]?.byCategory.TRUCK).toBe(2);
  });

  it('counts unattributed (no year)', () => {
    const r = buildEquipmentFleetByYear({
      equipment: [
        eq({ id: 'a', year: 2020 }),
        eq({ id: 'b', year: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('sorts by year asc', () => {
    const r = buildEquipmentFleetByYear({
      equipment: [
        eq({ id: 'a', year: 2025 }),
        eq({ id: 'b', year: 2020 }),
      ],
    });
    expect(r.rows[0]?.year).toBe(2020);
  });

  it('handles empty input', () => {
    const r = buildEquipmentFleetByYear({ equipment: [] });
    expect(r.rows).toHaveLength(0);
  });
});
