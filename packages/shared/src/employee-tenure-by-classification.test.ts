import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeTenureByClassification } from './employee-tenure-by-classification';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    firstName: 'Pat',
    lastName: 'Smith',
    role: 'CREW',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    ...over,
  } as Employee;
}

describe('buildEmployeeTenureByClassification', () => {
  it('groups by classification', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      employees: [
        emp({ id: 'a', classification: 'LABORER_GROUP_1', hiredOn: '2024-01-01' }),
        emp({ id: 'b', classification: 'OPERATING_ENGINEER_GROUP_1', hiredOn: '2024-01-01' }),
        emp({ id: 'c', classification: 'LABORER_GROUP_1', hiredOn: '2024-01-01' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('uses hiredOn when present, createdAt fallback otherwise', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      employees: [
        emp({ id: 'a', hiredOn: '2026-01-28' }),
        emp({ id: 'b', hiredOn: undefined, createdAt: '2026-01-28T00:00:00Z' }),
      ],
    });
    expect(r.rows[0]?.minDays).toBe(90);
    expect(r.rows[0]?.maxDays).toBe(90);
  });

  it('counts new-hire <90 days', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      employees: [
        emp({ id: 'a', hiredOn: '2026-04-01' }), // 27 days
        emp({ id: 'b', hiredOn: '2024-01-01' }), // 2+ years
      ],
    });
    expect(r.rows[0]?.newHire90DayCount).toBe(1);
  });

  it('computes mean / median / min / max', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      employees: [
        emp({ id: 'a', hiredOn: '2026-04-23' }), // 5
        emp({ id: 'b', hiredOn: '2026-04-18' }), // 10
        emp({ id: 'c', hiredOn: '2026-04-13' }), // 15
      ],
    });
    expect(r.rows[0]?.minDays).toBe(5);
    expect(r.rows[0]?.maxDays).toBe(15);
    expect(r.rows[0]?.medianDays).toBe(10);
    expect(r.rows[0]?.meanDays).toBe(10);
  });

  it('excludes non-active by default', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'TERMINATED' }),
      ],
    });
    expect(r.rollup.totalActive).toBe(1);
    expect(r.rollup.excludedByStatus).toBe(1);
  });

  it('honors includeStatuses override', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      includeStatuses: ['ACTIVE', 'ON_LEAVE'],
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'ON_LEAVE' }),
        emp({ id: 'c', status: 'TERMINATED' }),
      ],
    });
    expect(r.rollup.totalActive).toBe(2);
  });

  it('sorts by count desc', () => {
    const r = buildEmployeeTenureByClassification({
      asOf: new Date('2026-04-28T00:00:00Z'),
      employees: [
        emp({ id: 'a', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'b', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'c', classification: 'OPERATING_ENGINEER_GROUP_1' }),
      ],
    });
    expect(r.rows[0]?.classification).toBe('OPERATING_ENGINEER_GROUP_1');
  });

  it('handles empty input', () => {
    const r = buildEmployeeTenureByClassification({ employees: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalActive).toBe(0);
  });
});
