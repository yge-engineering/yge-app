import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildEquipmentDispatchDays } from './equipment-dispatch-days';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    name: 'Cat D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 5_000,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  } as Equipment;
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    scheduledFor: '2026-04-01',
    foremanName: 'Lopez',
    scopeOfWork: 'Grade base',
    status: 'POSTED',
    crew: [],
    equipment: [],
    ...over,
  } as Dispatch;
}

describe('buildEquipmentDispatchDays', () => {
  it('counts distinct dispatch days per equipment unit', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-01', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
        disp({ id: 'd-2', scheduledFor: '2026-04-02', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
        disp({ id: 'd-3', scheduledFor: '2026-04-02', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }), // dup day
      ],
    });
    const row = r.rows.find((x) => x.equipmentId === 'eq-1');
    expect(row?.daysDispatched).toBe(2);
    expect(row?.doubleBookedDays).toBe(1);
  });

  it('skips RETIRED + SOLD equipment', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [
        eq({ id: 'eq-r', status: 'RETIRED' }),
        eq({ id: 'eq-s', status: 'SOLD' }),
        eq({ id: 'eq-active' }),
      ],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.equipmentId).toBe('eq-active');
  });

  it('classifies HIGH (≥60% utilization)', () => {
    // 7 dispatches across 7-day window = 100%
    const dispatches: Dispatch[] = [];
    for (let d = 1; d <= 7; d++) {
      const day = String(d).padStart(2, '0');
      dispatches.push(disp({
        id: `d-${d}`,
        scheduledFor: `2026-04-${day}`,
        equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }],
      }));
    }
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-07',
      equipment: [eq({ id: 'eq-1' })],
      dispatches,
    });
    expect(r.rows[0]?.flag).toBe('HIGH');
    expect(r.rows[0]?.utilizationPct).toBe(1);
  });

  it('classifies NORMAL (30-60%)', () => {
    // 4 days in 10-day window = 40%
    const dispatches: Dispatch[] = [];
    for (let d = 1; d <= 4; d++) {
      const day = String(d).padStart(2, '0');
      dispatches.push(disp({
        id: `d-${d}`,
        scheduledFor: `2026-04-${day}`,
        equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }],
      }));
    }
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-1' })],
      dispatches,
    });
    expect(r.rows[0]?.flag).toBe('NORMAL');
  });

  it('classifies LOW (10-30%)', () => {
    // 2 days in 10-day window = 20%
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-02', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
        disp({ id: 'd-2', scheduledFor: '2026-04-05', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('LOW');
  });

  it('classifies IDLE (<10%) including never-dispatched units', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [],
    });
    expect(r.rows[0]?.flag).toBe('IDLE');
    expect(r.rows[0]?.daysDispatched).toBe(0);
  });

  it('only counts POSTED + COMPLETED by default', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'd-1', status: 'DRAFT', scheduledFor: '2026-04-01', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
        disp({ id: 'd-2', status: 'CANCELLED', scheduledFor: '2026-04-02', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(0);
  });

  it('includes DRAFT dispatches when includeDraftDispatches=true', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      includeDraftDispatches: true,
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'd-1', status: 'DRAFT', scheduledFor: '2026-04-01', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
      ],
    });
    expect(r.rows[0]?.daysDispatched).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-1' })],
      dispatches: [
        disp({ id: 'd-1', jobId: 'job-A', scheduledFor: '2026-04-01', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
        disp({ id: 'd-2', jobId: 'job-B', scheduledFor: '2026-04-02', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
        disp({ id: 'd-3', jobId: 'job-A', scheduledFor: '2026-04-03', equipment: [{ equipmentId: 'eq-1', name: 'Cat D6T' }] }),
      ],
    });
    expect(r.rows[0]?.jobsServed).toBe(2);
  });

  it('handles unlinked equipment by name fallback', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [],
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-01', equipment: [{ name: 'Rented Mini-Ex' }] }),
        disp({ id: 'd-2', scheduledFor: '2026-04-02', equipment: [{ name: 'Rented Mini-Ex' }] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.equipmentId).toBe(null);
    expect(r.rows[0]?.daysDispatched).toBe(2);
  });

  it('sorts highest utilization first', () => {
    const r = buildEquipmentDispatchDays({
      fromDate: '2026-04-01',
      toDate: '2026-04-10',
      equipment: [eq({ id: 'eq-busy' }), eq({ id: 'eq-idle' })],
      dispatches: [
        disp({ id: 'd-1', scheduledFor: '2026-04-01', equipment: [{ equipmentId: 'eq-busy', name: 'Busy' }] }),
        disp({ id: 'd-2', scheduledFor: '2026-04-02', equipment: [{ equipmentId: 'eq-busy', name: 'Busy' }] }),
        disp({ id: 'd-3', scheduledFor: '2026-04-03', equipment: [{ equipmentId: 'eq-busy', name: 'Busy' }] }),
      ],
    });
    expect(r.rows[0]?.equipmentId).toBe('eq-busy');
    expect(r.rows[1]?.equipmentId).toBe('eq-idle');
  });
});
