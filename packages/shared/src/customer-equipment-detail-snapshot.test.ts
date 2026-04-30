import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerEquipmentDetailSnapshot } from './customer-equipment-detail-snapshot';

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

function ds(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Mike',
    scopeOfWork: 'X',
    crew: [],
    equipment: [{ name: 'CAT 320E', operatorName: 'Pat' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildCustomerEquipmentDetailSnapshot', () => {
  it('returns one row per job sorted by distinct units', () => {
    const r = buildCustomerEquipmentDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      dispatches: [
        ds({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13', equipment: [{ name: 'CAT 320E', operatorName: 'Pat' }, { name: 'Water Truck', operatorName: 'Pat' }] }),
        ds({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-14', equipment: [{ name: 'CAT 320E', operatorName: 'Sam' }] }),
        ds({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15', equipment: [{ name: 'Roller', operatorName: 'Lee' }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.distinctUnits).toBe(2);
    expect(r.rows[0]?.totalSlots).toBe(3);
    expect(r.rows[0]?.distinctOperators).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.distinctUnits).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerEquipmentDetailSnapshot({
      customerName: 'X',
      jobs: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
