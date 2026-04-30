import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildJobEquipmentYoy } from './job-equipment-yoy';

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
    equipment: [{ equipmentId: 'eq-1', name: 'D6T' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobEquipmentYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobEquipmentYoy({
      jobId: 'j1',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T' }] }),
        dp({ id: 'b', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T' }, { equipmentId: 'eq-2', name: '320E' }] }),
      ],
    });
    expect(r.priorDistinctUnits).toBe(1);
    expect(r.currentDistinctUnits).toBe(2);
    expect(r.unitsDelta).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobEquipmentYoy({ jobId: 'X', currentYear: 2026, dispatches: [] });
    expect(r.priorDistinctUnits).toBe(0);
  });
});
