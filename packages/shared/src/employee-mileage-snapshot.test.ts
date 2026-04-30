import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildEmployeeMileageSnapshot } from './employee-mileage-snapshot';

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

describe('buildEmployeeMileageSnapshot', () => {
  it('filters to one employee', () => {
    const r = buildEmployeeMileageSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', employeeId: 'e1' }),
        mi({ id: 'b', employeeId: 'e2' }),
      ],
    });
    expect(r.totalTrips).toBe(1);
  });

  it('reimburses personal vehicles only', () => {
    const r = buildEmployeeMileageSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', businessMiles: 50, isPersonalVehicle: false, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.reimbursableCents).toBe(6_700);
  });

  it('counts ytd', () => {
    const r = buildEmployeeMileageSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      logYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15' }),
        mi({ id: 'b', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.ytdTrips).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeMileageSnapshot({ employeeId: 'X', mileage: [] });
    expect(r.totalTrips).toBe(0);
  });
});
