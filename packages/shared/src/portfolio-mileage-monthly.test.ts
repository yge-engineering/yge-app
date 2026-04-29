import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildPortfolioMileageMonthly } from './portfolio-mileage-monthly';

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

describe('buildPortfolioMileageMonthly', () => {
  it('breaks down by purpose', () => {
    const r = buildPortfolioMileageMonthly({
      mileage: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'b', purpose: 'SUPPLY_RUN' }),
        mi({ id: 'c', purpose: 'JOBSITE_TRAVEL' }),
      ],
    });
    expect(r.rows[0]?.byPurpose.JOBSITE_TRAVEL).toBe(2);
    expect(r.rows[0]?.byPurpose.SUPPLY_RUN).toBe(1);
  });

  it('reimburses only personal vehicles at IRS rate', () => {
    const r = buildPortfolioMileageMonthly({
      mileage: [
        mi({ id: 'a', businessMiles: 100, isPersonalVehicle: true, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', businessMiles: 50, isPersonalVehicle: false, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(150);
    expect(r.rows[0]?.reimbursableCents).toBe(6_700);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioMileageMonthly({
      mileage: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioMileageMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      mileage: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTrips).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioMileageMonthly({
      mileage: [
        mi({ id: 'a', tripDate: '2026-06-15' }),
        mi({ id: 'b', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioMileageMonthly({ mileage: [] });
    expect(r.rows).toHaveLength(0);
  });
});
