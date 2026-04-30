import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { MileageEntry } from './mileage';

import { buildCustomerMileageDetailSnapshot } from './customer-mileage-detail-snapshot';

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

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    tripDate: '2026-04-15',
    vehicleDescription: 'Truck',
    isPersonalVehicle: false,
    businessMiles: 50,
    purpose: 'JOBSITE_TRAVEL',
    jobId: 'j1',
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('buildCustomerMileageDetailSnapshot', () => {
  it('returns one row per job sorted by trips desc', () => {
    const r = buildCustomerMileageDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      mileage: [
        mi({ id: 'a', jobId: 'j1' }),
        mi({ id: 'b', jobId: 'j1', tripDate: '2026-04-22' }),
        mi({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.trips).toBe(2);
    expect(r.rows[0]?.miles).toBe(100);
    expect(r.rows[0]?.lastTripDate).toBe('2026-04-22');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerMileageDetailSnapshot({
      customerName: 'X',
      jobs: [],
      mileage: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
