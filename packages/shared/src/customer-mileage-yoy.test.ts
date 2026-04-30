import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { MileageEntry } from './mileage';

import { buildCustomerMileageYoy } from './customer-mileage-yoy';

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

describe('buildCustomerMileageYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerMileageYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15', businessMiles: 30 }),
        mi({ id: 'b', tripDate: '2026-04-15', businessMiles: 50 }),
      ],
    });
    expect(r.priorTrips).toBe(1);
    expect(r.currentTrips).toBe(1);
    expect(r.tripsDelta).toBe(0);
    expect(r.milesDelta).toBe(20);
  });

  it('reimburses personal vehicles only', () => {
    const r = buildCustomerMileageYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      mileage: [
        mi({ id: 'a', tripDate: '2026-04-15', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.currentReimbursableCents).toBe(6_700);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerMileageYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      mileage: [],
    });
    expect(r.priorTrips).toBe(0);
  });
});
