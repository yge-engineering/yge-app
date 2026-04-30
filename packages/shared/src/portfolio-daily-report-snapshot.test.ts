import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildPortfolioDailyReportSnapshot } from './portfolio-daily-report-snapshot';

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

describe('buildPortfolioDailyReportSnapshot', () => {
  it('counts reports + ytd', () => {
    const r = buildPortfolioDailyReportSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      dailyReports: [
        dr({ id: 'a', date: '2025-04-15' }),
        dr({ id: 'b', date: '2026-04-15' }),
      ],
    });
    expect(r.totalReports).toBe(2);
    expect(r.ytdReports).toBe(1);
  });

  it('separates submitted vs draft', () => {
    const r = buildPortfolioDailyReportSnapshot({
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
    const r = buildPortfolioDailyReportSnapshot({
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

  it('counts distinct jobs + foremen', () => {
    const r = buildPortfolioDailyReportSnapshot({
      asOf: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', foremanId: 'e1' }),
        dr({ id: 'b', jobId: 'j2', foremanId: 'e2' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.distinctForemen).toBe(2);
  });

  it('ignores reports after asOf', () => {
    const r = buildPortfolioDailyReportSnapshot({
      asOf: '2026-04-30',
      dailyReports: [dr({ id: 'late', date: '2026-05-15' })],
    });
    expect(r.totalReports).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioDailyReportSnapshot({ dailyReports: [] });
    expect(r.totalReports).toBe(0);
  });
});
