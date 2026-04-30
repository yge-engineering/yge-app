import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';

import { buildEquipmentJobSnapshot } from './equipment-job-snapshot';

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

describe('buildEquipmentJobSnapshot', () => {
  it('counts distinct jobs', () => {
    const r = buildEquipmentJobSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      dispatches: [
        dp({ id: 'a', jobId: 'j1' }),
        dp({ id: 'b', jobId: 'j2' }),
        dp({ id: 'c', jobId: 'j1', scheduledFor: '2026-04-22' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.totalDispatches).toBe(3);
    expect(r.lastDispatchDate).toBe('2026-04-22');
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentJobSnapshot({ equipmentId: 'X', dispatches: [] });
    expect(r.distinctJobs).toBe(0);
  });
});
