import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { ToolboxTalk } from './toolbox-talk';

import { buildEmployeeToolboxRate } from './employee-toolbox-rate';

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

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    heldOn: '2026-04-15',
    topic: 'Trenching safety',
    attendees: [],
    status: 'HELD',
    ...over,
  } as ToolboxTalk;
}

describe('buildEmployeeToolboxRate', () => {
  it('counts attended (signed=true with employeeId)', () => {
    const r = buildEmployeeToolboxRate({
      employees: [emp({ id: 'e1' })],
      talks: [
        tbt({ id: 't1', attendees: [{ employeeId: 'e1', name: 'Alice', signed: true }] }),
        tbt({ id: 't2', heldOn: '2026-04-22', attendees: [{ employeeId: 'e1', name: 'Alice', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.attended).toBe(2);
    expect(r.rows[0]?.opportunities).toBe(2);
    expect(r.rows[0]?.attendanceRate).toBe(1);
  });

  it('does not count unsigned attendees', () => {
    const r = buildEmployeeToolboxRate({
      employees: [emp({ id: 'e1' })],
      talks: [
        tbt({ id: 't1', attendees: [{ employeeId: 'e1', name: 'Alice', signed: false }] }),
      ],
    });
    expect(r.rows[0]?.attended).toBe(0);
  });

  it('skips DRAFT talks', () => {
    const r = buildEmployeeToolboxRate({
      employees: [emp({ id: 'e1' })],
      talks: [
        tbt({ id: 'd', status: 'DRAFT', attendees: [{ employeeId: 'e1', name: 'A', signed: true }] }),
        tbt({ id: 'h', status: 'HELD', attendees: [{ employeeId: 'e1', name: 'A', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.opportunities).toBe(1);
  });

  it('captures last attended date', () => {
    const r = buildEmployeeToolboxRate({
      employees: [emp({ id: 'e1' })],
      talks: [
        tbt({ id: 'old', heldOn: '2026-04-01', attendees: [{ employeeId: 'e1', name: 'A', signed: true }] }),
        tbt({ id: 'new', heldOn: '2026-04-22', attendees: [{ employeeId: 'e1', name: 'A', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.lastAttendedOn).toBe('2026-04-22');
  });

  it('null lastAttendedOn when never attended', () => {
    const r = buildEmployeeToolboxRate({
      employees: [emp({ id: 'e1' })],
      talks: [tbt({ attendees: [] })],
    });
    expect(r.rows[0]?.lastAttendedOn).toBe(null);
  });

  it('respects window bounds', () => {
    const r = buildEmployeeToolboxRate({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      employees: [emp({ id: 'e1' })],
      talks: [
        tbt({ id: 'old', heldOn: '2026-03-15', attendees: [{ employeeId: 'e1', name: 'A', signed: true }] }),
        tbt({ id: 'in', heldOn: '2026-04-15', attendees: [{ employeeId: 'e1', name: 'A', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.attended).toBe(1);
    expect(r.rows[0]?.opportunities).toBe(1);
  });

  it('excludes inactive employees by default', () => {
    const r = buildEmployeeToolboxRate({
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      talks: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts lowest attendance first', () => {
    const r = buildEmployeeToolboxRate({
      employees: [
        emp({ id: 'good', firstName: 'Good' }),
        emp({ id: 'bad', firstName: 'Bad' }),
      ],
      talks: [
        tbt({ attendees: [
          { employeeId: 'good', name: 'G', signed: true },
        ]}),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('bad');
    expect(r.rows[0]?.attendanceRate).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildEmployeeToolboxRate({ employees: [], talks: [] });
    expect(r.rows).toHaveLength(0);
  });
});
