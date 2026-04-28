import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeStatusMix } from './employee-status-mix';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Joe',
    lastName: 'Operator',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

describe('buildEmployeeStatusMix', () => {
  it('counts employees by status', () => {
    const r = buildEmployeeStatusMix({
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'ACTIVE' }),
        emp({ id: 'c', status: 'ON_LEAVE' }),
        emp({ id: 'd', status: 'LAID_OFF' }),
        emp({ id: 'e', status: 'TERMINATED' }),
      ],
    });
    expect(r.rollup.activeCount).toBe(2);
    expect(r.rollup.onLeaveCount).toBe(1);
    expect(r.rollup.laidOffCount).toBe(1);
    expect(r.rollup.terminatedCount).toBe(1);
    expect(r.rollup.totalEmployees).toBe(5);
  });

  it('breaks down each status by classification', () => {
    const r = buildEmployeeStatusMix({
      employees: [
        emp({ id: 'op1', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'op2', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'lab', classification: 'LABORER_GROUP_1' }),
      ],
    });
    const active = r.rows.find((x) => x.status === 'ACTIVE');
    expect(active?.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(2);
    expect(active?.byClassification.LABORER_GROUP_1).toBe(1);
  });

  it('returns all four status rows even when zero employees in a status', () => {
    const r = buildEmployeeStatusMix({
      employees: [emp({ status: 'ACTIVE' })],
    });
    expect(r.rows).toHaveLength(4);
    expect(r.rows.find((x) => x.status === 'TERMINATED')?.total).toBe(0);
  });

  it('sorts rows ACTIVE → ON_LEAVE → LAID_OFF → TERMINATED', () => {
    const r = buildEmployeeStatusMix({
      employees: [
        emp({ id: 'a', status: 'TERMINATED' }),
        emp({ id: 'b', status: 'ACTIVE' }),
      ],
    });
    expect(r.rows[0]?.status).toBe('ACTIVE');
    expect(r.rows[1]?.status).toBe('ON_LEAVE');
    expect(r.rows[2]?.status).toBe('LAID_OFF');
    expect(r.rows[3]?.status).toBe('TERMINATED');
  });

  it('handles empty input', () => {
    const r = buildEmployeeStatusMix({ employees: [] });
    expect(r.rollup.totalEmployees).toBe(0);
    expect(r.rows.every((x) => x.total === 0)).toBe(true);
  });
});
