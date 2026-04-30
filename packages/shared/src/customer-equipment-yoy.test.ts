import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerEquipmentYoy } from './customer-equipment-yoy';

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

describe('buildCustomerEquipmentYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerEquipmentYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15' }),
        dp({ id: 'b', scheduledFor: '2026-04-15', equipment: [{ equipmentId: 'eq-1', name: 'D6T' }, { equipmentId: 'eq-2', name: '320E' }] }),
      ],
    });
    expect(r.priorDistinctUnits).toBe(1);
    expect(r.currentDistinctUnits).toBe(2);
    expect(r.unitsDelta).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerEquipmentYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      dispatches: [],
    });
    expect(r.priorDistinctUnits).toBe(0);
  });
});
