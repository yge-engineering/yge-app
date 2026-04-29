import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildEmployeeMileageByJob } from './employee-mileage-by-job';

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
    jobId: 'j1',
    irsRateCentsPerMile: 67,
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('buildEmployeeMileageByJob', () => {
  it('groups by (employee, job)', () => {
    const r = buildEmployeeMileageByJob({
      mileageEntries: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'e1', jobId: 'j2' }),
        mi({ id: 'c', employeeId: 'e2', jobId: 'j1' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums miles and reimbursement (personal only)', () => {
    const r = buildEmployeeMileageByJob({
      mileageEntries: [
        mi({ id: 'pers', isPersonalVehicle: true, businessMiles: 100, irsRateCentsPerMile: 67 }),
        mi({ id: 'co', isPersonalVehicle: false, businessMiles: 100, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(200);
    expect(r.rows[0]?.reimbursementCents).toBe(67_00);
  });

  it('counts trips and tracks first/last trip date', () => {
    const r = buildEmployeeMileageByJob({
      mileageEntries: [
        mi({ id: 'a', tripDate: '2026-04-10' }),
        mi({ id: 'b', tripDate: '2026-04-20' }),
        mi({ id: 'c', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.tripCount).toBe(3);
    expect(r.rows[0]?.firstTripOn).toBe('2026-04-10');
    expect(r.rows[0]?.lastTripOn).toBe('2026-04-20');
  });

  it('counts unattributed (no jobId)', () => {
    const r = buildEmployeeMileageByJob({
      mileageEntries: [
        mi({ id: 'a', jobId: 'j1' }),
        mi({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildEmployeeMileageByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      mileageEntries: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.employeesConsidered).toBe(1);
  });

  it('sorts by employeeId asc, jobId asc', () => {
    const r = buildEmployeeMileageByJob({
      mileageEntries: [
        mi({ id: 'a', employeeId: 'Z', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'A', jobId: 'j2' }),
        mi({ id: 'c', employeeId: 'A', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('A');
    expect(r.rows[0]?.jobId).toBe('j1');
  });

  it('handles empty input', () => {
    const r = buildEmployeeMileageByJob({ mileageEntries: [] });
    expect(r.rows).toHaveLength(0);
  });
});
