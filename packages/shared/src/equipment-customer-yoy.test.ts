import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildEquipmentCustomerYoy } from './equipment-customer-yoy';

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

describe('buildEquipmentCustomerYoy', () => {
  it('compares two years for one equipment unit', () => {
    const r = buildEquipmentCustomerYoy({
      equipmentId: 'eq-1',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'CAL FIRE')],
      dispatches: [
        dp({ id: 'a', jobId: 'j1', scheduledFor: '2025-04-15' }),
        dp({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-15' }),
        dp({ id: 'c', jobId: 'j2', scheduledFor: '2026-08-15' }),
      ],
    });
    expect(r.priorDistinctCustomers).toBe(1);
    expect(r.currentDistinctCustomers).toBe(2);
    expect(r.customersDelta).toBe(1);
  });

  it('handles unknown equipment', () => {
    const r = buildEquipmentCustomerYoy({
      equipmentId: 'X',
      currentYear: 2026,
      jobs: [],
      dispatches: [],
    });
    expect(r.priorDistinctCustomers).toBe(0);
  });
});
