import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildJobMileageYoy } from './job-mileage-yoy';

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

describe('buildJobMileageYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobMileageYoy({
      jobId: 'j1',
      currentYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15', businessMiles: 30 }),
        mi({ id: 'b', tripDate: '2026-04-15', businessMiles: 50 }),
      ],
    });
    expect(r.priorTrips).toBe(1);
    expect(r.currentTrips).toBe(1);
    expect(r.milesDelta).toBe(20);
  });

  it('handles unknown job', () => {
    const r = buildJobMileageYoy({ jobId: 'X', currentYear: 2026, mileage: [] });
    expect(r.priorTrips).toBe(0);
  });
});
