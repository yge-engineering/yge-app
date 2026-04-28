import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Employee } from './employee';

import { buildEmployeeDrAppearances } from './employee-dr-appearances';

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

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildEmployeeDrAppearances', () => {
  it('counts appearances + hours from DR rows', () => {
    const r = buildEmployeeDrAppearances({
      employees: [emp({ id: 'e1' })],
      reports: [
        dr({
          id: 'dr-a',
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '12:00', lunchIn: '12:30' },
          ],
        }),
        dr({
          id: 'dr-b',
          date: '2026-04-16',
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '12:00', lunchIn: '12:30' },
          ],
        }),
      ],
    });
    // Each row: 8.5 hr - 0.5 hr lunch = 8 hr. Two rows = 16 hr.
    expect(r.rows[0]?.appearanceCount).toBe(2);
    expect(r.rows[0]?.totalHours).toBe(16);
    expect(r.rows[0]?.distinctDays).toBe(2);
  });

  it('counts distinct jobs touched', () => {
    const r = buildEmployeeDrAppearances({
      employees: [emp({ id: 'e1' })],
      reports: [
        dr({ id: 'a', jobId: 'j1', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
        dr({ id: 'b', jobId: 'j2', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
        dr({ id: 'c', jobId: 'j1', date: '2026-04-16', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('captures last seen date + days since vs asOf', () => {
    const r = buildEmployeeDrAppearances({
      asOf: '2026-04-30',
      employees: [emp({ id: 'e1' })],
      reports: [
        dr({ id: 'a', date: '2026-04-15', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
        dr({ id: 'b', date: '2026-04-20', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
    });
    expect(r.rows[0]?.lastSeenDate).toBe('2026-04-20');
    expect(r.rows[0]?.daysSinceLastSeen).toBe(10);
  });

  it('skips draft (unsubmitted) reports', () => {
    const r = buildEmployeeDrAppearances({
      employees: [emp({ id: 'e1' })],
      reports: [
        dr({ id: 'draft', submitted: false, crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
    });
    expect(r.rows[0]?.appearanceCount).toBe(0);
  });

  it('respects from/to date window', () => {
    const r = buildEmployeeDrAppearances({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      employees: [emp({ id: 'e1' })],
      reports: [
        dr({ id: 'old', date: '2026-03-15', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
        dr({ id: 'in',  date: '2026-04-15', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
        dr({ id: 'after', date: '2026-05-15', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
    });
    expect(r.rows[0]?.appearanceCount).toBe(1);
  });

  it('excludes inactive employees by default', () => {
    const r = buildEmployeeDrAppearances({
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.employeeId).toBe('e1');
  });

  it('includes inactive when includeInactive is true', () => {
    const r = buildEmployeeDrAppearances({
      includeInactive: true,
      employees: [
        emp({ id: 'e1', status: 'ACTIVE' }),
        emp({ id: 'e2', status: 'TERMINATED' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts employees with zero appearances in rollup', () => {
    const r = buildEmployeeDrAppearances({
      employees: [
        emp({ id: 'e1' }),
        emp({ id: 'e2' }),
      ],
      reports: [
        dr({ id: 'a', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
    });
    expect(r.rollup.employeesWithoutAppearances).toBe(1);
  });

  it('sorts most-active employees first', () => {
    const r = buildEmployeeDrAppearances({
      employees: [
        emp({ id: 'e1', firstName: 'Alice' }),
        emp({ id: 'e2', firstName: 'Bob' }),
      ],
      reports: [
        dr({ id: 'a', crewOnSite: [
          { employeeId: 'e1', startTime: '07:00', endTime: '15:00' },
          { employeeId: 'e2', startTime: '07:00', endTime: '15:00' },
        ]}),
        dr({ id: 'b', date: '2026-04-16', crewOnSite: [
          { employeeId: 'e2', startTime: '07:00', endTime: '15:00' },
        ]}),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('e2');
    expect(r.rows[1]?.employeeId).toBe('e1');
  });

  it('handles empty input', () => {
    const r = buildEmployeeDrAppearances({ employees: [], reports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalAppearances).toBe(0);
  });
});
