import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildJobDailyReportYoy } from './job-daily-report-yoy';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    weather: undefined,
    crewOnSite: [
      { employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '12:00', lunchIn: '12:30' },
    ],
    photoCount: 3,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobDailyReportYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobDailyReportYoy({
      jobId: 'j1',
      currentYear: 2026,
      dailyReports: [
        dr({ id: 'a', date: '2025-04-15' }),
        dr({ id: 'b', date: '2026-04-15' }),
        dr({ id: 'c', date: '2026-04-22', submitted: false }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentSubmitted).toBe(1);
    expect(r.currentDraft).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobDailyReportYoy({ jobId: 'X', currentYear: 2026, dailyReports: [] });
    expect(r.priorTotal).toBe(0);
  });
});
