import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeForemanRoster } from './employee-foreman-roster';

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

describe('buildEmployeeForemanRoster', () => {
  it('groups crew by foremanId', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'fore', firstName: 'Lopez', lastName: 'F' }),
        emp({ id: 'a', foremanId: 'fore' }),
        emp({ id: 'b', foremanId: 'fore' }),
      ],
    });
    expect(r.rows[0]?.crewSize).toBe(2);
  });

  it('counts unassigned employees on rollup', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'fore' }),
        emp({ id: 'a', foremanId: 'fore' }),
        emp({ id: 'noforeman', foremanId: undefined }),
      ],
    });
    expect(r.rollup.totalAssigned).toBe(1);
    expect(r.rollup.unassigned).toBe(2);
  });

  it('counts each employment status separately', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'fore' }),
        emp({ id: 'a', foremanId: 'fore', status: 'ACTIVE' }),
        emp({ id: 'b', foremanId: 'fore', status: 'ACTIVE' }),
        emp({ id: 'c', foremanId: 'fore', status: 'ON_LEAVE' }),
        emp({ id: 'd', foremanId: 'fore', status: 'LAID_OFF' }),
        emp({ id: 'e', foremanId: 'fore', status: 'TERMINATED' }),
      ],
    });
    expect(r.rows[0]?.activeCount).toBe(2);
    expect(r.rows[0]?.onLeaveCount).toBe(1);
    expect(r.rows[0]?.laidOffCount).toBe(1);
    expect(r.rows[0]?.terminatedCount).toBe(1);
  });

  it('breaks down crew by classification', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'fore' }),
        emp({ id: 'a', foremanId: 'fore', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'b', foremanId: 'fore', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'c', foremanId: 'fore', classification: 'LABORER_GROUP_1' }),
      ],
    });
    expect(r.rows[0]?.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(1);
    expect(r.rows[0]?.byClassification.LABORER_GROUP_1).toBe(2);
  });

  it('uses foreman displayName then firstName+lastName as the row label', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'fore', firstName: 'Manuel', lastName: 'Lopez', displayName: 'Manny' }),
        emp({ id: 'a', foremanId: 'fore' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('Manny');
  });

  it('falls back to firstName + lastName when no displayName', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'fore', firstName: 'Manuel', lastName: 'Lopez' }),
        emp({ id: 'a', foremanId: 'fore' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('Manuel Lopez');
  });

  it('falls back to the id when foreman record is missing', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'a', foremanId: 'unknown-foreman' }),
      ],
    });
    expect(r.rows[0]?.foremanName).toBe('unknown-foreman');
  });

  it('sorts by crewSize desc', () => {
    const r = buildEmployeeForemanRoster({
      employees: [
        emp({ id: 'small-fore', firstName: 'S', lastName: 'F' }),
        emp({ id: 'big-fore', firstName: 'B', lastName: 'F' }),
        emp({ id: 's1', foremanId: 'small-fore' }),
        emp({ id: 'b1', foremanId: 'big-fore' }),
        emp({ id: 'b2', foremanId: 'big-fore' }),
        emp({ id: 'b3', foremanId: 'big-fore' }),
      ],
    });
    expect(r.rows[0]?.foremanId).toBe('big-fore');
  });

  it('handles empty input', () => {
    const r = buildEmployeeForemanRoster({ employees: [] });
    expect(r.rows).toHaveLength(0);
  });
});
