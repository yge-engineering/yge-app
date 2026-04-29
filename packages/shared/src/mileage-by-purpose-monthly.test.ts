import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildMileageByPurposeMonthly } from './mileage-by-purpose-monthly';

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
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

describe('buildMileageByPurposeMonthly', () => {
  it('groups by (purpose, month)', () => {
    const r = buildMileageByPurposeMonthly({
      mileage: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL', tripDate: '2026-04-15' }),
        mi({ id: 'b', purpose: 'SUPPLY_RUN', tripDate: '2026-04-15' }),
        mi({ id: 'c', purpose: 'JOBSITE_TRAVEL', tripDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums miles and counts trips', () => {
    const r = buildMileageByPurposeMonthly({
      mileage: [
        mi({ id: 'a', businessMiles: 30 }),
        mi({ id: 'b', businessMiles: 70 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(100);
    expect(r.rows[0]?.trips).toBe(2);
  });

  it('reimburses only personal vehicles', () => {
    const r = buildMileageByPurposeMonthly({
      mileage: [
        mi({
          id: 'a',
          businessMiles: 100,
          isPersonalVehicle: true,
          irsRateCentsPerMile: 67,
        }),
        mi({
          id: 'b',
          businessMiles: 100,
          isPersonalVehicle: false,
          irsRateCentsPerMile: 67,
        }),
      ],
    });
    expect(r.rows[0]?.reimbursableCents).toBe(6_700);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildMileageByPurposeMonthly({
      mileage: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
        mi({ id: 'c', employeeId: 'e1', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildMileageByPurposeMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      mileage: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTrips).toBe(1);
  });

  it('sorts by month asc, totalMiles desc within month', () => {
    const r = buildMileageByPurposeMonthly({
      mileage: [
        mi({ id: 'a', purpose: 'BID_WALK', businessMiles: 5, tripDate: '2026-04-15' }),
        mi({ id: 'b', purpose: 'JOBSITE_TRAVEL', businessMiles: 100, tripDate: '2026-04-15' }),
        mi({ id: 'c', purpose: 'JOBSITE_TRAVEL', businessMiles: 50, tripDate: '2026-05-01' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[0]?.purpose).toBe('JOBSITE_TRAVEL');
    expect(r.rows[2]?.month).toBe('2026-05');
  });

  it('handles empty input', () => {
    const r = buildMileageByPurposeMonthly({ mileage: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalTrips).toBe(0);
  });
});
