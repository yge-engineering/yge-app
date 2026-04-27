import { describe, expect, it } from 'vitest';
import { buildEmployeeTenure } from './employee-tenure';
import type { Employee } from './employee';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

describe('buildEmployeeTenure', () => {
  it('classifies tiers correctly', () => {
    const r = buildEmployeeTenure({
      asOf: '2026-04-27',
      employees: [
        emp({ id: 'new', createdAt: '2026-04-01T00:00:00Z' }),    // 26 days → NEW_HIRE
        emp({ id: 'sub1', createdAt: '2025-09-01T00:00:00Z' }),   // ~238 days → UNDER_1_YR
        emp({ id: 'sub3', createdAt: '2024-06-01T00:00:00Z' }),   // ~695 days → UNDER_3_YR
        emp({ id: 'sub5', createdAt: '2022-06-01T00:00:00Z' }),   // ~1426 days → UNDER_5_YR
        emp({ id: 'over5', createdAt: '2018-01-01T00:00:00Z' }),  // ~3038 days → OVER_5_YR
      ],
    });
    const tiers = new Map(r.rows.map((x) => [x.employeeId, x.tier]));
    expect(tiers.get('new')).toBe('NEW_HIRE');
    expect(tiers.get('sub1')).toBe('UNDER_1_YR');
    expect(tiers.get('sub3')).toBe('UNDER_3_YR');
    expect(tiers.get('sub5')).toBe('UNDER_5_YR');
    expect(tiers.get('over5')).toBe('OVER_5_YR');
  });

  it('skips non-ACTIVE employees', () => {
    const r = buildEmployeeTenure({
      asOf: '2026-04-27',
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'TERMINATED' }),
        emp({ id: 'c', status: 'LAID_OFF' }),
        emp({ id: 'd', status: 'ON_LEAVE' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('rollup tally', () => {
    const r = buildEmployeeTenure({
      asOf: '2026-04-27',
      employees: [
        emp({ id: '1', createdAt: '2026-04-01T00:00:00Z' }), // NEW_HIRE
        emp({ id: '2', createdAt: '2026-04-15T00:00:00Z' }), // NEW_HIRE
        emp({ id: '3', createdAt: '2018-01-01T00:00:00Z' }), // OVER_5_YR
      ],
    });
    expect(r.rollup.total).toBe(3);
    expect(r.rollup.byTier.NEW_HIRE).toBe(2);
    expect(r.rollup.byTier.OVER_5_YR).toBe(1);
    expect(r.rollup.newHires90Day).toBe(2);
  });

  it('newest hires first in sort', () => {
    const r = buildEmployeeTenure({
      asOf: '2026-04-27',
      employees: [
        emp({ id: 'old', createdAt: '2018-01-01T00:00:00Z' }),
        emp({ id: 'newer', createdAt: '2026-04-15T00:00:00Z' }),
        emp({ id: 'newest', createdAt: '2026-04-25T00:00:00Z' }),
      ],
    });
    expect(r.rows.map((x) => x.employeeId)).toEqual(['newest', 'newer', 'old']);
  });

  it('skips employees with bad/missing createdAt', () => {
    const r = buildEmployeeTenure({
      asOf: '2026-04-27',
      employees: [
        emp({ id: 'good', createdAt: '2024-01-01T00:00:00Z' }),
        emp({ id: 'bad', createdAt: '' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });
});
