import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildEmployeeMileageDetailSnapshot } from './employee-mileage-detail-snapshot';

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

describe('buildEmployeeMileageDetailSnapshot', () => {
  it('returns one row per job sorted by trips', () => {
    const r = buildEmployeeMileageDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      mileage: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1', businessMiles: 30, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', employeeId: 'e1', jobId: 'j1', businessMiles: 12, irsRateCentsPerMile: 67 }),
        mi({ id: 'c', employeeId: 'e1', jobId: 'j2', businessMiles: 60, irsRateCentsPerMile: 67 }),
        mi({ id: 'd', employeeId: 'e2', jobId: 'j1', businessMiles: 999 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.trips).toBe(2);
    expect(r.rows[0]?.miles).toBe(42);
    expect(r.rows[0]?.reimbursableCents).toBe(Math.round(42 * 67));
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.miles).toBe(60);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeMileageDetailSnapshot({ employeeId: 'X', mileage: [] });
    expect(r.rows.length).toBe(0);
  });
});
