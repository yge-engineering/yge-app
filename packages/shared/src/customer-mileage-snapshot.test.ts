import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { MileageEntry } from './mileage';

import { buildCustomerMileageSnapshot } from './customer-mileage-snapshot';

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

describe('buildCustomerMileageSnapshot', () => {
  it('joins trips to a customer via job.ownerAgency', () => {
    const r = buildCustomerMileageSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      mileage: [mi({ id: 'a', jobId: 'j1' }), mi({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalTrips).toBe(1);
  });

  it('reimburses personal vehicles only', () => {
    const r = buildCustomerMileageSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      mileage: [
        mi({ id: 'a', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', businessMiles: 50, isPersonalVehicle: false }),
      ],
    });
    expect(r.reimbursableCents).toBe(6_700);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerMileageSnapshot({ customerName: 'X', jobs: [], mileage: [] });
    expect(r.totalTrips).toBe(0);
  });
});
