import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildJobMileageSnapshot } from './job-mileage-snapshot';

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

describe('buildJobMileageSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobMileageSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', jobId: 'j1' }),
        mi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalTrips).toBe(1);
  });

  it('reimburses personal vehicles only', () => {
    const r = buildJobMileageSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', businessMiles: 50, isPersonalVehicle: false, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.reimbursableCents).toBe(6_700);
  });

  it('counts ytd', () => {
    const r = buildJobMileageSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      logYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15' }),
        mi({ id: 'b', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.ytdTrips).toBe(1);
  });

  it('breaks down by purpose + last trip date', () => {
    const r = buildJobMileageSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL', tripDate: '2026-04-08' }),
        mi({ id: 'b', purpose: 'SUPPLY_RUN', tripDate: '2026-04-22' }),
      ],
    });
    expect(r.byPurpose.JOBSITE_TRAVEL).toBe(1);
    expect(r.byPurpose.SUPPLY_RUN).toBe(1);
    expect(r.lastTripDate).toBe('2026-04-22');
  });

  it('handles no matching trips', () => {
    const r = buildJobMileageSnapshot({ jobId: 'j1', mileage: [] });
    expect(r.totalTrips).toBe(0);
    expect(r.lastTripDate).toBeNull();
  });
});
