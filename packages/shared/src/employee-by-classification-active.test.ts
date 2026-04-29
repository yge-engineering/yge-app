import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeByClassificationActive } from './employee-by-classification-active';

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

describe('buildEmployeeByClassificationActive', () => {
  it('only counts ACTIVE employees', () => {
    const r = buildEmployeeByClassificationActive({
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'TERMINATED' }),
      ],
    });
    expect(r.rollup.totalActive).toBe(1);
  });

  it('groups by classification', () => {
    const r = buildEmployeeByClassificationActive({
      employees: [
        emp({ id: 'a', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'b', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'c', classification: 'LABORER_GROUP_1' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const op = r.rows.find((x) => x.classification === 'OPERATING_ENGINEER_GROUP_1');
    expect(op?.count).toBe(2);
  });

  it('breaks down by role per classification', () => {
    const r = buildEmployeeByClassificationActive({
      employees: [
        emp({ id: 'a', classification: 'OPERATING_ENGINEER_GROUP_1', role: 'OPERATOR' }),
        emp({ id: 'b', classification: 'OPERATING_ENGINEER_GROUP_1', role: 'OPERATOR' }),
        emp({ id: 'c', classification: 'OPERATING_ENGINEER_GROUP_1', role: 'FOREMAN' }),
      ],
    });
    expect(r.rows[0]?.byRole.OPERATOR).toBe(2);
    expect(r.rows[0]?.byRole.FOREMAN).toBe(1);
  });

  it('sorts by count desc', () => {
    const r = buildEmployeeByClassificationActive({
      employees: [
        emp({ id: 'a', classification: 'CARPENTER' }),
        emp({ id: 'b', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'c', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'd', classification: 'LABORER_GROUP_1' }),
      ],
    });
    expect(r.rows[0]?.classification).toBe('LABORER_GROUP_1');
  });

  it('handles empty input', () => {
    const r = buildEmployeeByClassificationActive({ employees: [] });
    expect(r.rows).toHaveLength(0);
  });
});
