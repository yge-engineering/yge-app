import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeByRole } from './employee-by-role';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Test',
    lastName: 'Person',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

describe('buildEmployeeByRole', () => {
  it('groups employees by role', () => {
    const r = buildEmployeeByRole({
      employees: [
        emp({ id: 'a', role: 'OPERATOR' }),
        emp({ id: 'b', role: 'OPERATOR' }),
        emp({ id: 'c', role: 'LABORER' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const op = r.rows.find((x) => x.role === 'OPERATOR');
    expect(op?.total).toBe(2);
  });

  it('counts each employment status separately', () => {
    const r = buildEmployeeByRole({
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'ACTIVE' }),
        emp({ id: 'c', status: 'ON_LEAVE' }),
        emp({ id: 'd', status: 'LAID_OFF' }),
        emp({ id: 'e', status: 'TERMINATED' }),
      ],
    });
    expect(r.rows[0]?.active).toBe(2);
    expect(r.rows[0]?.onLeave).toBe(1);
    expect(r.rows[0]?.laidOff).toBe(1);
    expect(r.rows[0]?.terminated).toBe(1);
    expect(r.rows[0]?.total).toBe(5);
  });

  it('sorts roles by hierarchy (OWNER first → OTHER last)', () => {
    const r = buildEmployeeByRole({
      employees: [
        emp({ id: 'a', role: 'LABORER' }),
        emp({ id: 'b', role: 'OWNER' }),
        emp({ id: 'c', role: 'PROJECT_MANAGER' }),
        emp({ id: 'd', role: 'OTHER' }),
      ],
    });
    expect(r.rows.map((x) => x.role)).toEqual(['OWNER', 'PROJECT_MANAGER', 'LABORER', 'OTHER']);
  });

  it('rolls up totalEmployees and totalActive', () => {
    const r = buildEmployeeByRole({
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'ACTIVE' }),
        emp({ id: 'c', status: 'TERMINATED' }),
      ],
    });
    expect(r.rollup.totalEmployees).toBe(3);
    expect(r.rollup.totalActive).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildEmployeeByRole({ employees: [] });
    expect(r.rows).toHaveLength(0);
  });
});
