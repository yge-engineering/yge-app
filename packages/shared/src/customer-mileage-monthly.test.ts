import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { MileageEntry } from './mileage';

import { buildCustomerMileageMonthly } from './customer-mileage-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

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

describe('buildCustomerMileageMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerMileageMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      mileage: [
        mi({ id: 'a', jobId: 'j1', tripDate: '2026-04-15' }),
        mi({ id: 'b', jobId: 'j2', tripDate: '2026-04-15' }),
        mi({ id: 'c', jobId: 'j1', tripDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums miles and reimbursable cents', () => {
    const r = buildCustomerMileageMonthly({
      jobs: [job({ id: 'j1' })],
      mileage: [
        mi({
          id: 'a',
          businessMiles: 100,
          isPersonalVehicle: true,
          irsRateCentsPerMile: 67,
        }),
        mi({
          id: 'b',
          businessMiles: 50,
          isPersonalVehicle: false,
          irsRateCentsPerMile: 67,
        }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(150);
    expect(r.rows[0]?.reimbursableCents).toBe(6_700);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildCustomerMileageMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      mileage: [
        mi({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        mi({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
        mi({ id: 'c', employeeId: 'e1', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed (no jobId or no matching job)', () => {
    const r = buildCustomerMileageMonthly({
      jobs: [job({ id: 'j1' })],
      mileage: [
        mi({ id: 'a', jobId: 'j1' }),
        mi({ id: 'b', jobId: undefined }),
        mi({ id: 'c', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerMileageMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      mileage: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalTrips).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerMileageMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      mileage: [
        mi({ id: 'a', jobId: 'jZ', tripDate: '2026-04-15' }),
        mi({ id: 'b', jobId: 'jA', tripDate: '2026-05-01' }),
        mi({ id: 'c', jobId: 'jA', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerMileageMonthly({ jobs: [], mileage: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalTrips).toBe(0);
  });
});
