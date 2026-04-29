import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildPortfolioEquipmentMonthly } from './portfolio-equipment-monthly';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [],
    equipment: [{ equipmentId: 'eq-1', name: 'CAT' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'CAT',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

describe('buildPortfolioEquipmentMonthly', () => {
  it('counts dispatched units + dispatch days', () => {
    const r = buildPortfolioEquipmentMonthly({
      equipment: [],
      dispatches: [
        disp({
          id: 'a',
          scheduledFor: '2026-04-15',
          equipment: [
            { equipmentId: 'eq-1', name: 'CAT' },
            { equipmentId: 'eq-2', name: 'Roller' },
          ],
        }),
        disp({
          id: 'b',
          scheduledFor: '2026-04-16',
          equipment: [{ equipmentId: 'eq-1', name: 'CAT' }],
        }),
      ],
    });
    expect(r.rows[0]?.dispatchedUnits).toBe(2);
    expect(r.rows[0]?.dispatchDays).toBe(3); // (eq-1, 04-15), (eq-2, 04-15), (eq-1, 04-16)
  });

  it('counts maintenance events + cost', () => {
    const r = buildPortfolioEquipmentMonthly({
      dispatches: [],
      equipment: [
        eq({
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a', costCents: 50_00 },
            { performedAt: '2026-04-20', usageAtService: 110, kind: 'INSPECTION', description: 'b' },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rows[0]?.maintenanceEvents).toBe(2);
    expect(r.rows[0]?.maintenanceCostCents).toBe(50_00);
  });

  it('skips DRAFT + CANCELLED dispatches', () => {
    const r = buildPortfolioEquipmentMonthly({
      equipment: [],
      dispatches: [
        disp({ id: 'a', status: 'POSTED' }),
        disp({ id: 'b', status: 'DRAFT' }),
        disp({ id: 'c', status: 'CANCELLED' }),
      ],
    });
    expect(r.rows[0]?.dispatchDays).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioEquipmentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dispatches: [
        disp({ id: 'old', scheduledFor: '2026-03-15' }),
        disp({ id: 'in', scheduledFor: '2026-04-15' }),
      ],
      equipment: [],
    });
    expect(r.rollup.totalDispatchDays).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildPortfolioEquipmentMonthly({
      dispatches: [disp({ id: 'a' })],
      equipment: [
        eq({
          maintenanceLog: [
            { performedAt: '2026-04-15', usageAtService: 100, kind: 'OIL_CHANGE', description: 'a', costCents: 100_00 },
          ] as Equipment['maintenanceLog'],
        }),
      ],
    });
    expect(r.rollup.totalDispatchDays).toBe(1);
    expect(r.rollup.totalMaintenanceEvents).toBe(1);
    expect(r.rollup.totalMaintenanceCostCents).toBe(100_00);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioEquipmentMonthly({
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-06-15' }),
        disp({ id: 'b', scheduledFor: '2026-04-15' }),
      ],
      equipment: [],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioEquipmentMonthly({ dispatches: [], equipment: [] });
    expect(r.rows).toHaveLength(0);
  });
});
