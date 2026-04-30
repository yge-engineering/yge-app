import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Equipment } from './equipment';

import { buildJobEquipmentSnapshot } from './job-equipment-snapshot';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-1',
    createdAt: '',
    updatedAt: '',
    name: 'Cat D6T',
    category: 'DOZER',
    usageMetric: 'HOURS',
    currentUsage: 1000,
    status: 'IN_YARD',
    ...over,
  } as Equipment;
}

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'X',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobEquipmentSnapshot', () => {
  it('counts currently assigned equipment', () => {
    const r = buildJobEquipmentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      equipment: [
        eq({ id: 'a', status: 'ASSIGNED', assignedJobId: 'j1' }),
        eq({ id: 'b', status: 'ASSIGNED', assignedJobId: 'j2' }),
        eq({ id: 'c', status: 'IN_YARD' }),
      ],
      dispatches: [],
    });
    expect(r.currentlyAssignedCount).toBe(1);
    expect(r.totalUnitsEverOnJob).toBe(1);
  });

  it('rolls up units that appeared on dispatches', () => {
    const r = buildJobEquipmentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      equipment: [
        eq({ id: 'a', category: 'DOZER' }),
        eq({ id: 'b', category: 'EXCAVATOR' }),
      ],
      dispatches: [
        dp({ id: 'd1', equipment: [{ equipmentId: 'a', name: 'Cat D6T' }] }),
        dp({ id: 'd2', equipment: [{ equipmentId: 'b', name: 'Cat 320E' }] }),
      ],
    });
    expect(r.totalUnitsEverOnJob).toBe(2);
    expect(r.byCategory.DOZER).toBe(1);
    expect(r.byCategory.EXCAVATOR).toBe(1);
  });

  it('tracks last dispatched date', () => {
    const r = buildJobEquipmentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      equipment: [],
      dispatches: [
        dp({ id: 'a', scheduledFor: '2026-04-08' }),
        dp({ id: 'b', scheduledFor: '2026-04-22' }),
      ],
    });
    expect(r.lastDispatchedDate).toBe('2026-04-22');
  });

  it('handles empty input', () => {
    const r = buildJobEquipmentSnapshot({ jobId: 'j1', equipment: [], dispatches: [] });
    expect(r.totalUnitsEverOnJob).toBe(0);
    expect(r.lastDispatchedDate).toBeNull();
  });
});
