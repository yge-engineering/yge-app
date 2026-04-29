import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentByStatus } from './equipment-by-status';

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

describe('buildEquipmentByStatus', () => {
  it('groups equipment by status', () => {
    const r = buildEquipmentByStatus({
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'IN_YARD' }),
        eq({ id: 'c', status: 'OUT_FOR_REPAIR' }),
      ],
    });
    const yard = r.rows.find((x) => x.status === 'IN_YARD');
    expect(yard?.total).toBe(2);
  });

  it('breaks down by category per status', () => {
    const r = buildEquipmentByStatus({
      equipment: [
        eq({ id: 'a', category: 'TRUCK' }),
        eq({ id: 'b', category: 'TRUCK' }),
        eq({ id: 'c', category: 'EXCAVATOR' }),
      ],
    });
    expect(r.rows[0]?.byCategory.TRUCK).toBe(2);
    expect(r.rows[0]?.byCategory.EXCAVATOR).toBe(1);
  });

  it('sorts IN_YARD → ASSIGNED → IN_SERVICE → OUT_FOR_REPAIR → RETIRED → SOLD', () => {
    const r = buildEquipmentByStatus({
      equipment: [
        eq({ id: 'a', status: 'SOLD' }),
        eq({ id: 'b', status: 'IN_YARD' }),
        eq({ id: 'c', status: 'RETIRED' }),
        eq({ id: 'd', status: 'OUT_FOR_REPAIR' }),
        eq({ id: 'e', status: 'ASSIGNED' }),
      ],
    });
    expect(r.rows.map((x) => x.status)).toEqual([
      'IN_YARD', 'ASSIGNED', 'IN_SERVICE', 'OUT_FOR_REPAIR', 'RETIRED', 'SOLD',
    ]);
  });

  it('rolls up totalUnits and activeCount (active = IN_YARD/ASSIGNED/IN_SERVICE)', () => {
    const r = buildEquipmentByStatus({
      equipment: [
        eq({ id: 'a', status: 'IN_YARD' }),
        eq({ id: 'b', status: 'ASSIGNED' }),
        eq({ id: 'c', status: 'IN_SERVICE' }),
        eq({ id: 'd', status: 'SOLD' }),
        eq({ id: 'e', status: 'RETIRED' }),
      ],
    });
    expect(r.rollup.totalUnits).toBe(5);
    expect(r.rollup.activeCount).toBe(3);
  });

  it('handles empty input', () => {
    const r = buildEquipmentByStatus({ equipment: [] });
    expect(r.rollup.totalUnits).toBe(0);
  });
});
