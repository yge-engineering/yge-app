import { describe, expect, it } from 'vitest';
import { buildEquipmentMaintenanceCost } from './equipment-maintenance-cost';
import type { Equipment, MaintenanceLogEntry } from './equipment';

function eq(over: Partial<Equipment>, log: Partial<MaintenanceLogEntry>[] = []): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'CAT D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: log.map(
      (m) =>
        ({
          performedAt: '2026-04-01T00:00:00Z',
          usageAtService: 0,
          kind: 'OIL_CHANGE',
          description: 'Service',
          ...m,
        }) as MaintenanceLogEntry,
    ),
    ...over,
  } as Equipment;
}

describe('buildEquipmentMaintenanceCost', () => {
  it('sums cost per equipment in the window', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({}, [
          { performedAt: '2026-04-15T00:00:00Z', kind: 'OIL_CHANGE', costCents: 100_00 },
          { performedAt: '2026-04-20T00:00:00Z', kind: 'TIRE', costCents: 500_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.totalCostCents).toBe(600_00);
    expect(r.rows[0]?.eventCount).toBe(2);
  });

  it('skips equipment with no events in window', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({}, [
          { performedAt: '2026-01-15T00:00:00Z', costCents: 500_00 },
        ]),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('breaks down byKind', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({}, [
          { performedAt: '2026-04-10T00:00:00Z', kind: 'OIL_CHANGE', costCents: 100_00 },
          { performedAt: '2026-04-15T00:00:00Z', kind: 'OIL_CHANGE', costCents: 100_00 },
          { performedAt: '2026-04-20T00:00:00Z', kind: 'BREAKDOWN_REPAIR', costCents: 1_500_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.byKind.OIL_CHANGE).toBe(200_00);
    expect(r.rows[0]?.byKind.BREAKDOWN_REPAIR).toBe(1_500_00);
  });

  it('first/last event dates from the window', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({}, [
          { performedAt: '2026-04-10T00:00:00Z', costCents: 100_00 },
          { performedAt: '2026-04-25T00:00:00Z', costCents: 100_00 },
        ]),
      ],
    });
    expect(r.rows[0]?.firstEventOn).toBe('2026-04-10');
    expect(r.rows[0]?.lastEventOn).toBe('2026-04-25');
  });

  it('sorts highest cost first', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({ id: 'cheap' }, [{ performedAt: '2026-04-10T00:00:00Z', costCents: 100_00 }]),
        eq({ id: 'pricey' }, [{ performedAt: '2026-04-10T00:00:00Z', costCents: 5_000_00 }]),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('pricey');
  });

  it('rollup tallies portfolio total + byKind + unitCount', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({ id: 'a' }, [{ performedAt: '2026-04-10T00:00:00Z', kind: 'OIL_CHANGE', costCents: 100_00 }]),
        eq({ id: 'b' }, [{ performedAt: '2026-04-10T00:00:00Z', kind: 'TIRE', costCents: 200_00 }]),
        eq({ id: 'c' }, []),
      ],
    });
    expect(r.rollup.totalCostCents).toBe(300_00);
    expect(r.rollup.byKind.OIL_CHANGE).toBe(100_00);
    expect(r.rollup.byKind.TIRE).toBe(200_00);
    expect(r.rollup.unitCount).toBe(2);
  });

  it('treats missing costCents as 0', () => {
    const r = buildEquipmentMaintenanceCost({
      start: '2026-04-01',
      end: '2026-04-30',
      equipment: [
        eq({}, [
          { performedAt: '2026-04-10T00:00:00Z', costCents: 100_00 },
          { performedAt: '2026-04-15T00:00:00Z', costCents: undefined },
        ]),
      ],
    });
    expect(r.rows[0]?.totalCostCents).toBe(100_00);
    expect(r.rows[0]?.eventCount).toBe(2);
  });
});
