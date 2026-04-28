import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildMileageByPurpose } from './mileage-by-purpose';

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeId: 'e1',
    employeeName: 'Joe',
    tripDate: '2026-04-15',
    vehicleDescription: 'Personal Truck',
    isPersonalVehicle: true,
    businessMiles: 50,
    purpose: 'JOBSITE_TRAVEL',
    irsRateCentsPerMile: 67,
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('buildMileageByPurpose', () => {
  it('groups by MileagePurpose', () => {
    const r = buildMileageByPurpose({
      mileageEntries: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'b', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'c', purpose: 'AGENCY_MEETING' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const jobsite = r.rows.find((x) => x.purpose === 'JOBSITE_TRAVEL');
    expect(jobsite?.count).toBe(2);
  });

  it('sums miles per purpose', () => {
    const r = buildMileageByPurpose({
      mileageEntries: [
        mi({ id: 'a', businessMiles: 25 }),
        mi({ id: 'b', businessMiles: 75 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(100);
  });

  it('computes reimbursement only for personal vehicles', () => {
    const r = buildMileageByPurpose({
      mileageEntries: [
        mi({ id: 'pers', isPersonalVehicle: true, businessMiles: 100, irsRateCentsPerMile: 67 }),
        mi({ id: 'co', isPersonalVehicle: false, businessMiles: 100, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rows[0]?.reimbursementCents).toBe(67_00);
  });

  it('counts distinct employees and jobs per purpose', () => {
    const r = buildMileageByPurpose({
      mileageEntries: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'e2', jobId: 'j1' }),
        mi({ id: 'c', employeeId: 'e1', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('computes share of portfolio miles', () => {
    const r = buildMileageByPurpose({
      mileageEntries: [
        mi({ id: 'big', purpose: 'JOBSITE_TRAVEL', businessMiles: 60 }),
        mi({ id: 'small', purpose: 'OFFICE_ERRAND', businessMiles: 40 }),
      ],
    });
    const big = r.rows.find((x) => x.purpose === 'JOBSITE_TRAVEL');
    expect(big?.share).toBeCloseTo(0.6, 3);
  });

  it('respects fromDate / toDate window on tripDate', () => {
    const r = buildMileageByPurpose({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      mileageEntries: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCount).toBe(1);
  });

  it('sorts by totalMiles desc', () => {
    const r = buildMileageByPurpose({
      mileageEntries: [
        mi({ id: 'small', purpose: 'OFFICE_ERRAND', businessMiles: 5 }),
        mi({ id: 'big', purpose: 'JOBSITE_TRAVEL', businessMiles: 100 }),
      ],
    });
    expect(r.rows[0]?.purpose).toBe('JOBSITE_TRAVEL');
  });

  it('handles empty input', () => {
    const r = buildMileageByPurpose({ mileageEntries: [] });
    expect(r.rows).toHaveLength(0);
  });
});
