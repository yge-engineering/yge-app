import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildDrMonthlyVolume } from './dr-monthly-volume';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'f1',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildDrMonthlyVolume', () => {
  it('buckets by yyyy-mm of date', () => {
    const r = buildDrMonthlyVolume({
      dailyReports: [
        dr({ id: 'a', date: '2026-03-15' }),
        dr({ id: 'b', date: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts submitted vs draft', () => {
    const r = buildDrMonthlyVolume({
      dailyReports: [
        dr({ id: 'a', submitted: true }),
        dr({ id: 'b', submitted: false }),
        dr({ id: 'c', submitted: true }),
      ],
    });
    expect(r.rows[0]?.submitted).toBe(2);
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.total).toBe(3);
  });

  it('counts distinct foremen and jobs per month', () => {
    const r = buildDrMonthlyVolume({
      dailyReports: [
        dr({ id: 'a', foremanId: 'f1', jobId: 'j1' }),
        dr({ id: 'b', foremanId: 'f2', jobId: 'j1' }),
        dr({ id: 'c', foremanId: 'f1', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctForemen).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sums crew rows', () => {
    const r = buildDrMonthlyVolume({
      dailyReports: [
        dr({
          id: 'a',
          crewOnSite: [
            { employeeId: 'e1', startTime: '08:00', endTime: '16:00' },
            { employeeId: 'e2', startTime: '08:00', endTime: '16:00' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalCrewRows).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildDrMonthlyVolume({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dailyReports: [
        dr({ id: 'mar', date: '2026-03-15' }),
        dr({ id: 'apr', date: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month submitted change', () => {
    const r = buildDrMonthlyVolume({
      dailyReports: [
        dr({ id: 'mar', date: '2026-03-15', submitted: true }),
        dr({ id: 'apr1', date: '2026-04-10', submitted: true }),
        dr({ id: 'apr2', date: '2026-04-15', submitted: true }),
        dr({ id: 'apr3', date: '2026-04-20', submitted: true }),
      ],
    });
    expect(r.rollup.monthOverMonthSubmittedChange).toBe(2);
  });

  it('sorts by month asc', () => {
    const r = buildDrMonthlyVolume({
      dailyReports: [
        dr({ id: 'late', date: '2026-04-15' }),
        dr({ id: 'early', date: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildDrMonthlyVolume({ dailyReports: [] });
    expect(r.rows).toHaveLength(0);
  });
});
