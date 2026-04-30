import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerEquipmentSnapshot } from './customer-equipment-snapshot';

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

describe('buildCustomerEquipmentSnapshot', () => {
  it('joins via job.ownerAgency', () => {
    const r = buildCustomerEquipmentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Other')],
      dispatches: [
        dp({ id: 'a', jobId: 'j1' }),
        dp({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.distinctJobs).toBe(1);
    expect(r.distinctUnits).toBe(1);
  });

  it('counts dispatch slots', () => {
    const r = buildCustomerEquipmentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans')],
      dispatches: [
        dp({ id: 'a', jobId: 'j1', equipment: [{ equipmentId: 'eq-1', name: 'X' }, { equipmentId: 'eq-2', name: 'Y' }] }),
        dp({ id: 'b', jobId: 'j1', equipment: [{ equipmentId: 'eq-1', name: 'X' }] }),
      ],
    });
    expect(r.totalDispatchSlots).toBe(3);
    expect(r.distinctUnits).toBe(2);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerEquipmentSnapshot({ customerName: 'X', jobs: [], dispatches: [] });
    expect(r.distinctUnits).toBe(0);
  });
});
