import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildEmployeeDailyReportSnapshot } from './employee-daily-report-snapshot';

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

describe('buildEmployeeDailyReportSnapshot', () => {
  it('counts reports where employee was foreman', () => {
    const r = buildEmployeeDailyReportSnapshot({
      employeeId: 'fm1',
      asOf: '2026-04-30',
      dailyReports: [dr({ id: 'a', foremanId: 'fm1' })],
    });
    expect(r.totalReports).toBe(1);
    expect(r.reportsAsForeman).toBe(1);
  });

  it('counts reports where employee was on crew + sums hours', () => {
    const r = buildEmployeeDailyReportSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({
          id: 'a',
          crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }],
        }),
        dr({
          id: 'b',
          crewOnSite: [{ employeeId: 'e2', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
    });
    expect(r.totalReports).toBe(1);
    expect(r.reportsAsCrew).toBe(1);
    expect(r.hoursOnSite).toBe(8);
  });

  it('counts distinct jobs + last report date', () => {
    const r = buildEmployeeDailyReportSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', date: '2026-04-08', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
        dr({ id: 'b', jobId: 'j2', date: '2026-04-22', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.lastReportDate).toBe('2026-04-22');
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeDailyReportSnapshot({ employeeId: 'X', dailyReports: [] });
    expect(r.totalReports).toBe(0);
  });
});
