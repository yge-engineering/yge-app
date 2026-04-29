import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentByMake } from './equipment-by-make';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    category: 'TRUCK',
    usageMetric: 'HOURS',
    status: 'IN_YARD',
    make: 'CAT',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildEquipmentByMake', () => {
  it('groups by make case-insensitive', () => {
    const r = buildEquipmentByMake({
      equipment: [
        eq({ id: 'a', make: 'CAT' }),
        eq({ id: 'b', make: 'cat' }),
        eq({ id: 'c', make: 'Komatsu' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts active vs total (IN_YARD/ASSIGNED/IN_SERVICE = active)', () => {
    const r = buildEquipmentByMake({
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'IN_SERVICE' }),
        eq({ id: 'd', status: 'SOLD' }),
        eq({ id: 'e', status: 'RETIRED' }),
      ],
    });
    expect(r.rows[0]?.total).toBe(5);
    expect(r.rows[0]?.activeCount).toBe(3);
  });

  it('breaks down by category', () => {
    const r = buildEquipmentByMake({
      equipment: [
        eq({ id: 'a', category: 'TRUCK' }),
        eq({ id: 'b', category: 'TRUCK' }),
        eq({ id: 'c', category: 'EXCAVATOR' }),
      ],
    });
    expect(r.rows[0]?.byCategory.TRUCK).toBe(2);
    expect(r.rows[0]?.byCategory.EXCAVATOR).toBe(1);
  });

  it('counts unattributed (no make)', () => {
    const r = buildEquipmentByMake({
      equipment: [
        eq({ id: 'a', make: 'CAT' }),
        eq({ id: 'b', make: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by total desc', () => {
    const r = buildEquipmentByMake({
      equipment: [
        eq({ id: 'a', make: 'Volvo' }),
        eq({ id: 'b', make: 'CAT' }),
        eq({ id: 'c', make: 'CAT' }),
        eq({ id: 'd', make: 'CAT' }),
      ],
    });
    expect(r.rows[0]?.make).toBe('CAT');
  });

  it('handles empty input', () => {
    const r = buildEquipmentByMake({ equipment: [] });
    expect(r.rows).toHaveLength(0);
  });
});
