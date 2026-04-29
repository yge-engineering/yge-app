import { describe, expect, it } from 'vitest';

import type { MileageEntry } from './mileage';

import { buildMileageMonthlyByPurpose } from './employee-mileage-monthly-by-purpose';

function mi(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeId: 'e1',
    employeeName: 'Joe',
    tripDate: '2026-04-15',
    vehicleDescription: 'Personal',
    isPersonalVehicle: true,
    businessMiles: 50,
    purpose: 'JOBSITE_TRAVEL',
    irsRateCentsPerMile: 67,
    reimbursed: false,
    ...over,
  } as MileageEntry;
}

describe('buildMileageMonthlyByPurpose', () => {
  it('groups by (month, purpose)', () => {
    const r = buildMileageMonthlyByPurpose({
      mileageEntries: [
        mi({ id: 'a', tripDate: '2026-03-15', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'b', tripDate: '2026-04-15', purpose: 'JOBSITE_TRAVEL' }),
        mi({ id: 'c', tripDate: '2026-04-15', purpose: 'BID_WALK' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums miles and reimbursement (personal only)', () => {
    const r = buildMileageMonthlyByPurpose({
      mileageEntries: [
        mi({ id: 'pers', isPersonalVehicle: true, businessMiles: 100, irsRateCentsPerMile: 67 }),
        mi({ id: 'co', isPersonalVehicle: false, businessMiles: 100 }),
      ],
    });
    expect(r.rows[0]?.totalMiles).toBe(200);
    expect(r.rows[0]?.reimbursementCents).toBe(67_00);
  });

  it('counts trips and distinct employees', () => {
    const r = buildMileageMonthlyByPurpose({
      mileageEntries: [
        mi({ id: 'a', employeeId: 'e1' }),
        mi({ id: 'b', employeeId: 'e2' }),
        mi({ id: 'c', employeeId: 'e1' }),
      ],
    });
    expect(r.rows[0]?.tripCount).toBe(3);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildMileageMonthlyByPurpose({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      mileageEntries: [
        mi({ id: 'mar', tripDate: '2026-03-15' }),
        mi({ id: 'apr', tripDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.monthsConsidered).toBe(1);
  });

  it('sorts by month asc, purpose asc', () => {
    const r = buildMileageMonthlyByPurpose({
      mileageEntries: [
        mi({ id: 'a', tripDate: '2026-04-15', purpose: 'OFFICE_ERRAND' }),
        mi({ id: 'b', tripDate: '2026-03-15', purpose: 'JOBSITE_TRAVEL' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildMileageMonthlyByPurpose({ mileageEntries: [] });
    expect(r.rows).toHaveLength(0);
  });
});
