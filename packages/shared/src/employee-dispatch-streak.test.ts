import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Employee } from './employee';

import { buildEmployeeDispatchStreak } from './employee-dispatch-streak';

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

function disp(date: string, employeeIds: string[], statusOverride?: Dispatch['status']): Dispatch {
  return {
    id: `d-${date}-${employeeIds.join(',')}`,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    scheduledFor: date,
    foremanName: 'Foreman',
    scopeOfWork: 'work',
    crew: employeeIds.map((id) => ({ employeeId: id, name: `E ${id}` })),
    equipment: [],
    status: statusOverride ?? 'POSTED',
  } as Dispatch;
}

describe('buildEmployeeDispatchStreak', () => {
  it('counts longest consecutive streak (Mon-Fri)', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [emp({ id: 'e1' })],
      dispatches: [
        disp('2026-04-13', ['e1']), // Mon
        disp('2026-04-14', ['e1']), // Tue
        disp('2026-04-15', ['e1']), // Wed
        // skip Thu/Fri
        disp('2026-04-20', ['e1']), // Mon
      ],
    });
    expect(r.rows[0]?.longestStreak).toBe(3);
  });

  it('treats Friday → Monday as consecutive working days', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [emp({ id: 'e1' })],
      dispatches: [
        disp('2026-04-17', ['e1']), // Fri
        disp('2026-04-20', ['e1']), // Mon
      ],
    });
    expect(r.rows[0]?.longestStreak).toBe(2);
  });

  it('skips DRAFT + CANCELLED dispatches', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [emp({ id: 'e1' })],
      dispatches: [
        disp('2026-04-13', ['e1'], 'DRAFT'),
        disp('2026-04-14', ['e1'], 'POSTED'),
        disp('2026-04-15', ['e1'], 'CANCELLED'),
      ],
    });
    expect(r.rows[0]?.totalDispatchDays).toBe(1);
  });

  it('captures last dispatch + days since', () => {
    const r = buildEmployeeDispatchStreak({
      asOf: '2026-04-30',
      employees: [emp({ id: 'e1' })],
      dispatches: [
        disp('2026-04-15', ['e1']),
      ],
    });
    expect(r.rows[0]?.lastDispatchDate).toBe('2026-04-15');
    expect(r.rows[0]?.daysSinceLastDispatch).toBe(15);
  });

  it('null lastDispatch when no dispatches', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [emp({ id: 'e1' })],
      dispatches: [],
    });
    expect(r.rows[0]?.lastDispatchDate).toBe(null);
    expect(r.rows[0]?.daysSinceLastDispatch).toBe(null);
  });

  it('includes inactive only when includeInactive=true', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 't', status: 'TERMINATED' }),
      ],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);

    const r2 = buildEmployeeDispatchStreak({
      includeInactive: true,
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 't', status: 'TERMINATED' }),
      ],
      dispatches: [],
    });
    expect(r2.rows).toHaveLength(2);
  });

  it('respects window bounds', () => {
    const r = buildEmployeeDispatchStreak({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      employees: [emp({ id: 'e1' })],
      dispatches: [
        disp('2026-03-15', ['e1']),
        disp('2026-04-15', ['e1']),
      ],
    });
    expect(r.rows[0]?.totalDispatchDays).toBe(1);
  });

  it('rolls up portfolio totals + no-dispatch count', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [
        emp({ id: 'busy', firstName: 'Busy' }),
        emp({ id: 'idle', firstName: 'Idle' }),
      ],
      dispatches: [disp('2026-04-15', ['busy'])],
    });
    expect(r.rollup.totalDispatchDays).toBe(1);
    expect(r.rollup.noDispatchCount).toBe(1);
  });

  it('sorts longest streak first', () => {
    const r = buildEmployeeDispatchStreak({
      employees: [
        emp({ id: 'short', firstName: 'Short' }),
        emp({ id: 'long', firstName: 'Long' }),
      ],
      dispatches: [
        disp('2026-04-13', ['short', 'long']),
        disp('2026-04-14', ['long']),
        disp('2026-04-15', ['long']),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('long');
  });

  it('handles empty input', () => {
    const r = buildEmployeeDispatchStreak({ employees: [], dispatches: [] });
    expect(r.rows).toHaveLength(0);
  });
});
