import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildPortfolioMileageYoy } from './portfolio-mileage-yoy';

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    tripDate: '2026-04-15',
    vehicleDescription: 'Truck',
    isPersonalVehicle: true,
    businessMiles: 100,
    irsRateCentsPerMile: 67,
    purpose: 'JOBSITE_TRAVEL',
    jobId: 'j1',
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('buildPortfolioMileageYoy', () => {
  it('compares prior vs current year', () => {
    const r = buildPortfolioMileageYoy({
      currentYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15', businessMiles: 50 }),
        mi({ id: 'b', tripDate: '2026-04-15', businessMiles: 100 }),
      ],
    });
    expect(r.priorYear).toBe(2025);
    expect(r.currentYear).toBe(2026);
    expect(r.priorMiles).toBe(50);
    expect(r.currentMiles).toBe(100);
    expect(r.milesDelta).toBe(50);
  });

  it('reimburses only personal vehicles at IRS rate', () => {
    const r = buildPortfolioMileageYoy({
      currentYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2026-04-15', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', tripDate: '2026-04-15', businessMiles: 100, isPersonalVehicle: false }),
      ],
    });
    expect(r.currentReimbursableCents).toBe(6_700);
  });

  it('counts distinct employees per year', () => {
    const r = buildPortfolioMileageYoy({
      currentYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2025-04-15', employeeId: 'e1' }),
        mi({ id: 'b', tripDate: '2025-04-16', employeeId: 'e2' }),
        mi({ id: 'c', tripDate: '2026-04-15', employeeId: 'e1' }),
      ],
    });
    expect(r.priorDistinctEmployees).toBe(2);
    expect(r.currentDistinctEmployees).toBe(1);
  });

  it('ignores trips outside the two-year window', () => {
    const r = buildPortfolioMileageYoy({
      currentYear: 2026,
      mileage: [
        mi({ id: 'a', tripDate: '2024-04-15' }),
        mi({ id: 'b', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.priorTrips).toBe(0);
    expect(r.currentTrips).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioMileageYoy({ currentYear: 2026, mileage: [] });
    expect(r.priorTrips).toBe(0);
    expect(r.currentTrips).toBe(0);
  });
});
