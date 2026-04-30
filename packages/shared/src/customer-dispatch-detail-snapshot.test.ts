import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerDispatchDetailSnapshot } from './customer-dispatch-detail-snapshot';

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
    crew: [{ name: 'Pat' }],
    equipment: [{ name: 'CAT 320E' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildCustomerDispatchDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildCustomerDispatchDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      dispatches: [
        ds({ id: 'a', jobId: 'j1', scheduledFor: '2026-04-13', foremanName: 'Mike', crew: [{ name: 'Pat' }], equipment: [{ name: 'CAT 320E' }] }),
        ds({ id: 'b', jobId: 'j1', scheduledFor: '2026-04-14', foremanName: 'Mike', status: 'COMPLETED', crew: [{ name: 'Pat' }, { name: 'Sam' }], equipment: [{ name: 'CAT 320E' }] }),
        ds({ id: 'c', jobId: 'j2', scheduledFor: '2026-04-15', foremanName: 'Joe', crew: [{ name: 'Lee' }], equipment: [{ name: 'Water Truck' }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.posted).toBe(1);
    expect(r.rows[0]?.completed).toBe(1);
    expect(r.rows[0]?.distinctForemen).toBe(1);
    expect(r.rows[0]?.distinctCrew).toBe(2);
    expect(r.rows[0]?.distinctEquipment).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.distinctCrew).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerDispatchDetailSnapshot({
      customerName: 'X',
      jobs: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
