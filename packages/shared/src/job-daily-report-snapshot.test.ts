import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildJobDailyReportSnapshot } from './job-daily-report-snapshot';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'e1',
    weather: undefined,
    crewOnSite: [
      { employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '12:00', lunchIn: '12:30' },
    ],
    photoCount: 3,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobDailyReportSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobDailyReportSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', jobId: 'j1' }),
        dr({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalReports).toBe(1);
  });

  it('separates submitted vs draft', () => {
    const r = buildJobDailyReportSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', submitted: true }),
        dr({ id: 'b', submitted: false }),
        dr({ id: 'c', submitted: true }),
      ],
    });
    expect(r.submittedReports).toBe(2);
    expect(r.draftReports).toBe(1);
  });

  it('sums crew rows + hours + photos', () => {
    const r = buildJobDailyReportSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({
          id: 'a',
          photoCount: 5,
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:00' },
            { employeeId: 'e2', startTime: '07:00', endTime: '17:00' },
          ],
        }),
      ],
    });
    expect(r.totalCrewRows).toBe(2);
    expect(r.totalCrewHours).toBe(18);
    expect(r.totalPhotos).toBe(5);
  });

  it('counts distinct foremen + last report date', () => {
    const r = buildJobDailyReportSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', foremanId: 'f1', date: '2026-04-08' }),
        dr({ id: 'b', foremanId: 'f2', date: '2026-04-22' }),
      ],
    });
    expect(r.distinctForemen).toBe(2);
    expect(r.lastReportDate).toBe('2026-04-22');
  });

  it('handles no matching reports', () => {
    const r = buildJobDailyReportSnapshot({ jobId: 'j1', dailyReports: [] });
    expect(r.totalReports).toBe(0);
    expect(r.lastReportDate).toBeNull();
  });
});
