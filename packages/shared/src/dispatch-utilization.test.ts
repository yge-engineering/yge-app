import { describe, expect, it } from 'vitest';
import { buildDispatchUtilization } from './dispatch-utilization';
import type { Dispatch } from './dispatch';
import type { Employee } from './employee';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '',
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

function dispatch(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    scheduledFor: '2026-04-15',
    foremanName: 'Bob',
    scopeOfWork: 'Set forms',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildDispatchUtilization', () => {
  it('counts dispatched days for each employee', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      dispatches: [
        dispatch({
          id: 'd1',
          scheduledFor: '2026-04-13',
          crew: [{ employeeId: 'emp-1', name: 'Jane Doe' } as never],
        }),
        dispatch({
          id: 'd2',
          scheduledFor: '2026-04-15',
          crew: [{ employeeId: 'emp-1', name: 'Jane Doe' } as never],
        }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.showUpRate).toBeCloseTo(2 / 5, 4);
  });

  it('skips DRAFT and CANCELLED dispatches', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      dispatches: [
        dispatch({ id: 'd1', status: 'DRAFT', crew: [{ employeeId: 'emp-1', name: 'Jane' } as never] }),
        dispatch({ id: 'd2', status: 'CANCELLED', crew: [{ employeeId: 'emp-1', name: 'Jane' } as never] }),
        dispatch({ id: 'd3', status: 'POSTED', crew: [{ employeeId: 'emp-1', name: 'Jane' } as never] }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(1);
  });

  it('honors window via scheduledFor', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      dispatches: [
        dispatch({ id: 'in', scheduledFor: '2026-04-15', crew: [{ employeeId: 'emp-1', name: 'A' } as never] }),
        dispatch({ id: 'before', scheduledFor: '2026-03-15', crew: [{ employeeId: 'emp-1', name: 'A' } as never] }),
        dispatch({ id: 'after', scheduledFor: '2026-05-15', crew: [{ employeeId: 'emp-1', name: 'A' } as never] }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(1);
  });

  it('falls back to name match when no employeeId', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [],
      dispatches: [
        dispatch({
          scheduledFor: '2026-04-15',
          crew: [{ name: 'Free-form Worker' } as never],
        }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.employeeName).toBe('Free-form Worker');
  });

  it('multiple jobs same day = 2 dispatchedDays but 1 distinctDate', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-15',
      end: '2026-04-15',
      employees: [emp({ id: 'emp-1' })],
      dispatches: [
        dispatch({ id: 'd1', jobId: 'job-A', scheduledFor: '2026-04-15', crew: [{ employeeId: 'emp-1', name: 'A' } as never] }),
        dispatch({ id: 'd2', jobId: 'job-B', scheduledFor: '2026-04-15', crew: [{ employeeId: 'emp-1', name: 'A' } as never] }),
      ],
    });
    expect(r.rows[0]?.dispatchedDays).toBe(2);
    expect(r.rows[0]?.distinctDates).toBe(1);
    expect(r.rows[0]?.showUpRate).toBe(1);
  });

  it('sorts worst show-up rate first', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'reliable' }), emp({ id: 'flaky' })],
      dispatches: [
        dispatch({ id: 'd1', scheduledFor: '2026-04-13', crew: [{ employeeId: 'reliable', name: 'A' } as never] }),
        dispatch({ id: 'd2', scheduledFor: '2026-04-14', crew: [{ employeeId: 'reliable', name: 'A' } as never] }),
        dispatch({ id: 'd3', scheduledFor: '2026-04-15', crew: [{ employeeId: 'reliable', name: 'A' } as never] }),
        dispatch({ id: 'd4', scheduledFor: '2026-04-15', crew: [{ employeeId: 'flaky', name: 'B' } as never] }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('flaky');
  });

  it('workdaysInPeriod skips weekends', () => {
    const r = buildDispatchUtilization({
      start: '2026-04-13',  // Mon
      end: '2026-04-19',    // Sun
      employees: [],
      dispatches: [],
    });
    expect(r.workdaysInPeriod).toBe(5);
  });
});
