import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildPortfolioMileageSnapshot } from './portfolio-mileage-snapshot';

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

describe('buildPortfolioMileageSnapshot', () => {
  it('counts total + ytd', () => {
    const r = buildPortfolioMileageSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15', businessMiles: 100 }),
        mi({ id: 'b', tripDate: '2026-04-15', businessMiles: 50 }),
      ],
    });
    expect(r.totalTrips).toBe(2);
    expect(r.ytdTrips).toBe(1);
    expect(r.totalMiles).toBe(150);
    expect(r.ytdMiles).toBe(50);
  });

  it('reimburses personal vehicles only', () => {
    const r = buildPortfolioMileageSnapshot({
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', businessMiles: 50, isPersonalVehicle: false, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.reimbursableCents).toBe(6_700);
  });

  it('breaks down by purpose', () => {
    const r = buildPortfolioMileageSnapshot({
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'b', purpose: 'SUPPLY_RUN' }),
      ],
    });
    expect(r.byPurpose.JOBSITE_TRAVEL).toBe(1);
    expect(r.byPurpose.SUPPLY_RUN).toBe(1);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioMileageSnapshot({
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores trips after asOf', () => {
    const r = buildPortfolioMileageSnapshot({
      asOf: '2026-04-30',
      mileage: [mi({ id: 'late', tripDate: '2026-05-15' })],
    });
    expect(r.totalTrips).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioMileageSnapshot({ mileage: [] });
    expect(r.totalTrips).toBe(0);
  });
});
