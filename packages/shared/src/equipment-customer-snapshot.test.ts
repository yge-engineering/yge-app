import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildEquipmentCustomerSnapshot } from './equipment-customer-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
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
    equipment: [{ equipmentId: 'eq-1', name: 'D6T' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEquipmentCustomerSnapshot', () => {
  it('counts customers via job-owner', () => {
    const r = buildEquipmentCustomerSnapshot({
      equipmentId: 'eq-1',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'CAL FIRE'), jb('j3', 'Caltrans')],
      dispatches: [
        dp({ id: 'a', jobId: 'j1' }),
        dp({ id: 'b', jobId: 'j2' }),
        dp({ id: 'c', jobId: 'j3' }),
      ],
    });
    expect(r.distinctCustomers).toBe(2);
    expect(r.distinctJobs).toBe(3);
    expect(r.totalDispatches).toBe(3);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentCustomerSnapshot({ equipmentId: 'X', jobs: [], dispatches: [] });
    expect(r.distinctCustomers).toBe(0);
  });
});
