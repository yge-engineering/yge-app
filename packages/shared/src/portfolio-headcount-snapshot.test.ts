import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildPortfolioHeadcountSnapshot } from './portfolio-headcount-snapshot';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '',
    updatedAt: '',
    firstName: 'Pat',
    lastName: 'Doe',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    hiredOn: '2025-01-01',
    certifications: [],
    ...over,
  } as Employee;
}

describe('buildPortfolioHeadcountSnapshot', () => {
  it('counts by status', () => {
    const r = buildPortfolioHeadcountSnapshot({
      asOf: '2026-04-30',
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'ACTIVE' }),
        emp({ id: 'c', status: 'ON_LEAVE' }),
        emp({ id: 'd', status: 'TERMINATED' }),
      ],
    });
    expect(r.totalEmployees).toBe(4);
    expect(r.activeEmployees).toBe(2);
    expect(r.onLeaveEmployees).toBe(1);
    expect(r.terminatedEmployees).toBe(1);
  });

  it('counts foremen / operators / laborers / apprentices', () => {
    const r = buildPortfolioHeadcountSnapshot({
      asOf: '2026-04-30',
      employees: [
        emp({ id: 'a', role: 'FOREMAN' }),
        emp({ id: 'b', role: 'OPERATOR' }),
        emp({ id: 'c', role: 'LABORER' }),
        emp({ id: 'd', role: 'APPRENTICE' }),
      ],
    });
    expect(r.foremanCount).toBe(1);
    expect(r.operatorCount).toBe(1);
    expect(r.laborerCount).toBe(1);
    expect(r.apprenticeCount).toBe(1);
  });

  it('breaks down by role + classification + status', () => {
    const r = buildPortfolioHeadcountSnapshot({
      asOf: '2026-04-30',
      employees: [
        emp({ id: 'a', role: 'FOREMAN', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'b', role: 'LABORER', classification: 'LABORER_GROUP_1' }),
      ],
    });
    expect(r.byRole.FOREMAN).toBe(1);
    expect(r.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(1);
    expect(r.byStatus.ACTIVE).toBe(2);
  });

  it('counts distinct foremen referenced', () => {
    const r = buildPortfolioHeadcountSnapshot({
      asOf: '2026-04-30',
      employees: [
        emp({ id: 'a', foremanId: 'f1' }),
        emp({ id: 'b', foremanId: 'f1' }),
        emp({ id: 'c', foremanId: 'f2' }),
      ],
    });
    expect(r.distinctForemen).toBe(2);
  });

  it('ignores employees hired after asOf', () => {
    const r = buildPortfolioHeadcountSnapshot({
      asOf: '2026-04-30',
      employees: [emp({ id: 'late', hiredOn: '2026-05-15' })],
    });
    expect(r.totalEmployees).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioHeadcountSnapshot({ employees: [] });
    expect(r.totalEmployees).toBe(0);
  });
});
