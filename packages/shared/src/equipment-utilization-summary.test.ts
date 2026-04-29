import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildEquipmentUtilizationSummary } from './equipment-utilization-summary';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    category: 'EXCAVATOR',
    usageMetric: 'HOURS',
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Lopez',
    scopeOfWork: 'Dirt',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentUtilizationSummary', () => {
  it('counts working days (Mon-Fri) in window', () => {
    // 2026-04-13 (Mon) → 2026-04-19 (Sun) = 5 working days
    const r = buildEquipmentUtilizationSummary({
      equipment: [],
      dispatches: [],
      fromDate: '2026-04-13',
      toDate: '2026-04-19',
    });
    expect(r.rollup.workingDays).toBe(5);
  });

  it('classifies HEAVY when >60% of working days dispatched', () => {
    // 5 working days; equipment dispatched Mon, Tue, Wed, Thu = 4/5 = 80%
    const r = buildEquipmentUtilizationSummary({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-13', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-14', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'c', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'd', scheduledFor: '2026-04-16', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
      fromDate: '2026-04-13',
      toDate: '2026-04-19',
    });
    const heavy = r.rows.find((x) => x.tier === 'HEAVY');
    expect(heavy?.count).toBe(1);
  });

  it('classifies IDLE when <5% utilization', () => {
    const r = buildEquipmentUtilizationSummary({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [],
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });
    const idle = r.rows.find((x) => x.tier === 'IDLE');
    expect(idle?.count).toBe(1);
  });

  it('classifies NORMAL when 30-60% utilization', () => {
    // 5 working days; 2 dispatched = 40%
    const r = buildEquipmentUtilizationSummary({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'a', scheduledFor: '2026-04-13', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
        disp({ id: 'b', scheduledFor: '2026-04-14', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
      fromDate: '2026-04-13',
      toDate: '2026-04-19',
    });
    expect(r.rows.find((x) => x.tier === 'NORMAL')?.count).toBe(1);
  });

  it('breaks down by category per tier', () => {
    const r = buildEquipmentUtilizationSummary({
      equipment: [
        eq({ id: 'a', category: 'EXCAVATOR' }),
        eq({ id: 'b', category: 'TRUCK' }),
      ],
      dispatches: [],
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });
    const idle = r.rows.find((x) => x.tier === 'IDLE');
    expect(idle?.byCategory.EXCAVATOR).toBe(1);
    expect(idle?.byCategory.TRUCK).toBe(1);
  });

  it('skips DRAFT dispatches', () => {
    const r = buildEquipmentUtilizationSummary({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'd', status: 'DRAFT', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
      fromDate: '2026-04-13',
      toDate: '2026-04-19',
    });
    expect(r.rollup.totalDispatchDays).toBe(0);
  });

  it('returns four tier rows in fixed order', () => {
    const r = buildEquipmentUtilizationSummary({
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [],
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });
    expect(r.rows.map((x) => x.tier)).toEqual(['HEAVY', 'NORMAL', 'LIGHT', 'IDLE']);
  });

  it('handles empty equipment', () => {
    const r = buildEquipmentUtilizationSummary({
      equipment: [],
      dispatches: [],
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });
    expect(r.rollup.unitsConsidered).toBe(0);
  });
});
