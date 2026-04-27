import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildEmployeeMileageRollup } from './employee-mileage-rollup';

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'emp-1',
    employeeName: 'Jane Doe',
    tripDate: '2026-04-15',
    vehicleDescription: '2018 F-150 (personal)',
    isPersonalVehicle: true,
    businessMiles: 30,
    purpose: 'JOBSITE_TRAVEL',
    irsRateCentsPerMile: 67,
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('buildEmployeeMileageRollup', () => {
  it('respects window bounds', () => {
    const r = buildEmployeeMileageRollup({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      mileageEntries: [
        mi({ id: 'old', tripDate: '2026-03-15' }),
        mi({ id: 'in', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.tripCount).toBe(1);
  });

  it('rolls up miles + reimbursable for personal vehicle trips', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'm-1', businessMiles: 30, irsRateCentsPerMile: 67 }),
        mi({ id: 'm-2', businessMiles: 20, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(50);
    expect(r.rows[0]?.reimbursableCents).toBe(50 * 67);
  });

  it('does not reimburse company-vehicle trips', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ isPersonalVehicle: false, businessMiles: 100 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(100);
    expect(r.rows[0]?.reimbursableCents).toBe(0);
  });

  it('does not reimburse when irsRateCentsPerMile missing', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ irsRateCentsPerMile: undefined, businessMiles: 100 }),
      ],
    });
    expect(r.rows[0]?.reimbursableCents).toBe(0);
  });

  it('separates reimbursed vs unreimbursed', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'paid', businessMiles: 30, irsRateCentsPerMile: 67, reimbursed: true }),
        mi({ id: 'unpaid', businessMiles: 20, irsRateCentsPerMile: 67, reimbursed: false }),
      ],
    });
    expect(r.rows[0]?.reimbursedCents).toBe(30 * 67);
    expect(r.rows[0]?.unreimbursedCents).toBe(20 * 67);
  });

  it('counts distinct trip dates', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'a', tripDate: '2026-04-01' }),
        mi({ id: 'b', tripDate: '2026-04-01' }),
        mi({ id: 'c', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.distinctDays).toBe(2);
  });

  it('breaks miles down by purpose', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'a', purpose: 'JOBSITE_TRAVEL', businessMiles: 50 }),
        mi({ id: 'b', purpose: 'SUPPLY_RUN', businessMiles: 10 }),
        mi({ id: 'c', purpose: 'AGENCY_MEETING', businessMiles: 20 }),
      ],
    });
    expect(r.rows[0]?.milesByPurpose.JOBSITE_TRAVEL).toBe(50);
    expect(r.rows[0]?.milesByPurpose.SUPPLY_RUN).toBe(10);
    expect(r.rows[0]?.milesByPurpose.AGENCY_MEETING).toBe(20);
  });

  it('flags employees awaiting reimbursement', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'a', employeeId: 'e-pending' }),
        mi({ id: 'b', employeeId: 'e-paid', reimbursed: true }),
      ],
    });
    expect(r.rollup.employeesAwaitingReimbursement).toBe(1);
  });

  it('rolls up grand totals', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'a', employeeId: 'e1', businessMiles: 30, irsRateCentsPerMile: 67 }),
        mi({ id: 'b', employeeId: 'e2', businessMiles: 20, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rollup.totalMiles).toBe(50);
    expect(r.rollup.totalReimbursableCents).toBe(50 * 67);
  });

  it('sorts by unreimbursed amount desc', () => {
    const r = buildEmployeeMileageRollup({
      mileageEntries: [
        mi({ id: 'small', employeeId: 'e-small', businessMiles: 5, irsRateCentsPerMile: 67 }),
        mi({ id: 'big', employeeId: 'e-big', businessMiles: 500, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('e-big');
    expect(r.rows[1]?.employeeId).toBe('e-small');
  });
});
