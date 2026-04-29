import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

import { buildPortfolioOvertimeMonthly } from './portfolio-overtime-monthly';

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
    endTime: '17:00',
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
    entries: [],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

describe('buildPortfolioOvertimeMonthly', () => {
  it('counts daily OT (hours > 8 on weekday)', () => {
    // 2026-04-15 is a Wednesday. 7:00 to 17:00 = 10 hours, 2 OT.
    const r = buildPortfolioOvertimeMonthly({
      employees: [emp({})],
      timecards: [tc({ entries: [entry({ date: '2026-04-15' })] })],
    });
    expect(r.rows[0]?.dailyOtHours).toBe(2);
    expect(r.rows[0]?.totalOtHours).toBe(2);
  });

  it('counts Saturday OT as full day', () => {
    // 2026-04-18 is a Saturday. 8 hours all OT.
    const r = buildPortfolioOvertimeMonthly({
      employees: [emp({})],
      timecards: [
        tc({
          entries: [entry({ date: '2026-04-18', startTime: '07:00', endTime: '15:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.saturdayOtHours).toBe(8);
    expect(r.rows[0]?.dailyOtHours).toBe(0);
  });

  it('counts Sunday OT as full day', () => {
    // 2026-04-19 is a Sunday.
    const r = buildPortfolioOvertimeMonthly({
      employees: [emp({})],
      timecards: [
        tc({
          entries: [entry({ date: '2026-04-19', startTime: '07:00', endTime: '15:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.sundayOtHours).toBe(8);
  });

  it('breaks down by classification', () => {
    const r = buildPortfolioOvertimeMonthly({
      employees: [
        emp({ id: 'e1', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'e2', classification: 'OPERATING_ENGINEER_GROUP_1' }),
      ],
      timecards: [
        tc({ id: 'a', employeeId: 'e1', entries: [entry({ date: '2026-04-15' })] }),
        tc({ id: 'b', employeeId: 'e2', entries: [entry({ date: '2026-04-15' })] }),
      ],
    });
    expect(r.rows[0]?.byClassification.LABORER_GROUP_1).toBe(2);
    expect(r.rows[0]?.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioOvertimeMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      employees: [emp({})],
      timecards: [
        tc({
          entries: [
            entry({ date: '2026-03-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioOvertimeMonthly({
      employees: [],
      timecards: [],
    });
    expect(r.rows).toHaveLength(0);
  });
});
