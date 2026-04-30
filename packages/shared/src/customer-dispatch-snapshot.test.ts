import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerDispatchSnapshot } from './customer-dispatch-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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
    crew: [{ name: 'A' }, { name: 'B' }],
    equipment: [{ name: 'X' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildCustomerDispatchSnapshot', () => {
  it('joins dispatches to a customer via job.ownerAgency', () => {
    const r = buildCustomerDispatchSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      dispatches: [dp({ id: 'a', jobId: 'j1' }), dp({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalDispatches).toBe(1);
  });

  it('sums crew + equipment seats + tracks last date', () => {
    const r = buildCustomerDispatchSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      dispatches: [
        dp({ id: 'a', crew: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], equipment: [{ name: 'X' }, { name: 'Y' }], scheduledFor: '2026-04-08' }),
        dp({ id: 'b', crew: [{ name: 'D' }], equipment: [], scheduledFor: '2026-04-22' }),
      ],
    });
    expect(r.totalCrewSeats).toBe(4);
    expect(r.totalEquipmentSlots).toBe(2);
    expect(r.lastDispatchDate).toBe('2026-04-22');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerDispatchSnapshot({ customerName: 'X', jobs: [], dispatches: [] });
    expect(r.totalDispatches).toBe(0);
  });
});
