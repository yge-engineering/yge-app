import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

import { buildPortfolioHeadcountMonthly } from './portfolio-headcount-monthly';

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

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'f1',
    weather: 'CLEAR',
    crewOnSite: [
      { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
    ] as DailyReport['crewOnSite'],
    photoCount: 0,
    ...over,
  } as DailyReport;
}

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'd-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'work',
    crew: [{ employeeId: 'e1', name: 'Pat' }],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildPortfolioHeadcountMonthly', () => {
  it('counts distinct employees across timecards / DRs / dispatches', () => {
    const r = buildPortfolioHeadcountMonthly({
      employees: [emp({ id: 'e1' }), emp({ id: 'e2' }), emp({ id: 'e3' })],
      timecards: [tc({ id: 'a', employeeId: 'e1' })],
      dailyReports: [
        dr({ id: 'a', crewOnSite: [{ employeeId: 'e2', startTime: '07:00', endTime: '15:30' }] as DailyReport['crewOnSite'] }),
      ],
      dispatches: [
        disp({ id: 'a', crew: [{ employeeId: 'e3', name: 'C' }] }),
      ],
    });
    expect(r.rows[0]?.activeEmployees).toBe(3);
  });

  it('does not double-count an employee appearing in all three sources', () => {
    const r = buildPortfolioHeadcountMonthly({
      employees: [emp({ id: 'e1' })],
      timecards: [tc({ id: 'a', employeeId: 'e1' })],
      dailyReports: [dr({ id: 'a' })],
      dispatches: [disp({ id: 'a' })],
    });
    expect(r.rows[0]?.activeEmployees).toBe(1);
  });

  it('breaks down by classification + role', () => {
    const r = buildPortfolioHeadcountMonthly({
      employees: [
        emp({ id: 'e1', classification: 'LABORER_GROUP_1', role: 'LABORER' }),
        emp({ id: 'e2', classification: 'OPERATING_ENGINEER_GROUP_1', role: 'LABORER' }),
        emp({ id: 'e3', classification: 'LABORER_GROUP_1', role: 'FOREMAN' }),
      ],
      timecards: [
        tc({ id: 'a', employeeId: 'e1' }),
        tc({ id: 'b', employeeId: 'e2' }),
        tc({ id: 'c', employeeId: 'e3' }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows[0]?.byClassification.LABORER_GROUP_1).toBe(2);
    expect(r.rows[0]?.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(1);
    expect(r.rows[0]?.byRole.LABORER).toBe(2);
    expect(r.rows[0]?.byRole.FOREMAN).toBe(1);
  });

  it('counts unmatched employee ids separately', () => {
    const r = buildPortfolioHeadcountMonthly({
      employees: [emp({ id: 'e1' })],
      timecards: [tc({ id: 'a', employeeId: 'e2' })],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rollup.unmatchedEmployeeIds).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioHeadcountMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      employees: [emp({ id: 'e1' })],
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-03-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioHeadcountMonthly({
      employees: [emp({ id: 'e1' })],
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-06-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioHeadcountMonthly({
      employees: [],
      timecards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows).toHaveLength(0);
  });
});
