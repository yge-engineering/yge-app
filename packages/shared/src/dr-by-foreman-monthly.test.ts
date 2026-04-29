import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildDrByForemanMonthly } from './dr-by-foreman-monthly';

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
    ...over,
  } as DailyReport;
}

describe('buildDrByForemanMonthly', () => {
  it('groups by (foreman, month)', () => {
    const r = buildDrByForemanMonthly({
      dailyReports: [
        dr({ id: 'a', foremanId: 'f1', date: '2026-04-15' }),
        dr({ id: 'b', foremanId: 'f1', date: '2026-05-01' }),
        dr({ id: 'c', foremanId: 'f2', date: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts distinct dates and distinct jobs', () => {
    const r = buildDrByForemanMonthly({
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', date: '2026-04-15' }),
        dr({ id: 'b', jobId: 'j2', date: '2026-04-16' }),
        dr({ id: 'c', jobId: 'j1', date: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sums crewDays + photoCount', () => {
    const r = buildDrByForemanMonthly({
      dailyReports: [
        dr({
          id: 'a',
          photoCount: 5,
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
            { employeeId: 'e2', startTime: '07:00', endTime: '15:30' },
          ] as DailyReport['crewOnSite'],
        }),
        dr({
          id: 'b',
          photoCount: 3,
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
          ] as DailyReport['crewOnSite'],
        }),
      ],
    });
    expect(r.rows[0]?.crewDays).toBe(3);
    expect(r.rows[0]?.photoCount).toBe(8);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildDrByForemanMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dailyReports: [
        dr({ id: 'old', date: '2026-03-15' }),
        dr({ id: 'in', date: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDrs).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildDrByForemanMonthly({
      dailyReports: [
        dr({ id: 'a', photoCount: 5 }),
        dr({ id: 'b', photoCount: 5 }),
        dr({ id: 'c', photoCount: 5 }),
      ],
    });
    expect(r.rollup.totalDrs).toBe(3);
    expect(r.rollup.totalPhotoCount).toBe(15);
  });

  it('sorts by foremanId asc, month asc', () => {
    const r = buildDrByForemanMonthly({
      dailyReports: [
        dr({ id: 'a', foremanId: 'fZ', date: '2026-04-15' }),
        dr({ id: 'b', foremanId: 'fA', date: '2026-05-01' }),
        dr({ id: 'c', foremanId: 'fA', date: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.foremanId).toBe('fA');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.foremanId).toBe('fZ');
  });

  it('handles empty input', () => {
    const r = buildDrByForemanMonthly({ dailyReports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalDrs).toBe(0);
  });
});
