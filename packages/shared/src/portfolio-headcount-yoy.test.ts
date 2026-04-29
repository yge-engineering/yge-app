import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

import { buildPortfolioHeadcountYoy } from './portfolio-headcount-yoy';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '',
    updatedAt: '',
    firstName: 'Pat',
    lastName: 'Smith',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    ...over,
  } as Employee;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'j1',
    startTime: '07:00',
    endTime: '15:30',
    ...over,
  } as TimeEntry;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    entries: [entry({})],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

describe('buildPortfolioHeadcountYoy', () => {
  it('compares prior vs current active headcount', () => {
    const r = buildPortfolioHeadcountYoy({
      currentYear: 2026,
      employees: [emp({ id: 'e1' }), emp({ id: 'e2' })],
      timecards: [
        tc({ id: 'a', employeeId: 'e1', entries: [entry({ date: '2025-04-15' })] }),
        tc({ id: 'b', employeeId: 'e2', entries: [entry({ date: '2026-04-15' })] }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorActiveEmployees).toBe(1);
    expect(r.currentActiveEmployees).toBe(1);
    expect(r.activeEmployeesDelta).toBe(0);
  });

  it('does not double-count an employee active in same year via multiple sources', () => {
    const r = buildPortfolioHeadcountYoy({
      currentYear: 2026,
      employees: [emp({ id: 'e1' })],
      timecards: [tc({ id: 'a', employeeId: 'e1' })],
      dailyReports: [
        {
          id: 'dr-1',
          createdAt: '',
          updatedAt: '',
          date: '2026-04-15',
          jobId: 'j1',
          foremanId: 'f1',
          weather: 'CLEAR',
          crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30' }],
          photoCount: 0,
        } as never,
      ],
      dispatches: [],
    });
    expect(r.currentActiveEmployees).toBe(1);
  });

  it('breaks down by classification per year', () => {
    const r = buildPortfolioHeadcountYoy({
      currentYear: 2026,
      employees: [
        emp({ id: 'e1', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'e2', classification: 'OPERATING_ENGINEER_GROUP_1' }),
      ],
      timecards: [
        tc({ id: 'a', employeeId: 'e1', entries: [entry({ date: '2026-04-15' })] }),
        tc({ id: 'b', employeeId: 'e2', entries: [entry({ date: '2026-04-15' })] }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.currentByClassification.LABORER_GROUP_1).toBe(1);
    expect(r.currentByClassification.OPERATING_ENGINEER_GROUP_1).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioHeadcountYoy({
      currentYear: 2026,
      employees: [],
      timecards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorActiveEmployees).toBe(0);
    expect(r.currentActiveEmployees).toBe(0);
  });
});
