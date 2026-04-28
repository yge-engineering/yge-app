import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { MileageEntry } from './mileage';

import { buildEmployeeMileageMonthly } from './employee-mileage-monthly';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Alice',
    lastName: 'Anderson',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function mile(over: Partial<MileageEntry>): MileageEntry {
  return {
    id: 'mi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'e1',
    employeeName: 'Alice Anderson',
    tripDate: '2026-04-15',
    vehicleDescription: 'Personal F-150',
    isPersonalVehicle: true,
    businessMiles: 50,
    purpose: 'JOBSITE_TRAVEL',
    ...over,
  } as MileageEntry;
}

describe('buildEmployeeMileageMonthly', () => {
  it('buckets entries by yyyy-mm of tripDate', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [emp({ id: 'e1' })],
      entries: [
        mile({ id: 'a', tripDate: '2026-03-15', businessMiles: 30 }),
        mile({ id: 'b', tripDate: '2026-04-10', businessMiles: 50 }),
      ],
    });
    const buckets = r.rows[0]?.buckets ?? [];
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.month).toBe('2026-03');
    expect(buckets[0]?.miles).toBe(30);
    expect(buckets[1]?.month).toBe('2026-04');
  });

  it('sums miles + counts trips per bucket', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [emp({ id: 'e1' })],
      entries: [
        mile({ id: 'a', tripDate: '2026-04-10', businessMiles: 30 }),
        mile({ id: 'b', tripDate: '2026-04-15', businessMiles: 50 }),
      ],
    });
    const bucket = r.rows[0]?.buckets[0];
    expect(bucket?.miles).toBe(80);
    expect(bucket?.tripCount).toBe(2);
  });

  it('computes reimbursementCents from miles × irsRate', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [emp({ id: 'e1' })],
      entries: [
        mile({
          id: 'a',
          businessMiles: 100,
          irsRateCentsPerMile: 67,
        }),
      ],
    });
    expect(r.rows[0]?.buckets[0]?.reimbursementCents).toBe(6700);
  });

  it('skips entries when irsRate missing (zero contribution)', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [emp({ id: 'e1' })],
      entries: [mile({ id: 'a', irsRateCentsPerMile: undefined })],
    });
    expect(r.rows[0]?.buckets[0]?.reimbursementCents).toBe(0);
  });

  it('respects month bounds', () => {
    const r = buildEmployeeMileageMonthly({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      employees: [emp({ id: 'e1' })],
      entries: [
        mile({ id: 'jan', tripDate: '2026-01-15' }),
        mile({ id: 'mar', tripDate: '2026-03-15' }),
        mile({ id: 'apr', tripDate: '2026-04-15' }),
        mile({ id: 'may', tripDate: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.buckets).toHaveLength(2);
  });

  it('excludes inactive employees by default', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      entries: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('includes inactive when includeInactive=true', () => {
    const r = buildEmployeeMileageMonthly({
      includeInactive: true,
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      entries: [],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes latestMonthDelta', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [emp({ id: 'e1' })],
      entries: [
        mile({ id: 'a', tripDate: '2026-03-15', businessMiles: 100 }),
        mile({ id: 'b', tripDate: '2026-04-15', businessMiles: 150 }),
      ],
    });
    expect(r.rows[0]?.latestMonthDelta).toBe(50);
  });

  it('sorts highest-total-miles employees first', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [
        emp({ id: 'e1', firstName: 'Low' }),
        emp({ id: 'e2', firstName: 'High' }),
      ],
      entries: [
        mile({ id: 'l', employeeId: 'e1', businessMiles: 50 }),
        mile({ id: 'h', employeeId: 'e2', businessMiles: 500 }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('e2');
  });

  it('rolls up portfolio totals + months covered', () => {
    const r = buildEmployeeMileageMonthly({
      employees: [emp({ id: 'e1' })],
      entries: [
        mile({ id: 'a', tripDate: '2026-03-15', businessMiles: 50, irsRateCentsPerMile: 67 }),
        mile({ id: 'b', tripDate: '2026-04-15', businessMiles: 100, irsRateCentsPerMile: 67 }),
      ],
    });
    expect(r.rollup.totalMiles).toBe(150);
    expect(r.rollup.totalReimbursementCents).toBe(50 * 67 + 100 * 67);
    expect(r.rollup.monthsInWindow).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildEmployeeMileageMonthly({ employees: [], entries: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalMiles).toBe(0);
  });
});
