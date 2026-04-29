import { describe, expect, it } from 'vitest';

import type { Equipment } from './equipment';

import { buildEquipmentMaintenanceByMake } from './equipment-maintenance-by-make';

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

describe('buildEquipmentMaintenanceByMake', () => {
  it('groups by make case-insensitive', () => {
    const r = buildEquipmentMaintenanceByMake({
      equipment: [
        eq({ id: 'a', make: 'CAT', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X', costCents: 50_000 }] }),
        eq({ id: 'b', make: 'cat', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'Y', costCents: 30_000 }] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalCostCents).toBe(80_000);
  });

  it('counts events and units', () => {
    const r = buildEquipmentMaintenanceByMake({
      equipment: [
        eq({
          id: 'a',
          maintenanceLog: [
            { performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X', costCents: 50_000 },
            { performedAt: '2026-04-15T00:00:00.000Z', usageAtService: 2, kind: 'TIRE', description: 'Y', costCents: 200_000 },
          ],
        }),
        eq({ id: 'b', maintenanceLog: [] }),
      ],
    });
    expect(r.rows[0]?.eventCount).toBe(2);
    expect(r.rows[0]?.units).toBe(2);
  });

  it('breaks down by maintenance kind', () => {
    const r = buildEquipmentMaintenanceByMake({
      equipment: [eq({
        maintenanceLog: [
          { performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X' },
          { performedAt: '2026-04-15T00:00:00.000Z', usageAtService: 2, kind: 'OIL_CHANGE', description: 'Y' },
          { performedAt: '2026-04-20T00:00:00.000Z', usageAtService: 3, kind: 'TIRE', description: 'Z' },
        ],
      })],
    });
    expect(r.rows[0]?.byKind.OIL_CHANGE).toBe(2);
    expect(r.rows[0]?.byKind.TIRE).toBe(1);
  });

  it('counts unattributed (no make)', () => {
    const r = buildEquipmentMaintenanceByMake({
      equipment: [
        eq({ id: 'a', make: 'CAT' }),
        eq({ id: 'b', make: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildEquipmentMaintenanceByMake({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      equipment: [eq({
        maintenanceLog: [
          { performedAt: '2026-03-15T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'old', costCents: 99_000 },
          { performedAt: '2026-04-15T00:00:00.000Z', usageAtService: 2, kind: 'OIL_CHANGE', description: 'in', costCents: 50_000 },
        ],
      })],
    });
    expect(r.rows[0]?.totalCostCents).toBe(50_000);
  });

  it('sorts by totalCostCents desc', () => {
    const r = buildEquipmentMaintenanceByMake({
      equipment: [
        eq({ id: 'a', make: 'small', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X', costCents: 5_000 }] }),
        eq({ id: 'b', make: 'big', maintenanceLog: [{ performedAt: '2026-04-01T00:00:00.000Z', usageAtService: 1, kind: 'OIL_CHANGE', description: 'X', costCents: 50_000 }] }),
      ],
    });
    expect(r.rows[0]?.make).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildEquipmentMaintenanceByMake({ equipment: [] });
    expect(r.rows).toHaveLength(0);
  });
});
