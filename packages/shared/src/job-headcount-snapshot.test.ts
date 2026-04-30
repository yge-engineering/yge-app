import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Employee } from './employee';
import type { TimeCard } from './time-card';

import { buildJobHeadcountSnapshot } from './job-headcount-snapshot';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'e1',
    weather: undefined,
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    status: 'SUBMITTED',
    entries: [],
    ...over,
  } as TimeCard;
}

function emp(id: string, status: 'ACTIVE' | 'TERMINATED' = 'ACTIVE'): Employee {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    firstName: 'X',
    lastName: 'Y',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status,
    certifications: [],
  } as Employee;
}

describe('buildJobHeadcountSnapshot', () => {
  it('counts distinct employees from daily reports + timecards', () => {
    const r = buildJobHeadcountSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({
          id: 'a',
          jobId: 'j1',
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:00' },
            { employeeId: 'e2', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      timeCards: [
        tc({ employeeId: 'e3', entries: [{ date: '2026-04-15', jobId: 'j1', startTime: '07:00', endTime: '15:00' }] }),
      ],
      employees: [emp('e1'), emp('e2'), emp('e3')],
    });
    expect(r.totalEmployeesEverOnJob).toBe(3);
  });

  it('respects window + counts active employees', () => {
    const r = buildJobHeadcountSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      windowDays: 14,
      dailyReports: [
        dr({
          id: 'a',
          jobId: 'j1',
          date: '2026-04-25',
          crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }],
        }),
        dr({
          id: 'b',
          jobId: 'j1',
          date: '2026-01-15',
          crewOnSite: [{ employeeId: 'e2', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
      timeCards: [],
      employees: [emp('e1', 'ACTIVE'), emp('e2', 'TERMINATED')],
    });
    expect(r.totalEmployeesEverOnJob).toBe(2);
    expect(r.employeesInWindow).toBe(1);
    expect(r.activeEmployeesInWindow).toBe(1);
  });

  it('tracks last seen on job', () => {
    const r = buildJobHeadcountSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', date: '2026-04-08' }),
        dr({ id: 'b', jobId: 'j1', date: '2026-04-22' }),
      ],
      timeCards: [],
      employees: [],
    });
    expect(r.lastSeenOnJob).toBe('2026-04-22');
  });

  it('handles empty input', () => {
    const r = buildJobHeadcountSnapshot({
      jobId: 'j1',
      dailyReports: [],
      timeCards: [],
      employees: [],
    });
    expect(r.totalEmployeesEverOnJob).toBe(0);
    expect(r.lastSeenOnJob).toBeNull();
  });
});
