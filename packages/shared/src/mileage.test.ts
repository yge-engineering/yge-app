import { describe, expect, it } from 'vitest';
import {
  computeMileageRollup,
  reimbursementCents,
  type MileageEntry,
} from './mileage';

function entry(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    employeeId: 'emp-aaaaaaaa',
    employeeName: 'Jane Doe',
    tripDate: '2026-04-15',
    vehicleDescription: 'Personal Tacoma',
    isPersonalVehicle: true,
    businessMiles: 50,
    purpose: 'JOBSITE_TRAVEL',
    irsRateCentsPerMile: 67,
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('reimbursementCents', () => {
  it('multiplies miles × IRS rate for personal vehicles', () => {
    expect(reimbursementCents(entry({ businessMiles: 50, irsRateCentsPerMile: 67 }))).toBe(3350);
    expect(reimbursementCents(entry({ businessMiles: 100, irsRateCentsPerMile: 67 }))).toBe(6700);
  });

  it('returns 0 for company vehicles even with rate set', () => {
    expect(
      reimbursementCents(
        entry({ isPersonalVehicle: false, businessMiles: 100, irsRateCentsPerMile: 67 }),
      ),
    ).toBe(0);
  });

  it('returns 0 when IRS rate is missing', () => {
    expect(
      reimbursementCents(
        entry({ isPersonalVehicle: true, businessMiles: 100, irsRateCentsPerMile: undefined }),
      ),
    ).toBe(0);
  });

  it('rounds to nearest cent for fractional miles', () => {
    // 17.3 mi × 67¢ = 1159.1¢ → 1159¢
    expect(
      reimbursementCents(entry({ businessMiles: 17.3, irsRateCentsPerMile: 67 })),
    ).toBe(1159);
  });
});

describe('computeMileageRollup', () => {
  it('separates personal vs company miles + sums reimbursable', () => {
    const r = computeMileageRollup([
      entry({ id: 'mi-1', isPersonalVehicle: true, businessMiles: 50, irsRateCentsPerMile: 67 }),
      entry({ id: 'mi-2', isPersonalVehicle: false, businessMiles: 200 }),
      entry({
        id: 'mi-3',
        isPersonalVehicle: true,
        businessMiles: 25,
        irsRateCentsPerMile: 67,
        reimbursed: true,
      }),
    ]);
    expect(r.total).toBe(3);
    expect(r.totalBusinessMiles).toBe(275);
    expect(r.personalMiles).toBe(75);
    // Reimbursable = (50 + 25) × 67 = 5025
    expect(r.reimbursableCents).toBe(5025);
    // Reimbursed = 25 × 67 = 1675
    expect(r.reimbursedCents).toBe(1675);
    expect(r.outstandingCents).toBe(3350);
  });
});
