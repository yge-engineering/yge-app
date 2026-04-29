import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildJobMileageMonthly } from './job-mileage-monthly';

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

describe('buildJobMileageMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildJobMileageMonthly({
      mileage: [
        mi({ id: 'a', jobId: 'j1', tripDate: '2026-04-15' }),
        mi({ id: 'b', jobId: 'j1', tripDate: '2026-05-01' }),
        mi({ id: 'c', jobId: 'j2', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums miles + counts trips per (job, month)', () => {
    const r = buildJobMileageMonthly({
      mileage: [
        mi({ id: 'a', businessMiles: 30 }),
        mi({ id: 'b', businessMiles: 70 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(100);
    expect(r.rows[0]?.trips).toBe(2);
  });

  it('reimburses only personal vehicles at IRS rate', () => {
    const r = buildJobMileageMonthly({
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

  it('breaks down by purpose', () => {
    const r = buildJobMileageMonthly({
      mileage: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'b', purpose: 'SUPPLY_RUN' }),
        mi({ id: 'c', purpose: 'JOBSITE_TRAVEL' }),
      ],
    });
    expect(r.rows[0]?.byPurpose.JOBSITE_TRAVEL).toBe(2);
    expect(r.rows[0]?.byPurpose.SUPPLY_RUN).toBe(1);
  });

  it('counts distinct employees', () => {
    const r = buildJobMileageMonthly({
      mileage: [
        mi({ id: 'a', employeeId: 'e1' }),
        mi({ id: 'b', employeeId: 'e1' }),
        mi({ id: 'c', employeeId: 'e2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('counts unattributed trips (no jobId)', () => {
    const r = buildJobMileageMonthly({
      mileage: [
        mi({ id: 'a', jobId: 'j1' }),
        mi({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildJobMileageMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      mileage: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTrips).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobMileageMonthly({
      mileage: [
        mi({ id: 'a', jobId: 'Z', tripDate: '2026-04-15' }),
        mi({ id: 'b', jobId: 'A', tripDate: '2026-05-01' }),
        mi({ id: 'c', jobId: 'A', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJobMileageMonthly({ mileage: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalTrips).toBe(0);
  });
});
