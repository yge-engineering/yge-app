import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentJobYoy } from './equipment-job-yoy';

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

describe('buildEquipmentJobYoy', () => {
  it('compares two years for one unit', () => {
    const r = buildEquipmentJobYoy({
      equipmentId: 'eq-1',
      currentYear: 2026,
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15', jobId: 'j1' }),
        dp({ id: 'b', scheduledFor: '2026-04-15', jobId: 'j1' }),
        dp({ id: 'c', scheduledFor: '2026-04-22', jobId: 'j2' }),
      ],
    });
    expect(r.priorDistinctJobs).toBe(1);
    expect(r.currentDistinctJobs).toBe(2);
    expect(r.dispatchesDelta).toBe(1);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentJobYoy({ equipmentId: 'X', currentYear: 2026, dispatches: [] });
    expect(r.priorDistinctJobs).toBe(0);
  });
});
