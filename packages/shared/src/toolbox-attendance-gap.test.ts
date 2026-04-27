import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { ToolboxTalk } from './toolbox-talk';

import { buildToolboxAttendanceGap } from './toolbox-attendance-gap';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    ...over,
  } as Employee;
}

function talk(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    heldOn: '2026-04-15',
    topic: 'Heat illness prevention',
    leaderName: 'Lopez',
    attendees: [],
    status: 'HELD',
    ...over,
  } as ToolboxTalk;
}

describe('buildToolboxAttendanceGap', () => {
  it('flags NEVER when employee never attended a talk in window', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      employees: [emp({})],
      toolboxTalks: [
        talk({ attendees: [{ employeeId: 'other', name: 'X', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NEVER');
    expect(r.rows[0]?.lastAttendedOn).toBe(null);
    expect(r.rows[0]?.attendedCount).toBe(0);
  });

  it('flags CURRENT when last attended within 14 days', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-20', // 7 days ago
          attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('CURRENT');
    expect(r.rows[0]?.daysSinceLastAttended).toBe(7);
  });

  it('flags DUE_SOON for 14-21 days since last', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-09', // 18 days ago
          attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('DUE_SOON');
  });

  it('flags OVERDUE for 22+ days since last', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-01', // 26 days ago
          attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('OVERDUE');
  });

  it('only counts signed attendees', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-20',
          attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: false }],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NEVER');
  });

  it('skips DRAFT toolbox talks', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-20',
          status: 'DRAFT',
          attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NEVER');
    expect(r.rollup.talksInWindow).toBe(0);
  });

  it('respects window bounds', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-15',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-01', // before window
          attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }],
        }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NEVER');
    expect(r.rollup.talksInWindow).toBe(0);
  });

  it('skips non-ACTIVE employees', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [
        emp({ id: 'emp-active', status: 'ACTIVE' }),
        emp({ id: 'emp-term', status: 'TERMINATED' }),
      ],
      toolboxTalks: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.employeeId).toBe('emp-active');
  });

  it('counts multiple attended talks per employee', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [emp({})],
      toolboxTalks: [
        talk({ id: 't-1', heldOn: '2026-04-05', attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }] }),
        talk({ id: 't-2', heldOn: '2026-04-12', attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }] }),
        talk({ id: 't-3', heldOn: '2026-04-20', attendees: [{ employeeId: 'emp-1', name: 'Jane', signed: true }] }),
      ],
    });
    expect(r.rows[0]?.attendedCount).toBe(3);
    expect(r.rows[0]?.lastAttendedOn).toBe('2026-04-20');
  });

  it('rolls up tier counts and talksInWindow', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [
        emp({ id: 'emp-cur', firstName: 'Cur', lastName: 'X' }),
        emp({ id: 'emp-never', firstName: 'Never', lastName: 'Y' }),
      ],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-20',
          attendees: [{ employeeId: 'emp-cur', name: 'Cur', signed: true }],
        }),
      ],
    });
    expect(r.rollup.talksInWindow).toBe(1);
    expect(r.rollup.current).toBe(1);
    expect(r.rollup.never).toBe(1);
  });

  it('sorts NEVER first, then OVERDUE / DUE_SOON / CURRENT', () => {
    const r = buildToolboxAttendanceGap({
      fromDate: '2026-04-01',
      toDate: '2026-04-27',
      employees: [
        emp({ id: 'emp-cur', firstName: 'Cur', lastName: 'A' }),
        emp({ id: 'emp-never', firstName: 'Never', lastName: 'B' }),
        emp({ id: 'emp-od', firstName: 'OD', lastName: 'C' }),
      ],
      toolboxTalks: [
        talk({
          heldOn: '2026-04-20',
          attendees: [{ employeeId: 'emp-cur', name: 'Cur', signed: true }],
        }),
        talk({
          id: 't-2',
          heldOn: '2026-04-01',
          attendees: [{ employeeId: 'emp-od', name: 'OD', signed: true }],
        }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('emp-never');
    expect(r.rows[1]?.employeeId).toBe('emp-od');
    expect(r.rows[2]?.employeeId).toBe('emp-cur');
  });
});
