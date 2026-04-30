import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildPortfolioEmployeeSnapshot } from './portfolio-employee-snapshot';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '',
    updatedAt: '',
    firstName: 'Pat',
    lastName: 'Smith',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    ...over,
  } as Employee;
}

describe('buildPortfolioEmployeeSnapshot', () => {
  it('counts total + status + role + classification', () => {
    const r = buildPortfolioEmployeeSnapshot({
      employees: [
        emp({ id: 'a', status: 'ACTIVE', role: 'LABORER', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'b', status: 'ON_LEAVE', role: 'OPERATOR', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'c', status: 'ACTIVE', role: 'LABORER', classification: 'LABORER_GROUP_1' }),
      ],
    });
    expect(r.totalEmployees).toBe(3);
    expect(r.byStatus.ACTIVE).toBe(2);
    expect(r.byStatus.ON_LEAVE).toBe(1);
    expect(r.byRole.LABORER).toBe(2);
    expect(r.byRole.OPERATOR).toBe(1);
    expect(r.byClassification.LABORER_GROUP_1).toBe(2);
    expect(r.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(1);
    expect(r.activeCount).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioEmployeeSnapshot({ employees: [] });
    expect(r.totalEmployees).toBe(0);
  });
});
