import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildEmployeeDailyReportYoy } from './employee-daily-report-yoy';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    weather: undefined,
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildEmployeeDailyReportYoy', () => {
  it('compares two years for one employee', () => {
    const r = buildEmployeeDailyReportYoy({
      employeeId: 'e1',
      currentYear: 2026,
      dailyReports: [
        dr({
          id: 'a',
          date: '2025-04-15',
          crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }],
        }),
        dr({
          id: 'b',
          date: '2026-04-15',
          crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '17:00' }],
        }),
      ],
    });
    expect(r.priorReports).toBe(1);
    expect(r.currentReports).toBe(1);
    expect(r.priorHoursOnSite).toBe(8);
    expect(r.currentHoursOnSite).toBe(10);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeDailyReportYoy({
      employeeId: 'X',
      currentYear: 2026,
      dailyReports: [],
    });
    expect(r.priorReports).toBe(0);
  });
});
