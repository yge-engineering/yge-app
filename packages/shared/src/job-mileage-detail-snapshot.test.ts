import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildJobMileageDetailSnapshot } from './job-mileage-detail-snapshot';

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    tripDate: '2026-04-15',
    vehicleDescription: '2018 F-150',
    isPersonalVehicle: true,
    purpose: 'JOBSITE_TRAVEL',
    businessMiles: 30,
    irsRateCentsPerMile: 67,
    jobId: 'j1',
    ...over,
  } as MileageEntry;
}

describe('buildJobMileageDetailSnapshot', () => {
  it('returns one row per employee sorted by trips', () => {
    const r = buildJobMileageDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', employeeId: 'e1', employeeName: 'Pat', jobId: 'j1', purpose: 'JOBSITE_TRAVEL', businessMiles: 30, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', employeeId: 'e1', employeeName: 'Pat', jobId: 'j1', purpose: 'SUPPLY_RUN', businessMiles: 12, irsRateCentsPerMile: 67 }),
        mi({ id: 'c', employeeId: 'e2', employeeName: 'Sam', jobId: 'j1', purpose: 'JOBSITE_TRAVEL', businessMiles: 40, irsRateCentsPerMile: 67 }),
        mi({ id: 'd', employeeId: 'e1', jobId: 'j2', businessMiles: 999 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.employeeId).toBe('e1');
    expect(r.rows[0]?.trips).toBe(2);
    expect(r.rows[0]?.miles).toBe(42);
    expect(r.rows[0]?.distinctPurposes).toBe(2);
    expect(r.rows[1]?.employeeId).toBe('e2');
    expect(r.rows[1]?.miles).toBe(40);
  });

  it('handles unknown job', () => {
    const r = buildJobMileageDetailSnapshot({ jobId: 'X', mileage: [] });
    expect(r.rows.length).toBe(0);
  });
});
