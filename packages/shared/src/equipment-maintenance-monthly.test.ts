import { describe, expect, it } from 'vitest';

import type { Equipment, MaintenanceLogEntry } from './equipment';

import { buildEquipmentMaintenanceMonthly } from './equipment-maintenance-monthly';

function eq(over: Partial<Equipment> & Pick<Equipment, 'name'>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

function log(over: Partial<MaintenanceLogEntry>): MaintenanceLogEntry {
  return {
    performedAt: '2026-04-15T00:00:00.000Z',
    usageAtService: 1000,
    kind: 'OIL_CHANGE',
    description: 'Routine oil change',
    costCents: 25_000,
    ...over,
  } as MaintenanceLogEntry;
}

describe('buildEquipmentMaintenanceMonthly', () => {
  it('buckets maintenance events by yyyy-mm of performedAt', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({
          name: 'CAT 320',
          maintenanceLog: [
            log({ performedAt: '2026-03-15T00:00:00.000Z' }),
            log({ performedAt: '2026-04-10T00:00:00.000Z' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums total cost', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({
          name: 'CAT 320',
          maintenanceLog: [
            log({ costCents: 100_00 }),
            log({ costCents: 250_00 }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalCostCents).toBe(350_00);
  });

  it('flags entries without costCents', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({
          name: 'CAT',
          maintenanceLog: [
            log({ costCents: 100_00 }),
            log({ costCents: undefined }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.costMissingCount).toBe(1);
    expect(r.rows[0]?.totalCostCents).toBe(100_00);
  });

  it('counts distinct equipment per month', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({ id: 'a', name: 'A', maintenanceLog: [log({})] }),
        eq({ id: 'b', name: 'B', maintenanceLog: [log({})] }),
      ],
    });
    expect(r.rows[0]?.distinctEquipment).toBe(2);
  });

  it('breaks down by maintenance kind', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({
          name: 'CAT',
          maintenanceLog: [
            log({ kind: 'OIL_CHANGE' }),
            log({ kind: 'OIL_CHANGE' }),
            log({ kind: 'TIRE' }),
            log({ kind: 'BREAKDOWN_REPAIR' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.byKind.OIL_CHANGE).toBe(2);
    expect(r.rows[0]?.byKind.TIRE).toBe(1);
    expect(r.rows[0]?.byKind.BREAKDOWN_REPAIR).toBe(1);
  });

  it('respects month bounds', () => {
    const r = buildEquipmentMaintenanceMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      equipment: [
        eq({
          name: 'CAT',
          maintenanceLog: [
            log({ performedAt: '2026-03-15T00:00:00.000Z' }),
            log({ performedAt: '2026-04-15T00:00:00.000Z' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month cost change', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({
          name: 'CAT',
          maintenanceLog: [
            log({ performedAt: '2026-03-15T00:00:00.000Z', costCents: 100_00 }),
            log({ performedAt: '2026-04-15T00:00:00.000Z', costCents: 300_00 }),
          ],
        }),
      ],
    });
    expect(r.rollup.monthOverMonthCostChange).toBe(200_00);
  });

  it('sorts rows by month asc', () => {
    const r = buildEquipmentMaintenanceMonthly({
      equipment: [
        eq({
          name: 'CAT',
          maintenanceLog: [
            log({ performedAt: '2026-04-15T00:00:00.000Z' }),
            log({ performedAt: '2026-02-15T00:00:00.000Z' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildEquipmentMaintenanceMonthly({ equipment: [] });
    expect(r.rows).toHaveLength(0);
  });
});
