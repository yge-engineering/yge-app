import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildJobDailyReportDetailSnapshot } from './job-daily-report-detail-snapshot';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'f1',
    crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30' }],
    ...over,
  } as DailyReport;
}

describe('buildJobDailyReportDetailSnapshot', () => {
  it('returns one row per foreman sorted by total', () => {
    const r = buildJobDailyReportDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', foremanId: 'f1', date: '2026-04-13', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30' }] }),
        dr({ id: 'b', jobId: 'j1', foremanId: 'f1', date: '2026-04-14', issues: 'pump broke', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30' }, { employeeId: 'e2', startTime: '07:00', endTime: '15:30' }] }),
        dr({ id: 'c', jobId: 'j1', foremanId: 'f2', date: '2026-04-15', visitors: 'inspector', crewOnSite: [{ employeeId: 'e3', startTime: '07:00', endTime: '15:30' }] }),
        dr({ id: 'd', jobId: 'j2', foremanId: 'f1', date: '2026-04-16' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.foremanId).toBe('f1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.withIssues).toBe(1);
    expect(r.rows[0]?.distinctCrew).toBe(2);
    expect(r.rows[1]?.foremanId).toBe('f2');
    expect(r.rows[1]?.withVisitors).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobDailyReportDetailSnapshot({ jobId: 'X', dailyReports: [] });
    expect(r.rows.length).toBe(0);
  });
});
